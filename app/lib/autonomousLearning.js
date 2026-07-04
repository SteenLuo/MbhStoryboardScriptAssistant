const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
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

async function learnExplicitRule(root, input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idSource = options.idSource || (() => `learn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const createdAt = now();
  const eventId = input.eventId || idSource();
  const topicKey = inferTopicKey(input);
  const baseEvent = {
    eventId,
    topicKey,
    sourceType: input.sourceType || "conversation",
    projectId: input.projectId || "",
    canvasId: input.canvasId || "",
    conversationId: input.conversationId || "",
    status: "处理中",
    summary: String(input.summary || "").trim(),
    rawTrigger: String(input.rawTrigger || "").trim(),
    capability: String(input.capability || "").trim() || capabilityFromTopic(topicKey),
    tokenUsage: normalizeUsage(input.tokenUsage),
    createdAt,
    updatedAt: createdAt,
  };
  await appendLearningEvent(root, baseEvent);

  try {
    const content = baseEvent.summary.trim();
    if (!content) throw new Error("规则内容为空，无法发布到当前规则层");

    const ruleset = await readCurrentRuleset(root);
    const existingEvents = await listLearningEvents(root, { includeCovered: true });
    const publishTime = now();
    const newRuleId = `rule-${eventId}`;
    const nextRules = (ruleset.rules || []).map((rule) =>
      rule.topicKey === topicKey && [ACTIVE_STATUS, DISABLED_STATUS].includes(rule.status)
        ? { ...rule, status: COVERED_STATUS, coveredByRuleId: newRuleId, updatedAt: publishTime }
        : rule
    );
    const coveredEvents = existingEvents.filter((event) =>
      event.eventId !== eventId &&
      event.topicKey === topicKey &&
      !["已被覆盖", "失败"].includes(event.status)
    );

    for (const event of [
      ...coveredEvents,
      ...existingEvents.filter((item) =>
        item.eventId !== eventId &&
        item.topicKey === topicKey &&
        item.status === "失败" &&
        !coveredEvents.some((covered) => covered.eventId === item.eventId)
      ),
    ]) {
      await appendLearningEvent(root, {
        ...event,
        status: "已被覆盖",
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
    await writeCurrentRuleset(root, nextRuleset);

    const event = {
      ...baseEvent,
      status: "已生效",
      ruleId: newRuleId,
      updatedAt: publishTime,
    };
    await appendLearningEvent(root, event);
    return { event, ruleset: nextRuleset };
  } catch (error) {
    const failedAt = now();
    const event = {
      ...baseEvent,
      status: "失败",
      error: {
        stage: "publish-current-ruleset",
        code: "RULESET_PUBLISH_FAILED",
        message: error.message || String(error),
      },
      updatedAt: failedAt,
    };
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
  const file = rulesetFile(root);
  if (!fs.existsSync(file)) {
    return { version: 0, lastGoodVersion: 0, updatedAt: "", rules: [] };
  }
  try {
    const parsed = JSON.parse(await fsp.readFile(file, "utf8"));
    const ruleset = {
      version: Number(parsed.version || 0),
      lastGoodVersion: Number(parsed.lastGoodVersion || parsed.version || 0),
      updatedAt: String(parsed.updatedAt || ""),
      rules: Array.isArray(parsed.rules) ? parsed.rules.map(normalizeRule).filter(Boolean) : [],
    };
    validateRuleset(ruleset);
    return ruleset;
  } catch {
    return { version: 0, lastGoodVersion: 0, updatedAt: "", rules: [] };
  }
}

async function writeCurrentRuleset(root, ruleset) {
  validateRuleset(ruleset);
  const file = rulesetFile(root);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(ruleset, null, 2), "utf8");
}

async function updateCurrentRuleStatus(root, input = {}, options = {}) {
  const ruleId = String(input.ruleId || "").trim();
  const nextStatus = String(input.status || "").trim();
  const now = options.now || (() => new Date().toISOString());

  if (!ruleId) throw new Error("规则编号不能为空");
  if (![ACTIVE_STATUS, DISABLED_STATUS].includes(nextStatus)) {
    throw new Error("当前规则只允许启用或停用");
  }

  const ruleset = await readCurrentRuleset(root);
  const rule = (ruleset.rules || []).find((item) => item.ruleId === ruleId);
  if (!rule) throw new Error(`当前规则不存在：${ruleId}`);
  if (rule.status === COVERED_STATUS || rule.coveredByRuleId) {
    throw new Error("已被覆盖的规则不能直接启用或停用");
  }
  if (![ACTIVE_STATUS, DISABLED_STATUS].includes(rule.status)) {
    throw new Error(`当前规则状态不允许切换：${rule.status}`);
  }

  if (nextStatus === ACTIVE_STATUS) {
    const activeSameTopic = (ruleset.rules || []).find((item) =>
      item.ruleId !== ruleId && item.topicKey === rule.topicKey && item.status === ACTIVE_STATUS
    );
    if (activeSameTopic) {
      throw new Error(`同一主题已存在启用规则：${rule.topicKey}`);
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
  await writeCurrentRuleset(root, nextRuleset);

  return {
    rule: nextRuleset.rules.find((item) => item.ruleId === ruleId),
    ruleset: nextRuleset,
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
    .filter((event) => options.includeCovered || event.status !== "已被覆盖")
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
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.appendFile(file, `${JSON.stringify(normalizeEvent(event))}\n`, "utf8");
}

function validateRuleset(ruleset) {
  if (!ruleset || typeof ruleset !== "object") throw new Error("当前规则层结构不合法");
  if (!Array.isArray(ruleset.rules)) throw new Error("当前规则层缺少 rules 数组");
  const activeTopics = new Set();
  for (const rule of ruleset.rules) {
    if (!rule.ruleId || !rule.topicKey || !rule.capability || !rule.content || !rule.status) {
      throw new Error("当前规则层规则字段不完整");
    }
    if (!RULE_STATUSES.has(rule.status)) {
      throw new Error(`当前规则状态不合法：${rule.status}`);
    }
    if (rule.status === ACTIVE_STATUS) {
      if (activeTopics.has(rule.topicKey)) throw new Error(`同一主题存在多个生效规则：${rule.topicKey}`);
      activeTopics.add(rule.topicKey);
    }
  }
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const eventId = String(event.eventId || "").trim();
  if (!eventId) return null;
  return {
    eventId,
    topicKey: String(event.topicKey || "general").trim(),
    sourceType: String(event.sourceType || "").trim(),
    projectId: String(event.projectId || "").trim(),
    canvasId: String(event.canvasId || "").trim(),
    conversationId: String(event.conversationId || "").trim(),
    status: String(event.status || "处理中").trim(),
    summary: String(event.summary || "").trim(),
    rawTrigger: String(event.rawTrigger || "").trim(),
    capability: String(event.capability || "").trim(),
    tokenUsage: normalizeUsage(event.tokenUsage),
    ruleId: String(event.ruleId || "").trim(),
    coveredByEventId: String(event.coveredByEventId || "").trim(),
    error: event.error && typeof event.error === "object" ? event.error : null,
    createdAt: String(event.createdAt || event.updatedAt || new Date().toISOString()),
    updatedAt: String(event.updatedAt || event.createdAt || new Date().toISOString()),
  };
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  return {
    ruleId: String(rule.ruleId || "").trim(),
    topicKey: String(rule.topicKey || "").trim(),
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
  readCurrentRuleset,
  readLearningEventRecords,
  updateCurrentRuleStatus,
  validateRuleset,
  writeCurrentRuleset,
};
