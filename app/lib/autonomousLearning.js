const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { normalizeLearningEvent } = require("./learningContracts");
const { addNotification, withdrawNotificationsForSource } = require("./notifications");

const ACTIVE_STATUS = "active";
const DISABLED_STATUS = "disabled";
const COVERED_STATUS = "covered";
const RULE_STATUSES = new Set([ACTIVE_STATUS, DISABLED_STATUS, COVERED_STATUS]);

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

async function learnExplicitRule(root, input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idSource = options.idSource || (() => `learn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const createdAt = now();
  const eventId = input.eventId || idSource();
  const topicKey = inferTopicKey(input);
  const conflictKey = Object.hasOwn(input, "conflictKey")
    ? String(input.conflictKey || "").trim()
    : topicKey;
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

  try {
    const content = String(input.content || baseEvent.summary).trim();
    if (baseEvent.learningMode !== "overall") {
      throw new Error(`只有 learningMode=overall 可以发布到当前规则层：${baseEvent.learningMode}`);
    }
    if (!content) throw new Error("规则内容为空，无法发布到当前规则层");
    if (!conflictKey) throw new Error("conflictKey 不能为空，无法发布到当前规则层");

    const ruleset = await readCurrentRulesetStrict(root);
    const expectedVersion = normalizeOptionalVersion(
      Object.hasOwn(input, "expectedVersion") ? input.expectedVersion : options.expectedVersion,
    );
    if (expectedVersion !== null && expectedVersion !== Number(ruleset.version || 0)) {
      throw new Error(`expectedVersion 不匹配：当前版本 ${Number(ruleset.version || 0)}，收到 ${expectedVersion}`);
    }
    const existingEvents = await listLearningEvents(root, { includeCovered: true });
    const publishTime = now();
    const newRuleId = `rule-${eventId}`;
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

    for (const event of [
      ...coveredEvents,
      ...existingEvents.filter((item) =>
        item.eventId !== eventId &&
        isSameTopicOrConflict(item, topicKey, conflictKey) &&
        item.internalStatus === "failed" &&
        !coveredEvents.some((covered) => covered.eventId === item.eventId)
      ),
    ]) {
      await appendLearningEvent(root, {
        ...event,
        internalStatus: "covered",
        jobStatus: "completed",
        coveredByEventId: eventId,
        updatedAt: publishTime,
      });
      await withdrawNotificationsForSource(root, "learning-event", event.eventId, {
        handledAt: publishTime,
      });
    }

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

    const event = normalizeEvent({
      ...baseEvent,
      internalStatus: "landed",
      jobStatus: "completed",
      landingType: "current-rule",
      landingIds: [newRuleId],
      ruleId: newRuleId,
      updatedAt: publishTime,
    });
    await appendLearningEvent(root, event);
    return { event, ruleset: writtenRuleset };
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
  const file = rulesetFile(root);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(normalized, null, 2), "utf8");
  await writeRulesetSnapshot(root, normalized);
  return normalized;
}

async function writeRulesetSnapshot(root, ruleset) {
  const version = Number(ruleset.version || 0);
  if (!version) return null;
  const snapshot = {
    version,
    lastGoodVersion: Number(ruleset.lastGoodVersion || version),
    createdAt: String(ruleset.updatedAt || ruleset.createdAt || new Date().toISOString()),
    sourceEventIds: collectSourceEventIds(ruleset.rules),
    rules: ruleset.rules,
  };
  const file = rulesetSnapshotFile(root, version);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
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
      throw new Error(`同一主题已存在启用规则或同一冲突键已存在启用规则：${rule.topicKey} / ${rule.conflictKey}`);
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
}

function validateRuleset(ruleset) {
  if (!ruleset || typeof ruleset !== "object") throw new Error("当前规则层结构不合法");
  if (!Array.isArray(ruleset.rules)) throw new Error("当前规则层缺少 rules 数组");
  const activeTopics = new Set();
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
      if (activeTopics.has(normalizedRule.topicKey)) throw new Error(`同一主题存在多个生效规则：${normalizedRule.topicKey}`);
      if (activeConflicts.has(normalizedRule.conflictKey)) throw new Error(`同一冲突键存在多个生效规则：${normalizedRule.conflictKey}`);
      activeTopics.add(normalizedRule.topicKey);
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

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  try {
    return {
      ...normalizeLearningEvent(event),
      tokenUsage: normalizeUsage(event.tokenUsage),
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
  return String(item.topicKey || "") === topicKey || String(item.conflictKey || "") === conflictKey;
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
  const text = `${input.summary || ""}\n${input.rawTrigger || ""}`.toLowerCase();
  const capability = String(input.capability || "").toLowerCase();
  if (/分镜|storyboard/.test(text) || capability === "storyboard") {
    if (/台词|对白|dialogue|字|长度|以内/.test(text)) return "storyboard.dialogue.length";
    if (/镜号/.test(text)) return "storyboard.shot.numbering";
    return "storyboard.general";
  }
  if (/剧本|script/.test(text) || capability === "script") return "script.general";
  return "general";
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
