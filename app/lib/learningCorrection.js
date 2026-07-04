const { mapLearningDisplayRecord } = require("./learningStatusMapper");

const PRIMARY_LOCATOR_FIELDS = ["recordId", "eventId", "sourceEventIds", "landingIds", "outputId"];
const AUXILIARY_CONTEXT_FIELDS = ["projectId", "canvasId", "conversationId", "topicKey", "conflictKey", "learningMode"];
const DISABLED_REASON = "需要你补充是哪条记录：当前只有项目、画布、对话等上下文，无法安全定位要纠正的学习记录。";

const DEFAULT_CORRECTION_TEXTS = Object.freeze({
  override: "这条学错了，请按这次说明覆盖。",
  temporary: "这条只适用于这次，不要作为长期规则。",
  disable: "这条先停用，后续我再补说明。",
  narrow: "这条范围太大，请收窄成我这次说的范围。",
});

const CORRECTION_ACTIONS = Object.freeze([
  { action: "override", label: "覆盖纠正", defaultText: DEFAULT_CORRECTION_TEXTS.override },
  { action: "temporary", label: "仅本次适用", defaultText: DEFAULT_CORRECTION_TEXTS.temporary },
  { action: "disable", label: "先停用", defaultText: DEFAULT_CORRECTION_TEXTS.disable },
  { action: "narrow", label: "收窄范围", defaultText: DEFAULT_CORRECTION_TEXTS.narrow },
]);

function buildCorrectionAction(record = {}, options = {}) {
  const action = normalizeAction(options.action);
  const payload = buildCorrectionPayload(record);
  const enabled = hasPrimaryLocator(payload);
  return {
    enabled,
    disabledReason: enabled ? "" : DISABLED_REASON,
    payload,
    defaultText: DEFAULT_CORRECTION_TEXTS[action] || DEFAULT_CORRECTION_TEXTS.override,
    action,
    actions: CORRECTION_ACTIONS,
  };
}

function buildCorrectionPayload(record = {}) {
  const advanced = record.advanced && typeof record.advanced === "object" ? record.advanced : {};
  const landingIds = uniqueStrings([
    ...arrayValue(record.landingIds),
    ...arrayValue(advanced.landingIds),
    stringValue(record.ruleId),
    stringValue(advanced.ruleId),
  ]);
  return {
    recordId: usableRecordId(record.recordId),
    eventId: stringValue(record.eventId || advanced.eventId),
    sourceEventIds: uniqueStrings([...arrayValue(record.sourceEventIds), ...arrayValue(advanced.sourceEventIds)]),
    landingIds,
    outputId: stringValue(record.outputId || advanced.outputId),
    projectId: stringValue(record.projectId || advanced.projectId),
    canvasId: stringValue(record.canvasId || advanced.canvasId),
    conversationId: stringValue(record.conversationId || advanced.conversationId),
    topicKey: stringValue(record.topicKey || advanced.topicKey),
    conflictKey: stringValue(record.conflictKey || advanced.conflictKey),
    learningMode: stringValue(record.learningMode || advanced.learningMode),
    scope: stringValue(record.scope || advanced.scope) || "overall",
    ruleId: stringValue(record.ruleId || advanced.ruleId),
  };
}

