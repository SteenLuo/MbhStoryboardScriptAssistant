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

test("legacy current-rule landing is saved as history and does not affect generation", () => {
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
  assert.equal(record.displayStatus, "已保存");
  assert.equal(record.actionLabel, "不用管");
  assert.equal(record.affectsGeneration, false);
  assert.match(record.generationImpactText, /历史学习资料/);
  assert.match(record.generationImpactText, /正式技能/);
  assert.equal(record.generationProof.proofStatus, "not_applicable");
  assert.match(record.nextStepText, /技能学习重新沉淀到正式技能/);
});

test("legacy skill-reference landing is saved history and does not affect generation", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-skill-reference",
    landingType: "skill-reference",
    learningMode: "overall",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "每个镜号只能有一行台词字段",
    skillId: "storyboard-generate",
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "已保存");
  assert.equal(record.affectsGeneration, false);
  assert.match(record.generationImpactText, /历史 skill reference/);
  assert.match(record.generationImpactText, /skill-creator/);
  assert.match(record.usedWhereText, /历史 skill reference/);
  assert.match(record.nextStepText, /调用 skill-creator 修改正式 skill/);
});

test("legacy skill-draft proof text is normalized as history", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-skill-draft",
    landingType: "skill-draft",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "把分镜规则沉淀到 skill",
    generationProof: {
      proofStatus: "not_applicable",
      claimText: "已生成 skill-creator 任务，完成修改和验证前不会影响生成。",
    },
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "已保存");
  assert.equal(record.affectsGeneration, false);
  assert.match(record.generationProof.claimText, /历史 skill-creator 任务记录/);
  assert.match(record.generationProof.claimText, /新的主动技能学习会调用 skill-creator 修改正式 skill/);
});

test("unfinished generation landings wait for confirmation before affecting generation", () => {
  const cases = [
    { eventId: "event-current-queued", landingType: "current-rule", internalStatus: "received", jobStatus: "queued" },
    { eventId: "event-current-running", landingType: "current-rule", internalStatus: "landed", jobStatus: "running" },
    { eventId: "event-current-waiting", landingType: "current-rule", internalStatus: "landed", jobStatus: "waiting" },
    { eventId: "event-formal-received", landingType: "formal-skill", internalStatus: "received", jobStatus: "completed" },
    { eventId: "event-formal-classified", landingType: "formal-skill", internalStatus: "classified", jobStatus: "completed" },
  ];

  for (const event of cases) {
    const record = mapLearningDisplayRecord({
      ...event,
      learningMode: "overall",
      summary: "生成落点还在处理",
    });

    assert.equal(record.displayStatus, "待确认", event.eventId);
    assert.equal(record.affectsGeneration, false, event.eventId);
    assert.equal(record.generationProof.proofStatus, "not_applicable", event.eventId);
  }
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
    error: { stage: "publish-current-ruleset", message: "规则内容为空，无法沉淀为规则材料" },
  });

  assertKnownDisplayStatus(record);
  assert.equal(record.displayStatus, "失败");
  assert.equal(record.actionLabel, "待纠正");
  assert.equal(record.affectsGeneration, false);
  assert.equal(record.generationProof.proofStatus, "failed");
  assert.match(record.nextStepText, /修正|纠正/);
});

test("legacy hard-rule failure wording is normalized for public display", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-legacy-hard-rule-failed",
    landingType: "eval",
    learningMode: "evidence",
    internalStatus: "failed",
    jobStatus: "failed",
    summary: "分镜输出违反稳定分镜技能硬规则，自动修正后仍失败。",
    error: {
      stage: "storyboard-hard-rule-post-validation",
      message: "自动台词拆分后仍存在硬规则违规。",
      issues: [{
        type: "dialogue-too-long",
        currentRulesUsedRefs: ["legacy-rule"],
        skillRulesUsedRefs: ["stable-skill-storyboard-dialogue-length"],
      }],
    },
  });

  assert.equal(record.learnedText, "分镜输出未按正式分镜技能硬规则生成，已拦截。");
  assert.equal(record.advanced.summary, "分镜输出未按正式分镜技能硬规则生成，已拦截。");
  assert.equal(record.advanced.error.message, "生成结果仍存在硬规则违规，未交付为可用分镜。");
  assert.equal(Object.hasOwn(record.advanced.error.issues[0], "currentRulesUsedRefs"), false);
  assert.deepEqual(record.advanced.error.issues[0].skillRulesUsedRefs, ["stable-skill-storyboard-dialogue-length"]);
  assert.doesNotMatch(record.learnedText, /自动修正|自动台词拆分/);
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

test("mapper exposes only public generation proof fields", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-proof-public",
    landingType: "formal-skill",
    learningMode: "overall",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "分镜台词每句 20 字以内",
    generationProof: {
      proofStatus: "validated",
      claimText: "已验证",
      skillRulesUsedRefs: ["stable-skill-storyboard-dialogue-length"],
      stack: "debug stack",
      traceToken: "secret",
    },
  });

  assert.equal(record.generationProof.proofStatus, "validated");
  assert.deepEqual(record.generationProof.skillRulesUsedRefs, ["stable-skill-storyboard-dialogue-length"]);
  assert.equal(Object.hasOwn(record.generationProof, "stack"), false);
  assert.equal(Object.hasOwn(record.generationProof, "traceToken"), false);
});
