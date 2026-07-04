const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { normalizeLearningEvent } = require("./learningContracts");
const { addNotification, withdrawNotificationsForSource } = require("./notifications");

const ACTIVE_STATUS = "active";
const DISABLED_STATUS = "disabled";
const COVERED_STATUS = "covered";
const RULE_STATUSES = new Set([ACTIVE_STATUS, DISABLED_STATUS, COVERED_STATUS]);
const rulesetPublishLocks = new Map();

function learningDir(root) {
  return path.join(root, "learning");
}

function eventsFile(root) {
  return path.join(learningDir(root), "events.jsonl");
}

function rulesetFile(root) {
  return path.join(learningDir(root), "current-ruleset.json");
}

function rulesetHistoryDir(root) {
  return path.join(learningDir(root), "ruleset-history");
}

function rulesetSnapshotFile(root, version) {
  return path.join(rulesetHistoryDir(root), `v${Number(version || 0)}.json`);
}

async function withRulesetPublishLock(root, task) {
  const key = path.resolve(root);
  const previous = rulesetPublishLocks.get(key) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const waiting = previous.catch(() => {}).then(() => current);
  rulesetPublishLocks.set(key, waiting);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    releaseCurrent();
    if (rulesetPublishLocks.get(key) === waiting) {
      rulesetPublishLocks.delete(key);
    }
  }
}

