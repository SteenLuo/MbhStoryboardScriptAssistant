const {
  GENERATION_PROOF_STATUSES,
  normalizeGenerationProof,
  validateGenerationProofCombination,
} = require("./learningContracts");

const GENERATION_LANDING_TYPES = new Set(["formal-skill", "callable-skill", "skill-reference"]);
const SAVED_LANDING_TYPES = new Set([
  "current-rule",
  "sample",
  "evidence",
  "eval",
  "sample-pool",
  "skill-draft",
  "archive",
  "unlearnable",
]);
const WAITING_LANDING_TYPES = new Set([
  "sample-insufficient",
  "conflict",
  "correction-location-missing",
]);
const GENERATION_PASS_PROOF_STATUSES = new Set(["pending_first_hit", "participated", "validated"]);

function mapLearningDisplayRecord(event = {}, context = {}) {
  const displayStatus = resolveDisplayStatus(event);
  const affectsGeneration = displayStatus === "已影响生成";
  const actionLabel = resolveActionLabel(event, displayStatus);
  const generationProof = resolveGenerationProof(event, {
    affectsGeneration,
    displayStatus,
  });

  return {
    recordId: normalizeString(event.eventId || event.recordId || event.ruleId) || "learning-record",
    displayStatus,
    status: displayStatus === "待确认" && actionLabel === "待补样例" ? "待确认 / 待补样例" : displayStatus,
    actionLabel,
    affectsGeneration,
    generationImpactText: resolveGenerationImpactText(event, displayStatus, affectsGeneration),
    learnedText: normalizeDisplayText(event.summary || event.rawTrigger) || "未填写学习内容",
    sourceText: resolveSourceText(event),
    usedWhereText: resolveUsedWhereText(event, displayStatus),
    nextStepText: resolveNextStepText(event, displayStatus, actionLabel),
    generationProof,
    advanced: buildAdvanced(event, context),
  };
}

function resolveDisplayStatus(event) {
  const internalStatus = normalizeString(event.internalStatus);
  const jobStatus = normalizeString(event.jobStatus);
  const landingType = normalizeString(event.landingType);
  const learningMode = normalizeString(event.learningMode);

  if (internalStatus === "covered" || normalizeString(event.coveredByEventId)) return "已被覆盖";
  if (internalStatus === "failed" || jobStatus === "failed") return "失败";
  if (
    jobStatus === "queued" ||
    jobStatus === "running" ||
    jobStatus === "waiting" ||
    internalStatus === "received" ||
    internalStatus === "classified"
  ) {
    return "待确认";
  }
  if (
    (internalStatus === "validated" && (GENERATION_LANDING_TYPES.has(landingType) || !landingType)) ||
    (GENERATION_LANDING_TYPES.has(landingType) && (internalStatus === "landed" || jobStatus === "completed"))
  ) {
    return "已影响生成";
  }
  if (SAVED_LANDING_TYPES.has(landingType) && (internalStatus === "landed" || jobStatus === "completed")) {
    return "已保存";
  }
  if (
    jobStatus === "waiting" ||
    WAITING_LANDING_TYPES.has(landingType) ||
    learningMode === "uncertain" ||
    learningMode === "correction" ||
    internalStatus === "received" ||
    internalStatus === "classified" ||
    jobStatus === "queued" ||
    jobStatus === "running"
  ) {
    return "待确认";
  }
  if (SAVED_LANDING_TYPES.has(landingType) || internalStatus === "landed" || jobStatus === "completed") {
    return "已保存";
  }
  return "待确认";
}

function resolveActionLabel(event, displayStatus) {
  const landingType = normalizeString(event.landingType);
  const learningMode = normalizeString(event.learningMode);

  if (displayStatus === "失败") return "待纠正";
  if (displayStatus !== "待确认") return "不用管";
  if (landingType === "sample-insufficient") return "待补样例";
  if (landingType === "correction-location-missing" || learningMode === "correction") return "待纠正";
  if (landingType === "archive") return "待归档";
  return "待确认是否长期";
}