function buildLearningCorrectionEvent(input = {}) {
  const action = normalizeAction(input.action);
  const source = input.record ? input.record : { ...input.payload };
  const correctionAction = buildCorrectionAction(source, { action });
  const payload = correctionAction.payload;
  const now = input.now || (() => new Date().toISOString());
  const idSource = input.idSource || (() => `correction-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const createdAt = now();
  const summary = stringValue(input.message) || correctionAction.defaultText;
  const event = {
    eventId: stringValue(input.eventId) || idSource(),
    sourceEventIds: uniqueStrings([payload.eventId, ...payload.sourceEventIds]),
    landingIds: payload.landingIds,
    outputId: payload.outputId,
    projectId: payload.projectId,
    canvasId: payload.canvasId,
    conversationId: payload.conversationId,
    topicKey: payload.topicKey || "general",
    conflictKey: payload.conflictKey || payload.topicKey || "general",
    learningMode: "correction",
    internalStatus: "received",
    jobStatus: "waiting",
    sourceType: "correction",
    landingType: correctionAction.enabled ? "correction" : "correction-location-missing",
    summary,
    rawTrigger: summary,
    relatedRecordIds: payload.recordId ? [payload.recordId] : [],
    currentRulesUsedRefs: findCorrectionRuleId(payload) ? [findCorrectionRuleId(payload)] : [],
    createdAt,
    updatedAt: createdAt,
  };
  return {
    enabled: correctionAction.enabled,
    action,
    payload,
    disabledReason: correctionAction.disabledReason,
    defaultText: correctionAction.defaultText,
    event,
    record: mapCorrectionRecord(event, correctionAction),
  };
}

async function applyLearningCorrectionRequest(root, body = {}, deps = {}) {
  const correction = buildLearningCorrectionEvent({
    record: body.record,
    payload: body.payload,
    action: body.action,
    message: body.message,
    now: deps.now,
    idSource: deps.idSource,
  });
  await deps.appendLearningEvent(root, correction.event);

  const response = {
    ok: true,
    correctionEvent: correction.event,
    record: correction.record,
    disabledReason: correction.disabledReason,
    disableResult: null,
    warning: "",
  };

  if (!correction.enabled) {
    response.record = {
      ...correction.record,
      displayStatus: "待确认",
      status: "待确认",
      actionLabel: "待纠正",
      nextStepText: correction.disabledReason || "需要你补充是哪条记录。",
    };
    response.message = "已记录纠正说明，但需要你补充是哪条记录，暂不覆盖或停用规则。";
    response.library = await deps.buildLearningLibrary(root);
    return response;
  }

  const ruleId = findCorrectionRuleId(correction.payload);
  if (correction.action === "disable") {
    if (ruleId) {
      try {
        response.disableResult = await deps.updateCurrentRuleStatus(root, { ruleId, status: "disabled" });
        response.message = `已记录纠正说明，并停用当前规则：${ruleId}`;
      } catch (error) {
        response.warning = `已记录纠正，但没有停用规则：${error.message || String(error)}`;
        response.message = response.warning;
      }
    } else {
      response.warning = "已记录纠正，但没有停用规则：没有可安全停用的当前规则编号，未盲改规则。";
      response.message = response.warning;
    }
  } else {
    response.message = "已记录纠正说明，后续可按这条引用继续覆盖或收窄。";
  }
  response.library = await deps.buildLearningLibrary(root);
  return response;
}

function mapCorrectionRecord(event, correctionAction) {
  const record = mapLearningDisplayRecord(event);
  if (!correctionAction.enabled) {
    return {
      ...record,
      displayStatus: "待确认",
      status: "待确认",
      actionLabel: "待纠正",
      nextStepText: correctionAction.disabledReason,
    };
  }
  return record;
}

function hasPrimaryLocator(payload = {}) {
  return PRIMARY_LOCATOR_FIELDS.some((field) => hasLocatorValue(payload[field]));
}

function hasLocatorValue(value) {
  if (Array.isArray(value)) return value.some((item) => stringValue(item));
  return Boolean(stringValue(value));
}

function findCorrectionRuleId(payload = {}) {
  const direct = stringValue(payload.ruleId);
  if (direct) return direct;
  return arrayValue(payload.landingIds).find((id) => id.startsWith("rule-")) || "";
}

function normalizeAction(action) {
  return Object.hasOwn(DEFAULT_CORRECTION_TEXTS, action) ? action : "override";
}

function stringValue(value) {
  return String(value || "").trim();
}

function usableRecordId(value) {
  const recordId = stringValue(value);
  return recordId && recordId !== "learning-record" ? recordId : "";
}

function arrayValue(value) {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(stringValue).filter(Boolean)));
}

module.exports = {
  AUXILIARY_CONTEXT_FIELDS,
  CORRECTION_ACTIONS,
  DEFAULT_CORRECTION_TEXTS,
  DISABLED_REASON,
  PRIMARY_LOCATOR_FIELDS,
  applyLearningCorrectionRequest,
  buildCorrectionAction,
  buildCorrectionPayload,
  buildLearningCorrectionEvent,
  findCorrectionRuleId,
  hasPrimaryLocator,
};