async function learnExplicitRule(root, input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idSource = options.idSource || (() => `learn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const createdAt = now();
  const eventId = input.eventId || idSource();
  const topicKey = inferTopicKey(input);
  const conflictKey = Object.hasOwn(input, "conflictKey")
    ? String(input.conflictKey || "").trim()
    : inferConflictKey(input, topicKey);
  if (shouldWaitForEvaluationSamples(input)) {
    const event = await appendSampleInsufficientLearningEvent(root, {
      ...input,
      eventId,
      topicKey,
      conflictKey,
      sourceType: input.sourceType || "conversation",
      capability: String(input.capability || "").trim() || capabilityFromTopic(topicKey),
      summary: String(input.summary || input.rawTrigger || "").trim(),
      createdAt,
      updatedAt: createdAt,
    }, { now });
    return {
      event,
      ruleset: await readCurrentRuleset(root),
    };
  }
  const baseEvent = normalizeEvent({
    eventId,
    topicKey,
    conflictKey,
    sourceType: input.sourceType || "conversation",
    sourceEventIds: input.sourceEventIds,
    landingIds: input.landingIds,
    outputId: input.outputId || "",
    projectId: input.projectId || "",
    canvasId: input.canvasId || "",
    conversationId: input.conversationId || "",
    learningMode: typeof input.learningMode === "string" ? input.learningMode : "overall",
    internalStatus: "received",
    jobStatus: "queued",
    landingType: input.landingType || "",
    summary: String(input.summary || "").trim(),
    rawTrigger: String(input.rawTrigger || "").trim(),
    capability: String(input.capability || "").trim() || capabilityFromTopic(topicKey),
    tokenUsage: normalizeUsage(input.tokenUsage),
    createdAt,
    updatedAt: createdAt,
  });
  await appendLearningEvent(root, baseEvent);

  const newRuleId = `rule-${eventId}`;
  let durablePublish;
  try {
    const content = String(input.content || baseEvent.summary).trim();
    if (baseEvent.learningMode !== "overall") {
      throw new Error(`只有 learningMode=overall 可以发布到当前规则层：${baseEvent.learningMode}`);
    }
    if (!content) throw new Error("规则内容为空，无法发布到当前规则层");
    if (!conflictKey) throw new Error("conflictKey 不能为空，无法发布到当前规则层");

    const expectedVersion = normalizeOptionalVersion(
      Object.hasOwn(input, "expectedVersion") ? input.expectedVersion : options.expectedVersion,
    );
    durablePublish = await withRulesetPublishLock(root, async () => {
      const ruleset = await readCurrentRulesetStrict(root);
      if (expectedVersion !== null && expectedVersion !== Number(ruleset.version || 0)) {
        throw new Error(`expectedVersion 不匹配：当前版本 ${Number(ruleset.version || 0)}，收到 ${expectedVersion}`);
      }
      const existingEvents = await listLearningEvents(root, { includeCovered: true });
      const publishTime = now();
      const nextRules = (ruleset.rules || []).map((rule) =>
        isSameTopicOrConflict(rule, topicKey, conflictKey) && [ACTIVE_STATUS, DISABLED_STATUS].includes(rule.status)
          ? { ...rule, status: COVERED_STATUS, coveredByRuleId: newRuleId, updatedAt: publishTime }
          : rule
      );
      const coveredEvents = existingEvents.filter((event) =>
        event.eventId !== eventId &&
        isSameTopicOrConflict(event, topicKey, conflictKey) &&
        event.internalStatus !== "covered" &&
        event.internalStatus !== "failed"
      );

      const nextRuleset = {
        version: Number(ruleset.version || 0) + 1,
        lastGoodVersion: Number(ruleset.version || 0) + 1,
        updatedAt: publishTime,
        rules: [
          ...nextRules,
          {
            ruleId: newRuleId,
            topicKey,
            conflictKey,
            capability: baseEvent.capability,
            content,
            priority: Number(input.priority || 50),
            sourceEventIds: [eventId],
            status: ACTIVE_STATUS,
            createdAt: publishTime,
            updatedAt: publishTime,
          },
        ],
      };
      validateRuleset(nextRuleset);
      const writtenRuleset = await writeCurrentRuleset(root, nextRuleset);
      const bookkeepingEvents = [
        ...coveredEvents,
        ...existingEvents.filter((item) =>
          item.eventId !== eventId &&
          isSameTopicOrConflict(item, topicKey, conflictKey) &&
          item.internalStatus === "failed" &&
          !coveredEvents.some((covered) => covered.eventId === item.eventId)
        ),
      ];

      const postCommitWarnings = await runPostCommitBookkeeping(root, {
        events: bookkeepingEvents,
        eventId,
        publishTime,
        options,
      });

      let event = normalizeEvent({
        ...baseEvent,
        internalStatus: "landed",
        jobStatus: "completed",
        landingType: "current-rule",
        landingIds: [newRuleId],
        ruleId: newRuleId,
        updatedAt: publishTime,
        postCommitWarnings,
      });
      try {
        await appendLearningEvent(root, event);
      } catch (error) {
        event = {
          ...event,
          postCommitWarnings: normalizePostCommitWarnings([
            ...(event.postCommitWarnings || []),
            buildPostCommitWarning("append-landed-event", { eventId }, error),
          ]),
        };
      }

      return { writtenRuleset, event };
    });

  } catch (error) {
    const failedAt = now();
    const event = normalizeEvent({
      ...baseEvent,
      internalStatus: "failed",
      jobStatus: "failed",
      error: {
        stage: "publish-current-ruleset",
        code: "RULESET_PUBLISH_FAILED",
        message: error.message || String(error),
      },
      updatedAt: failedAt,
    });
    await appendLearningEvent(root, event);
    if (options.notifyOnFailure) {
      await addNotification(root, {
        type: "learning",
        sourceType: "learning-event",
        sourceId: eventId,
        title: "学习失败，请查看",
        summary: event.error.message,
        target: { page: "learning", eventId },
        createdAt: failedAt,
      });
    }
    return { event, ruleset: await readCurrentRuleset(root) };
  }

  return { event: durablePublish.event, ruleset: durablePublish.writtenRuleset };
}

function shouldWaitForEvaluationSamples(input = {}) {
  return Boolean(
    input.requiresEvaluation === true &&
    String(input.neededSampleType || "").trim() &&
    Number(input.neededCount || 0) > 0
  );
}

async function runPostCommitBookkeeping(root, input = {}) {
  const warnings = [];
  const events = Array.isArray(input.events) ? input.events : [];
  const options = input.options || {};
  for (const event of events) {
    let coveredEventAppended = false;
    try {
      maybeFailPostPublishBookkeeping(options, "append-covered-event");
      await appendLearningEvent(root, {
        ...event,
        internalStatus: "covered",
        jobStatus: "completed",
        coveredByEventId: input.eventId,
        updatedAt: input.publishTime,
      });
      coveredEventAppended = true;
    } catch (error) {
      warnings.push(buildPostCommitWarning("append-covered-event", event, error));
    }

    if (!coveredEventAppended) continue;
    try {
      maybeFailPostPublishBookkeeping(options, "withdraw-notification");
      await withdrawNotificationsForSource(root, "learning-event", event.eventId, {
        handledAt: input.publishTime,
      });
    } catch (error) {
      warnings.push(buildPostCommitWarning("withdraw-notification", event, error));
    }
  }
  return normalizePostCommitWarnings(warnings);
}

function maybeFailPostPublishBookkeeping(options = {}, stage) {
  const requested = options.failPostPublishBookkeeping;
  if (requested === true || requested === stage) {
    throw new Error(`simulated post-publish bookkeeping failure: ${stage}`);
  }
}

function buildPostCommitWarning(stage, event, error) {
  return {
    stage,
    eventId: String(event?.eventId || "").trim(),
    message: error?.message || String(error),
  };
}

async function readCurrentRuleset(root) {
  try {
    return await readCurrentRulesetStrict(root);
  } catch {
    return { version: 0, lastGoodVersion: 0, updatedAt: "", rules: [] };
  }
}

async function readCurrentRulesetStrict(root) {
  const file = rulesetFile(root);
  if (!fs.existsSync(file)) {
    return normalizeRuleset({ version: 0, lastGoodVersion: 0, updatedAt: "", rules: [] });
  }
  const parsed = JSON.parse(await fsp.readFile(file, "utf8"));
  const ruleset = normalizeRuleset(parsed);
  validateRuleset(ruleset);
  return ruleset;
}

async function writeCurrentRuleset(root, ruleset) {
  const normalized = normalizeRuleset(ruleset);
  validateRuleset(normalized);
  await writeRulesetFilesAtomically(root, normalized);
  return normalized;
}

async function writeRulesetFilesAtomically(root, ruleset) {
  const learningPath = learningDir(root);
  const historyPath = rulesetHistoryDir(root);
  const currentPath = rulesetFile(root);
  const snapshotPath = rulesetSnapshotFile(root, ruleset.version);
  const tempId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const currentTempPath = path.join(learningPath, `.current-ruleset.json.tmp-${tempId}`);
  const snapshotTempPath = path.join(historyPath, `.v${Number(ruleset.version || 0)}.json.tmp-${tempId}`);
  const rulesetText = JSON.stringify(ruleset, null, 2);
  const snapshotText = JSON.stringify(buildRulesetSnapshot(ruleset), null, 2);
  let snapshotPromoted = false;
  let hadPreviousSnapshot = false;
  let previousSnapshot = null;

  try {
    await fsp.mkdir(learningPath, { recursive: true });
    await fsp.mkdir(historyPath, { recursive: true });
    await fsp.writeFile(snapshotTempPath, snapshotText, "utf8");
    await fsp.writeFile(currentTempPath, rulesetText, "utf8");

    hadPreviousSnapshot = fs.existsSync(snapshotPath);
    if (hadPreviousSnapshot) previousSnapshot = await fsp.readFile(snapshotPath);

    await fsp.rename(snapshotTempPath, snapshotPath);
    snapshotPromoted = true;
    await fsp.rename(currentTempPath, currentPath);
  } catch (error) {
    await cleanupRulesetPublishFiles({
      currentTempPath,
      snapshotTempPath,
      snapshotPath,
      snapshotPromoted,
      hadPreviousSnapshot,
      previousSnapshot,
      error,
    });
    throw error;
  }
}

function buildRulesetSnapshot(ruleset) {
  const version = Number(ruleset.version || 0);
  return {
    version,
    lastGoodVersion: Number(ruleset.lastGoodVersion || version),
    createdAt: String(ruleset.updatedAt || ruleset.createdAt || new Date().toISOString()),
    sourceEventIds: collectSourceEventIds(ruleset.rules),
    rules: ruleset.rules,
  };
}

async function cleanupRulesetPublishFiles({
  currentTempPath,
  snapshotTempPath,
  snapshotPath,
  snapshotPromoted,
  hadPreviousSnapshot,
  previousSnapshot,
  error,
}) {
  const cleanupErrors = [];
  await Promise.all([
    removeFileIfExists(currentTempPath, cleanupErrors),
    removeFileIfExists(snapshotTempPath, cleanupErrors),
  ]);
  if (!snapshotPromoted) {
    if (cleanupErrors.length) {
      error.message = `${error.message || String(error)}；${cleanupErrors.join("；")}`;
    }
    return;
  }
  try {
    if (hadPreviousSnapshot) {
      await fsp.writeFile(snapshotPath, previousSnapshot);
    } else {
      await removeFileIfExists(snapshotPath, cleanupErrors);
    }
  } catch (rollbackError) {
    cleanupErrors.push(`规则快照回滚失败：${rollbackError.message || String(rollbackError)}`);
  }
  if (cleanupErrors.length) {
    error.message = `${error.message || String(error)}；${cleanupErrors.join("；")}`;
  }
}

async function removeFileIfExists(file, cleanupErrors = []) {
  try {
    await fsp.unlink(file);
  } catch (error) {
    if (error?.code !== "ENOENT") cleanupErrors.push(`临时文件清理失败：${file}：${error.message || String(error)}`);
  }
}

function collectSourceEventIds(rules = []) {
  const ids = new Set();
  for (const rule of rules) {
    for (const id of Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : []) {
      const value = String(id || "").trim();
      if (value) ids.add(value);
    }
  }
  return Array.from(ids);
}

async function updateCurrentRuleStatus(root, input = {}, options = {}) {
  const ruleId = String(input.ruleId || "").trim();
  const nextStatus = String(input.status || "").trim();
  const now = options.now || (() => new Date().toISOString());

  if (!ruleId) throw new Error("规则编号不能为空");
  if (![ACTIVE_STATUS, DISABLED_STATUS].includes(nextStatus)) {
    throw new Error("当前规则只允许启用或停用");
  }

  return withRulesetPublishLock(root, async () => {
    const ruleset = await readCurrentRulesetStrict(root);
    const rule = (ruleset.rules || []).find((item) => item.ruleId === ruleId);
    if (!rule) throw new Error(`当前规则不存在：${ruleId}`);
    if (rule.status === COVERED_STATUS || rule.coveredByRuleId) {
      throw new Error("已被覆盖的规则不能直接启用或停用");
    }
    if (![ACTIVE_STATUS, DISABLED_STATUS].includes(rule.status)) {
      throw new Error(`当前规则状态不允许切换：${rule.status}`);
    }

    if (nextStatus === ACTIVE_STATUS) {
      const activeSameRule = (ruleset.rules || []).find((item) =>
        item.ruleId !== ruleId &&
        item.status === ACTIVE_STATUS &&
        isSameTopicOrConflict(item, rule.topicKey, rule.conflictKey)
      );
      if (activeSameRule) {
        throw new Error(`同一冲突键已存在启用规则：${rule.conflictKey}`);
      }
    }

    const updatedAt = now();
    const nextRuleset = {
      ...ruleset,
      version: Number(ruleset.version || 0) + 1,
      lastGoodVersion: Number(ruleset.version || 0) + 1,
      updatedAt,
      rules: (ruleset.rules || []).map((item) =>
        item.ruleId === ruleId
          ? { ...item, status: nextStatus, coveredByRuleId: "", updatedAt }
          : item
      ),
    };
    validateRuleset(nextRuleset);
    const writtenRuleset = await writeCurrentRuleset(root, nextRuleset);

    return {
      rule: writtenRuleset.rules.find((item) => item.ruleId === ruleId),
      ruleset: writtenRuleset,
    };
  });
}

async function listLearningEvents(root, options = {}) {
  const records = await readLearningEventRecords(root);
  const latest = new Map();
  for (const record of records) {
    const previous = latest.get(record.eventId) || {};
    latest.set(record.eventId, { ...previous, ...record });
  }
  return Array.from(latest.values())
    .filter((event) => options.includeCovered || event.internalStatus !== "covered")
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

async function readLearningEventRecords(root) {
  const file = eventsFile(root);
  if (!fs.existsSync(file)) return [];
  const text = await fsp.readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return normalizeEvent(JSON.parse(line));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function appendLearningEvent(root, event) {
  const file = eventsFile(root);
  const normalized = normalizeEvent(event);
  if (!normalized) throw new Error("learning event requires eventId");
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.appendFile(file, `${JSON.stringify(normalized)}\n`, "utf8");
  return normalized;
}

async function appendSampleInsufficientLearningEvent(root, input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const createdAt = String(input.createdAt || now());
  const eventId = String(input.eventId || `sample-insufficient-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`).trim();
  if (!eventId) throw new Error("learning event requires eventId");
  const topicKey = String(input.topicKey || "general").trim() || "general";
  const event = normalizeEvent({
    ...input,
    eventId,
    topicKey,
    conflictKey: String(input.conflictKey || topicKey).trim() || topicKey,
    learningMode: input.learningMode || "uncertain",
    internalStatus: input.internalStatus || "received",
    jobStatus: input.jobStatus || "waiting",
    landingType: input.landingType || "sample-insufficient",
    sourceType: input.sourceType || "eval",
    summary: String(input.summary || `Need ${Number(input.neededCount || 0)} more ${input.neededSampleType || "sample"} samples.`).trim(),
    createdAt,
    updatedAt: String(input.updatedAt || createdAt),
  });
  await appendLearningEvent(root, event);
  return event;
}

function validateRuleset(ruleset) {
  if (!ruleset || typeof ruleset !== "object") throw new Error("当前规则层结构不合法");
  if (!Array.isArray(ruleset.rules)) throw new Error("当前规则层缺少 rules 数组");
  const activeConflicts = new Set();
  for (const rule of ruleset.rules) {
    const normalizedRule = normalizeRule(rule);
    if (!normalizedRule) throw new Error("当前规则层规则字段不完整");
    if (!normalizedRule.ruleId || !normalizedRule.topicKey || !normalizedRule.conflictKey || !normalizedRule.capability || !normalizedRule.content || !normalizedRule.status) {
      throw new Error("当前规则层规则字段不完整");
    }
    if (!RULE_STATUSES.has(normalizedRule.status)) {
      throw new Error(`当前规则状态不合法：${normalizedRule.status}`);
    }
    if (normalizedRule.status === ACTIVE_STATUS) {
      if (activeConflicts.has(normalizedRule.conflictKey)) throw new Error(`同一冲突键存在多个生效规则：${normalizedRule.conflictKey}`);
      activeConflicts.add(normalizedRule.conflictKey);
    }
  }
}

function normalizeRuleset(ruleset = {}) {
  return {
    version: Number(ruleset.version || 0),
    lastGoodVersion: Number(ruleset.lastGoodVersion || ruleset.version || 0),
    updatedAt: String(ruleset.updatedAt || ""),
    rules: Array.isArray(ruleset.rules) ? ruleset.rules.map(normalizeRule) : [],
  };
}

function normalizePostCommitWarnings(warnings) {
  if (!Array.isArray(warnings)) return [];
  return warnings
    .map((warning) => {
      if (!warning || typeof warning !== "object") return null;
      const stage = String(warning.stage || "").trim();
      const message = String(warning.message || "").trim();
      const eventId = String(warning.eventId || "").trim();
      if (!stage || !message) return null;
      return {
        stage,
        eventId,
        message,
      };
    })
    .filter(Boolean);
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  try {
    const postCommitWarnings = normalizePostCommitWarnings(event.postCommitWarnings);
    return {
      ...normalizeLearningEvent(event),
      tokenUsage: normalizeUsage(event.tokenUsage),
      ...(postCommitWarnings.length ? { postCommitWarnings } : {}),
    };
  } catch {
    return null;
  }
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const topicKey = String(rule.topicKey || "").trim();
  const conflictKey = String(rule.conflictKey || topicKey).trim();
  return {
    ruleId: String(rule.ruleId || "").trim(),
    topicKey,
    conflictKey,
    capability: String(rule.capability || "").trim(),
    content: String(rule.content || "").trim(),
    priority: Number(rule.priority || 50),
    sourceEventIds: Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds.map(String) : [],
    status: String(rule.status || ACTIVE_STATUS).trim(),
    coveredByRuleId: String(rule.coveredByRuleId || "").trim(),
    createdAt: String(rule.createdAt || ""),
    updatedAt: String(rule.updatedAt || ""),
  };
}

function isSameTopicOrConflict(item, topicKey, conflictKey) {
  if (!item || typeof item !== "object") return false;
  const itemConflictKey = String(item.conflictKey || "").trim();
  const targetConflictKey = String(conflictKey || "").trim();
  if (itemConflictKey && targetConflictKey) {
    return itemConflictKey === targetConflictKey;
  }
  const itemTopicKey = String(item.topicKey || "").trim();
  const targetTopicKey = String(topicKey || "").trim();
  return Boolean(itemTopicKey && targetTopicKey && itemTopicKey === targetTopicKey);
}

function normalizeOptionalVersion(value) {
  if (value === undefined || value === null || value === "") return null;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`expectedVersion 不合法：${value}`);
  }
  return version;
}

function inferTopicKey(input = {}) {
  const explicitTopicKey = String(input.topicKey || "").trim();
  if (explicitTopicKey) return explicitTopicKey;
  const text = `${input.content || ""}\n${input.summary || ""}\n${input.rawTrigger || ""}`.toLowerCase();
  const capability = String(input.capability || "").toLowerCase();
  if (/分镜|storyboard/.test(text) || capability === "storyboard") {
    if (/单人台词|一个人物|一个角色|一名人物|一名角色|不允许多人|多人台词|多个人物|多个角色|speaker/.test(text)) return "storyboard.dialogue.speaker-count";
    if (/台词|对白|dialogue|字|长度|以内/.test(text)) return "storyboard.dialogue.length";
    if (/镜号/.test(text)) return "storyboard.shot.numbering";
    return "storyboard.general";
  }
  if (/剧本|script/.test(text) || capability === "script") return "script.general";
  return "general";
}

function inferConflictKey(input = {}, topicKey = "general") {
  const text = `${input.content || ""}\n${input.summary || ""}\n${input.rawTrigger || ""}`.toLowerCase();
  if (
    topicKey === "storyboard.dialogue.speaker-count" ||
    /单人台词|一个人物|一个角色|一名人物|一名角色|不允许多人|多人台词|多个人物|多个角色|speaker/.test(text)
  ) {
    return "storyboard.dialogue.speaker-count.single-speaker";
  }
  if (
    topicKey === "storyboard.dialogue.length" ||
    /台词|对白|dialogue/.test(text) && /字|长度|以内|超过|拆分/.test(text)
  ) {
    return "storyboard.dialogue.length.max-chars";
  }
  return String(topicKey || "general").trim() || "general";
}

function capabilityFromTopic(topicKey) {
  if (topicKey.startsWith("storyboard.")) return "storyboard";
  if (topicKey.startsWith("script.")) return "script";
  return "general";
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  return {
    prompt_tokens: Number(usage.prompt_tokens || 0),
    completion_tokens: Number(usage.completion_tokens || 0),
    total_tokens: Number(usage.total_tokens || 0),
  };
}

module.exports = {
  appendSampleInsufficientLearningEvent,
  appendLearningEvent,
  learnExplicitRule,
  listLearningEvents,
  normalizeRuleset,
  readCurrentRuleset,
  readLearningEventRecords,
  updateCurrentRuleStatus,
  validateRuleset,
  writeCurrentRuleset,
};
