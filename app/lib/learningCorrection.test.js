const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { appendLearningEvent, readLearningEventRecords } = require("./autonomousLearning");
const { buildLearningLibrary } = require("./learningLibrary");
const {
  DEFAULT_CORRECTION_TEXTS,
  applyLearningCorrectionRequest,
  buildCorrectionAction,
  buildLearningCorrectionEvent,
} = require("./learningCorrection");

test("correction action is enabled when any primary locator is present", () => {
  const action = buildCorrectionAction({
    recordId: "record-1",
    advanced: {
      eventId: "event-1",
      sourceEventIds: ["source-1"],
      landingIds: ["rule-1"],
      projectId: "project-context",
      canvasId: "canvas-context",
      conversationId: "chat-context",
      outputId: "output-1",
      topicKey: "storyboard.dialogue.length",
      conflictKey: "storyboard.dialogue.length",
      learningMode: "overall",
      tokenUsage: { total_tokens: 999 },
    },
  });

  assert.strictEqual(action.enabled, true);
  assert.strictEqual(action.payload.recordId, "record-1");
  assert.strictEqual(action.payload.eventId, "event-1");
  assert.deepStrictEqual(action.payload.sourceEventIds, ["source-1"]);
  assert.deepStrictEqual(action.payload.landingIds, ["rule-1"]);
  assert.strictEqual(action.payload.projectId, "project-context");
  assert.strictEqual(action.payload.canvasId, "canvas-context");
  assert.strictEqual(action.payload.conversationId, "chat-context");
  assert.strictEqual(action.payload.outputId, "output-1");
  assert.strictEqual(action.payload.topicKey, "storyboard.dialogue.length");
  assert.strictEqual(action.payload.conflictKey, "storyboard.dialogue.length");
  assert.strictEqual(action.payload.learningMode, "overall");
  assert.strictEqual(action.payload.scope, "overall");
  assert.equal(Object.hasOwn(action.payload, "tokenUsage"), false);
});

test("correction action is disabled when only auxiliary context is present", () => {
  const action = buildCorrectionAction({
    advanced: {
      projectId: "project-context",
      canvasId: "canvas-context",
      conversationId: "chat-context",
      topicKey: "storyboard.general",
      conflictKey: "storyboard.general",
      learningMode: "overall",
    },
  });

  assert.strictEqual(action.enabled, false);
  assert.match(action.disabledReason, /需要你补充是哪条记录/);
  assert.strictEqual(action.payload.projectId, "project-context");
  assert.strictEqual(action.payload.scope, "overall");
});

test("correction action exposes the four default correction texts", () => {
  assert.strictEqual(DEFAULT_CORRECTION_TEXTS.override, "这条学错了，请按这次说明覆盖。");
  assert.strictEqual(DEFAULT_CORRECTION_TEXTS.temporary, "这条只适用于这次，不要作为长期规则。");
  assert.strictEqual(DEFAULT_CORRECTION_TEXTS.disable, "这条先停用，后续我再补说明。");
  assert.strictEqual(DEFAULT_CORRECTION_TEXTS.narrow, "这条范围太大，请收窄成我这次说的范围。");

  assert.strictEqual(buildCorrectionAction({ recordId: "record-1" }).defaultText, DEFAULT_CORRECTION_TEXTS.override);
  assert.strictEqual(buildCorrectionAction({ recordId: "record-1" }, { action: "temporary" }).defaultText, DEFAULT_CORRECTION_TEXTS.temporary);
  assert.strictEqual(buildCorrectionAction({ recordId: "record-1" }, { action: "disable" }).defaultText, DEFAULT_CORRECTION_TEXTS.disable);
  assert.strictEqual(buildCorrectionAction({ recordId: "record-1" }, { action: "narrow" }).defaultText, DEFAULT_CORRECTION_TEXTS.narrow);
});

test("correction event falls back to waiting correction when locator is missing", () => {
  const result = buildLearningCorrectionEvent({
    payload: { projectId: "project-context", learningMode: "overall" },
    action: "disable",
    now: () => "2026-07-04T00:00:00.000Z",
    idSource: () => "correction-1",
  });

  assert.strictEqual(result.enabled, false);
  assert.strictEqual(result.event.eventId, "correction-1");
  assert.strictEqual(result.event.learningMode, "correction");
  assert.strictEqual(result.event.sourceType, "correction");
  assert.strictEqual(result.event.landingType, "correction-location-missing");
  assert.strictEqual(result.record.displayStatus, "待确认");
  assert.strictEqual(result.record.actionLabel, "待纠正");
  assert.match(result.record.nextStepText, /补充正确的纠正位置|补充是哪条记录/);
});

test("disable correction records the event without using a current rule layer", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-correction-missing-rule-"));
  const result = await applyLearningCorrectionRequest(root, {
    payload: {
      recordId: "event-old",
      landingIds: ["rule-missing"],
      topicKey: "storyboard.general",
      conflictKey: "storyboard.general",
    },
    action: "disable",
    message: "这条先停用，后续我再补说明。",
  }, {
    appendLearningEvent,
    buildLearningLibrary,
    now: () => "2026-07-04T00:00:00.000Z",
    idSource: () => "correction-missing-rule",
  });

  const events = await readLearningEventRecords(root);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.disableResult, null);
  assert.strictEqual(result.warning, "");
  assert.match(result.message, /没有当前规则层开关/);
  assert.match(result.message, /不会盲改 skill 文件/);
  assert.ok(result.library);
  assert.ok(events.some((event) => event.eventId === "correction-missing-rule" && event.learningMode === "correction"));
});

test("disable correction records legacy rule references as correction evidence only", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-correction-covered-rule-"));

  const result = await applyLearningCorrectionRequest(root, {
    payload: {
      recordId: "event-old",
      landingIds: ["rule-covered"],
      topicKey: "storyboard.general",
      conflictKey: "storyboard.general",
    },
    action: "disable",
    message: "这条先停用，后续我再补说明。",
  }, {
    appendLearningEvent,
    buildLearningLibrary,
    now: () => "2026-07-04T00:10:00.000Z",
    idSource: () => "correction-covered-rule",
  });

  const events = await readLearningEventRecords(root);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.disableResult, null);
  assert.strictEqual(result.warning, "");
  assert.match(result.message, /没有当前规则层开关/);
  assert.deepStrictEqual(result.library.currentRules, []);
  assert.ok(result.library.records.some((record) =>
    record.advanced?.eventId === "correction-covered-rule" &&
    record.advanced?.landingType === "correction"
  ));
  assert.ok(events.some((event) => event.eventId === "correction-covered-rule" && event.learningMode === "correction"));
});