function resolveGenerationProof(event, state) {
  const suppliedProof = normalizeGenerationProof(event.generationProof) || {};
  const suppliedProofStatus = normalizeString(suppliedProof.proofStatus);
  let proofStatus = GENERATION_PROOF_STATUSES.has(suppliedProofStatus)
    ? suppliedProofStatus
    : defaultProofStatus(state);
  let claimText = normalizeString(suppliedProof.claimText) ||
    defaultProofClaim(proofStatus, state.displayStatus, state.affectsGeneration);

  if (!state.affectsGeneration && GENERATION_PASS_PROOF_STATUSES.has(proofStatus)) {
    proofStatus = "not_applicable";
    claimText = "这条学习现在只作为资料沉淀，不参与当前生成。";
  }

  if (proofStatus === "unknown" && state.affectsGeneration && !hasUnknownProofWarning(claimText)) {
    claimText = "当前仍会影响生成，证据不完整需排查。";
  }

  validateGenerationProofCombination({
    displayStatus: state.displayStatus,
    affectsGeneration: state.affectsGeneration,
    proofStatus,
    claimText,
  });

  return {
    ...suppliedProof,
    proofStatus,
    claimText,
  };
}

function defaultProofStatus(state) {
  if (state.displayStatus === "失败") return "failed";
  if (state.affectsGeneration) return "pending_first_hit";
  return "not_applicable";
}

function defaultProofClaim(proofStatus, displayStatus, affectsGeneration) {
  if (proofStatus === "pending_first_hit") {
    return "已进入生成读取层，会参与后续生成；硬规则是否执行成功要看输出后校验。";
  }
  if (proofStatus === "participated") return "已参与生成；硬规则仍需查看输出后校验结果。";
  if (proofStatus === "validated") return "已在生成中命中，并且输出后校验通过。";
  if (proofStatus === "failed") return "学习落地失败，不能作为正常生成证据。";
  if (proofStatus === "unknown" && affectsGeneration) return "当前仍会影响生成，证据不完整需排查。";
  if (proofStatus === "unknown") return "证据状态未知，但当前不会直接影响生成。";
  if (displayStatus === "已被覆盖") return "已被后续学习覆盖，不再需要生成命中证据。";
  return "这个学习没有进入生成落点，不需要生成命中证据。";
}

function hasUnknownProofWarning(claimText) {
  return claimText.includes("仍会影响生成") && claimText.includes("证据不完整");
}

function resolveGenerationImpactText(event, displayStatus, affectsGeneration) {
  const landingType = normalizeString(event.landingType);
  if (affectsGeneration) {
    if (landingType === "skill-reference") return "已写入分镜 skill 学习沉淀；下一次分镜生成会读取。";
    return "会被后续生成读取；是否执行成功要看本次输出校验和命中证据。";
  }
  if (displayStatus === "失败") return "学习未落地，不会影响生成。";
  if (displayStatus === "已被覆盖") return "已被后续学习覆盖，不再影响生成。";
  if (displayStatus === "待确认") return "尚未确认长期落点，暂不会直接改变生成。";
  if (landingType === "current-rule") return "历史学习资料，不会影响生成；当前生成只读取分镜 skill。";
  return "已保存为学习资料，不会直接改变生成。";
}

function resolveSourceText(event) {
  const sourceType = normalizeString(event.sourceType);
  const sourceLabels = {
    conversation: "对话",
    manual: "手动录入",
    sample: "样例",
    file: "文件",
    archive: "归档",
    conversation_record: "对话归档",
  };
  const label = sourceLabels[sourceType] || "来源未标明";
  const sourceId = normalizeString(event.conversationId || event.projectId || event.canvasId || event.outputId);
  return sourceId ? `${label}：${sourceId}` : label;
}

function resolveUsedWhereText(event, displayStatus) {
  if (displayStatus === "已被覆盖") {
    const coveredBy = normalizeString(event.coveredByEventId);
    return coveredBy ? `已被后续学习覆盖：${coveredBy}` : "已被后续学习覆盖。";
  }
  if (displayStatus === "失败") return "未落地到生成流程。";

  const landingType = normalizeString(event.landingType);
  if (displayStatus === "已影响生成") {
    if (landingType === "formal-skill") return "正式技能：后续生成会读取。";
    if (landingType === "callable-skill") return "可调用技能：后续生成可按路由使用。";
    if (landingType === "skill-reference") return "分镜 skill 学习沉淀：后续分镜生成会读取。";
    return "生成流程：后续生成会读取。";
  }
  if (displayStatus === "待确认") return "尚未落地。";
  if (landingType === "current-rule") return "学习资料库：历史学习资料。";
  return "学习资料库。";
}

