const assert = require("node:assert/strict");
const test = require("node:test");

const { USER_DISPLAY_STATUSES, normalizeLearningEvent } = require("./learningContracts");
const { mapLearningDisplayRecord } = require("./learningStatusMapper");

function assertKnownDisplayStatus(record) {
  assert.ok(
    USER_DISPLAY_STATUSES.has(record.displayStatus),
    `unexpected display status: ${record.displayStatus}`,
  );
}

test("sample landing is saved and does not affect generation", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-sample",
    landingType: "sample",
    learningMode: "evidence",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "满意样例",
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.recordId, "event-sample");
  assert.equal(record.displayStatus, "已保存");
  assert.equal(record.actionLabel, "不用管");
  assert.equal(record.affectsGeneration, false);
  assert.equal(record.generationProof.proofStatus, "not_applicable");
  assert.equal(Object.hasOwn(record, "topicKey"), false);
  assert.equal(Object.hasOwn(record, "tokenUsage"), false);
  assert.equal(record.advanced.landingType, "sample");
});

test("evidence landing is saved as source material", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-evidence",
    landingType: "evidence",
    learningMode: "evidence",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "用户确认这个镜头节奏更好",
    sourceType: "conversation",
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "已保存");
  assert.equal(record.actionLabel, "不用管");
  assert.equal(record.affectsGeneration, false);
  assert.match(record.generationImpactText, /不会直接改变生成/);
  assert.match(record.sourceText, /对话/);
  assert.equal(record.generationProof.proofStatus, "not_applicable");
});

test("normalized minimal sample and evidence landings stay saved despite default uncertain mode", () => {
  for (const landingType of ["sample", "evidence"]) {
    const event = normalizeLearningEvent({
      eventId: `event-${landingType}`,
      landingType,
      internalStatus: "landed",
      jobStatus: "completed",
      summary: landingType === "sample" ? "满意样例" : "用户确认的证据",
    });
    const record = mapLearningDisplayRecord(event);

    assert.equal(event.learningMode, "uncertain");
    assert.equal(record.displayStatus, "已保存");
    assert.equal(record.affectsGeneration, false);
    assert.equal(record.generationProof.proofStatus, "not_applicable");
  }
});

test("current rule landing affects generation but can be pending first hit", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-rule",
    ruleId: "rule-event-rule",
    landingType: "current-rule",
    learningMode: "overall",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "分镜台词每句 20 字以内",
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "已影响生成");
  assert.equal(record.actionLabel, "不用管");
  assert.equal(record.affectsGeneration, true);
  assert.match(record.generationImpactText, /会参与后续生成/);
  assert.equal(record.generationProof.proofStatus, "pending_first_hit");
});

test("sample-insufficient learning waits for confirmation", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-insufficient",
    landingType: "sample-insufficient",
    learningMode: "uncertain",
    internalStatus: "classified",
    jobStatus: "waiting",
    summary: "单个样例还不足以沉淀成长期偏好",
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "待确认");
  assert.equal(record.actionLabel, "待补样例");
  assert.equal(record.affectsGeneration, false);
  assert.match(record.nextStepText, /补充/);
  assert.equal(record.generationProof.proofStatus, "not_applicable");
});

test("failed learning exposes correction action and failed proof", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-failed",
    landingType: "current-rule",
    learningMode: "overall",
    internalStatus: "failed",
    jobStatus: "failed",
    summary: "规则内容为空",
    error: { stage: "publish-current-ruleset", message: "规则内容为空，无法发布到当前规则层" },
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "失败");
  assert.equal(record.actionLabel, "待纠正");
  assert.equal(record.affectsGeneration, false);
  assert.equal(record.generationProof.proofStatus, "failed");
  assert.match(record.nextStepText, /修正|纠正/);
});

test("covered learning no longer affects generation", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-covered",
    landingType: "current-rule",
    learningMode: "overall",
    internalStatus: "covered",
    jobStatus: "completed",
    summary: "分镜台词每句 20 字以内",
    coveredByEventId: "event-new",
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "已被覆盖");
  assert.equal(record.actionLabel, "不用管");
  assert.equal(record.affectsGeneration, false);
  assert.match(record.usedWhereText, /event-new/);
  assert.equal(record.generationProof.proofStatus, "not_applicable");
});

test("unknown proof affecting generation explains incomplete evidence", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-unknown-proof",
    landingType: "formal-skill",
    learningMode: "overall",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "技能已更新但未回读命中证据",
    generationProof: { proofStatus: "unknown" },
  });

  assert.equal(record.displayStatus, "已影响生成");
  assert.equal(record.affectsGeneration, true);
  assert.equal(record.generationProof.proofStatus, "unknown");
  assert.match(record.generationProof.claimText, /仍会影响生成/);
  assert.match(record.generationProof.claimText, /证据不完整/);
});
