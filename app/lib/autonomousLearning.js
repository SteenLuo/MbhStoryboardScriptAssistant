const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { normalizeLearningEvent } = require("./learningContracts");

function learningDir(root) {
  return path.join(root, "learning");
}

function eventsFile(root) {
  return path.join(learningDir(root), "events.jsonl");
}

async function learnExplicitRule(root, input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idSource = options.idSource || (() => `learn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const createdAt = String(input.createdAt || now());
  const eventId = String(input.eventId || idSource()).trim();
  const topicKey = inferTopicKey(input);
  const conflictKey = Object.hasOwn(input, "conflictKey")
    ? String(input.conflictKey || "").trim() || topicKey
    : inferConflictKey(input, topicKey);

  if (shouldWaitForEvaluationSamples(input)) {
    const event = await appendSampleInsufficientLearningEvent(root, {
      ...input,
      eventId,
      topicKey,
      conflictKey,
      sourceType: input.sourceType || "conversation",
      capability: String(input.capability || "").trim() || capabilityFromTopic(topicKey),
      summary: String(input.summary || input.rawTrigger || input.content || "").trim(),
      createdAt,
      updatedAt: createdAt,
    }, { now });
    return { event };
  }

  const event = normalizeEvent({
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
    internalStatus: "landed",
    jobStatus: "completed",
    landingType: input.landingType || "learning-record",
    summary: String(input.summary || input.content || input.rawTrigger || "").trim(),
    rawTrigger: String(input.rawTrigger || "").trim(),
    capability: String(input.capability || "").trim() || capabilityFromTopic(topicKey),
    tokenUsage: normalizeUsage(input.tokenUsage),
    createdAt,
    updatedAt: createdAt,
  });
  await appendLearningEvent(root, event);
  return { event };
}

function shouldWaitForEvaluationSamples(input = {}) {
  return Boolean(
    input.requiresEvaluation === true &&
    String(input.neededSampleType || "").trim() &&
    Number(input.neededCount || 0) > 0
  );
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

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  try {
    const normalized = normalizeLearningEvent(event);
    return {
      ...normalized,
      tokenUsage: normalizeUsage(event.tokenUsage),
    };
  } catch {
    return null;
  }
}

function inferTopicKey(input = {}) {
  const explicitTopicKey = String(input.topicKey || "").trim();
  if (explicitTopicKey) return explicitTopicKey;
  const text = `${input.content || ""}\n${input.summary || ""}\n${input.rawTrigger || ""}`.toLowerCase();
  const capability = String(input.capability || "").toLowerCase();
  if (/分镜|storyboard/.test(text) || capability === "storyboard") {
    if (/台词|对白|dialogue/.test(text) && /一行|多行|第二行|line-count/.test(text)) return "storyboard.dialogue.line-count";
    if (/单人台词|一个人物|一个角色|一名人物|一名角色|不允许多人|多人台词|多个人物|多个角色|speaker/.test(text)) {
      return "storyboard.dialogue.speaker-count";
    }
    if (/台词|对白|dialogue/.test(text) && /20|二十|字|长度|超过|超出|chars/.test(text)) return "storyboard.dialogue.length";
    if (/镜号/.test(text)) return "storyboard.shot.numbering";
    return "storyboard.general";
  }
  if (/剧本|script/.test(text) || capability === "script") return "script.general";
  return "general";
}

function inferConflictKey(input = {}, topicKey = "general") {
  const text = `${input.content || ""}\n${input.summary || ""}\n${input.rawTrigger || ""}`.toLowerCase();
  if (topicKey === "storyboard.dialogue.line-count") return "storyboard.dialogue.line-count";
  if (
    topicKey === "storyboard.dialogue.speaker-count" ||
    /单人台词|一个人物|一个角色|一名人物|一名角色|不允许多人|多人台词|多个人物|多个角色|speaker/.test(text)
  ) {
    return "storyboard.dialogue.speaker-count.single-speaker";
  }
  if (
    topicKey === "storyboard.dialogue.length" ||
    (/台词|对白|dialogue/.test(text) && /20|二十|字|长度|超过|超出|chars/.test(text))
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
  readLearningEventRecords,
};
