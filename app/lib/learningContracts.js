const USER_DISPLAY_STATUSES = new Set(["已保存", "已影响生成", "待确认", "失败", "已被覆盖"]);
const LEARNING_MODES = new Set(["overall", "temporary", "evidence", "uncertain", "correction"]);
const INTERNAL_STATUSES = new Set(["received", "classified", "landed", "validated", "failed", "covered"]);
const JOB_STATUSES = new Set(["queued", "running", "completed", "failed", "waiting"]);

const LEGACY_STATUS_DEFAULTS = {
  处理中: { internalStatus: "received", jobStatus: "running" },
  已生效: { internalStatus: "landed", jobStatus: "completed", learningMode: "overall", landingType: "current-rule" },
  失败: { internalStatus: "failed", jobStatus: "failed" },
  已被覆盖: { internalStatus: "covered", jobStatus: "completed" },
  待确认: { internalStatus: "received", jobStatus: "waiting" },
  已保存: { internalStatus: "landed", jobStatus: "completed" },
  已影响生成: { internalStatus: "validated", jobStatus: "completed" },
};

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeLearningEvent(input = {}) {
  const eventId = normalizeString(input.eventId);
  if (!eventId) throw new Error("learning event requires eventId");

  const legacy = LEGACY_STATUS_DEFAULTS[normalizeString(input.status)] || {};
  const fallbackTimestamp = new Date().toISOString();
  const createdAt = normalizeString(input.createdAt || input.updatedAt || fallbackTimestamp);

  return {
    eventId,
    sourceEventIds: normalizeStringArray(input.sourceEventIds),
    landingIds: normalizeStringArray(input.landingIds),
    outputId: normalizeString(input.outputId),
    projectId: normalizeString(input.projectId),
    canvasId: normalizeString(input.canvasId),
    conversationId: normalizeString(input.conversationId),
    topicKey: normalizeString(input.topicKey) || "general",
    conflictKey: normalizeString(input.conflictKey) || normalizeString(input.topicKey) || "general",
    learningMode: LEARNING_MODES.has(input.learningMode) ? input.learningMode : legacy.learningMode || "uncertain",
    internalStatus: INTERNAL_STATUSES.has(input.internalStatus) ? input.internalStatus : legacy.internalStatus || "received",
    jobStatus: JOB_STATUSES.has(input.jobStatus) ? input.jobStatus : legacy.jobStatus || "queued",
    sourceType: normalizeString(input.sourceType),
    summary: normalizeString(input.summary),
    rawTrigger: normalizeString(input.rawTrigger),
    capability: normalizeString(input.capability),
    landingType: normalizeString(input.landingType) || legacy.landingType || "",
    ruleId: normalizeString(input.ruleId),
    coveredByEventId: normalizeString(input.coveredByEventId),
    error: input.error && typeof input.error === "object" ? input.error : null,
    createdAt,
    updatedAt: normalizeString(input.updatedAt || input.createdAt || createdAt),
  };
}

module.exports = {
  JOB_STATUSES,
  INTERNAL_STATUSES,
  LEARNING_MODES,
  USER_DISPLAY_STATUSES,
  normalizeLearningEvent,
};
