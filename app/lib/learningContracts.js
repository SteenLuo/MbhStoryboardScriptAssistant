const USER_DISPLAY_STATUSES = new Set(["已保存", "已影响生成", "待确认", "失败", "已被覆盖"]);
const LEARNING_MODES = new Set(["overall", "temporary", "evidence", "uncertain", "correction"]);
const INTERNAL_STATUSES = new Set(["received", "classified", "landed", "validated", "failed", "covered"]);
const JOB_STATUSES = new Set(["queued", "running", "completed", "failed", "waiting"]);
const GENERATION_PROOF_STATUSES = new Set([
  "not_applicable",
  "pending_first_hit",
  "participated",
  "validated",
  "failed",
  "unknown",
]);
const GENERATION_PASS_PROOF_STATUSES = new Set(["pending_first_hit", "participated", "validated"]);
const GENERATION_PROOF_STRING_FIELDS = [
  "proofStatus",
  "claimText",
  "lastCheckedOutputId",
  "lastCheckedAt",
];
const GENERATION_PROOF_ARRAY_FIELDS = [
  "currentRulesUsedRefs",
  "skillRulesUsedRefs",
  "validationResultRefs",
  "failureEventIds",
];

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
  return Array.isArray(value)
    ? value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => String(item).trim())
      .filter(Boolean)
    : [];
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
    generationProof: normalizeGenerationProof(input.generationProof),
    neededSampleType: normalizeString(input.neededSampleType),
    neededCount: normalizeNonNegativeInteger(input.neededCount),
    relatedRecordIds: normalizeStringArray(input.relatedRecordIds),
    currentRulesUsedRefs: normalizeStringArray(input.currentRulesUsedRefs),
    skillRulesUsedRefs: normalizeStringArray(input.skillRulesUsedRefs),
    sampleCount: normalizeNonNegativeInteger(input.sampleCount),
    sampleRecordIds: normalizeStringArray(input.sampleRecordIds),
    evidenceRecordIds: normalizeStringArray(input.evidenceRecordIds),
    reevaluationTaskId: normalizeString(input.reevaluationTaskId),
    evalTaskId: normalizeString(input.evalTaskId),
    evalResultId: normalizeString(input.evalResultId),
    skillId: normalizeString(input.skillId),
    sampleId: normalizeString(input.sampleId),
    evidenceId: normalizeString(input.evidenceId),
    createdAt,
    updatedAt: normalizeString(input.updatedAt || input.createdAt || createdAt),
  };
}

function normalizeNonNegativeInteger(value) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function normalizeGenerationProof(proof) {
  if (!proof || typeof proof !== "object") return null;
  const normalized = {};

  for (const field of GENERATION_PROOF_STRING_FIELDS) {
    const value = normalizeString(proof[field]);
    if (value) normalized[field] = value;
  }
  for (const field of GENERATION_PROOF_ARRAY_FIELDS) {
    if (!Object.hasOwn(proof, field)) continue;
    normalized[field] = normalizeStringArray(proof[field]);
  }

  return Object.keys(normalized).length ? normalized : null;
}

function validateGenerationProofCombination(input = {}) {
  const displayStatus = normalizeString(input.displayStatus);
  const affectsGeneration = input.affectsGeneration === true;
  const proofStatus = normalizeString(input.proofStatus) || "unknown";
  const claimText = normalizeString(input.claimText);

  if (!USER_DISPLAY_STATUSES.has(displayStatus)) {
    throw new Error(`displayStatus 不合法：${displayStatus}`);
  }
  if (!GENERATION_PROOF_STATUSES.has(proofStatus)) {
    throw new Error(`generation proof status 不合法：${proofStatus}`);
  }
  if (proofStatus === "not_applicable" && affectsGeneration) {
    throw new Error("not_applicable 不能和 affectsGeneration=true 同时出现");
  }
  if (GENERATION_PASS_PROOF_STATUSES.has(proofStatus)) {
    if (displayStatus !== "已影响生成" || !affectsGeneration) {
      throw new Error(`${proofStatus} 必须对应 displayStatus=已影响生成 且 affectsGeneration=true`);
    }
  }
  if (proofStatus === "failed" && displayStatus === "已影响生成") {
    throw new Error("failed proof 不能显示为正常 已影响生成");
  }
  if (proofStatus === "unknown" && affectsGeneration) {
    if (!claimText.includes("仍会影响生成") || !claimText.includes("证据不完整")) {
      throw new Error("unknown proof 影响生成时必须用新手可读文案说明仍会影响生成且证据不完整");
    }
  }

  return true;
}

module.exports = {
  GENERATION_PROOF_STATUSES,
  JOB_STATUSES,
  INTERNAL_STATUSES,
  LEARNING_MODES,
  USER_DISPLAY_STATUSES,
  normalizeGenerationProof,
  normalizeLearningEvent,
  validateGenerationProofCombination,
};