function resolveNextStepText(event, displayStatus, actionLabel) {
  const landingType = normalizeString(event.landingType);
  if (displayStatus === "失败") return "请修正学习内容或落点后重试。";
  if (displayStatus === "已影响生成" && landingType === "skill-reference") return "下一次分镜生成会读取；如果结果不对，请从学习资料库带引用纠正。";
  if (displayStatus === "已影响生成") return "后续生成会读取；若本次输出违规，必须自动修复或记录失败，不能静默交付。";
  if (displayStatus === "已被覆盖") return "无需处理，查看覆盖它的新学习即可。";
  if (displayStatus === "已保存" && landingType === "current-rule") return "无需处理；如果这条仍要影响生成，请用技能学习重新沉淀到分镜 skill。";
  if (displayStatus === "已保存") return "无需处理，可在需要时作为资料回看。";
  if (landingType === "sample-insufficient") {
    const neededSampleType = normalizeString(event.neededSampleType) || "同类样例";
    const neededCount = Number(event.neededCount || 0);
    const relatedRecordIds = normalizeStringArray(event.relatedRecordIds);
    const relatedText = relatedRecordIds.length ? `；关联记录：${relatedRecordIds.join("、")}` : "";
    return `待补样例：${neededSampleType}，还需要补充 ${neededCount} 条${relatedText}。补齐后重新生成评测任务，不会直接影响生成。`;
  }
  if (actionLabel === "待纠正") return "请补充正确的纠正位置或重新发起学习。";
  if (actionLabel === "待归档") return "确认资料价值后归档到合适位置。";
  return "确认它是否应成为长期规则、样例或仅归档资料。";
}

function buildAdvanced(event, context) {
  const advanced = {
    eventId: normalizeString(event.eventId),
    status: normalizeString(event.status),
    sourceEventIds: normalizeStringArray(event.sourceEventIds),
    landingIds: normalizeStringArray(event.landingIds),
    outputId: normalizeString(event.outputId),
    projectId: normalizeString(event.projectId),
    canvasId: normalizeString(event.canvasId),
    conversationId: normalizeString(event.conversationId),
    topicKey: normalizeString(event.topicKey),
    conflictKey: normalizeString(event.conflictKey),
    learningMode: normalizeString(event.learningMode),
    internalStatus: normalizeString(event.internalStatus),
    jobStatus: normalizeString(event.jobStatus),
    sourceType: normalizeString(event.sourceType),
    summary: normalizeDisplayText(event.summary),
    rawTrigger: normalizeDisplayText(event.rawTrigger),
    capability: normalizeString(event.capability),
    landingType: normalizeString(event.landingType),
    ruleId: normalizeString(event.ruleId),
    coveredByEventId: normalizeString(event.coveredByEventId),
    error: normalizeDisplayError(event.error),
    tokenUsage: event.tokenUsage && typeof event.tokenUsage === "object" ? event.tokenUsage : null,
    neededSampleType: normalizeString(event.neededSampleType),
    neededCount: Number(event.neededCount || 0),
    relatedRecordIds: normalizeStringArray(event.relatedRecordIds),
    skillRulesUsedRefs: normalizeStringArray(event.skillRulesUsedRefs),
    sampleCount: Number(event.sampleCount || 0),
    sampleRecordIds: normalizeStringArray(event.sampleRecordIds),
    evidenceRecordIds: normalizeStringArray(event.evidenceRecordIds),
    reevaluationTaskId: normalizeString(event.reevaluationTaskId),
    createdAt: normalizeString(event.createdAt),
    updatedAt: normalizeString(event.updatedAt),
  };

  if (context && typeof context === "object" && Object.keys(context).length) {
    advanced.context = context;
  }

  return advanced;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeDisplayText(value) {
  const text = normalizeString(value);
  if (!text) return "";
  return text
    .replace(/分镜输出违反稳定分镜技能硬规则，自动修正后仍失败。?/g, "分镜输出未按稳定分镜 skill 硬规则生成，已拦截。")
    .replace(/分镜输出违反已影响生成的硬规则，自动修正后仍失败。?/g, "分镜输出未按稳定分镜 skill 硬规则生成，已拦截。")
    .replace(/自动台词拆分后仍存在硬规则违规。?/g, "生成结果仍存在硬规则违规，未交付为可用分镜。")
    .replace(/自动修正失败/g, "校验失败");
}

function normalizeDisplayError(error) {
  if (!error || typeof error !== "object") return null;
  return normalizeDisplayErrorValue(error);
}

function normalizeDisplayErrorValue(value) {
  if (Array.isArray(value)) return value.map(normalizeDisplayErrorValue);
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "currentRulesUsedRefs" || key === "currentRulesUsed") continue;
      next[key] = normalizeDisplayErrorValue(child);
    }
    return next;
  }
  return typeof value === "string" ? normalizeDisplayText(value) : value;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : "";
}

module.exports = {
  mapLearningDisplayRecord,
};
