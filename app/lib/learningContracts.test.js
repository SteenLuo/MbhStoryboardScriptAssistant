const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeLearningEvent, validateGenerationProofCombination } = require("./learningContracts");

test("normalizeLearningEvent keeps required locator keys even when values are empty", () => {
  const event = normalizeLearningEvent({
    eventId: "event-a",
    summary: "分镜台词每句 20 字以内",
    rawTrigger: "以后分镜台词每句 20 字以内",
    learningMode: "overall",
    conversationId: "chat-a",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  });

  assert.deepEqual(event.sourceEventIds, []);
  assert.deepEqual(event.landingIds, []);
  assert.equal(event.outputId, "");
  assert.equal(event.projectId, "");
  assert.equal(event.canvasId, "");
  assert.equal(event.conversationId, "chat-a");
  assert.equal(event.learningMode, "overall");
  assert.equal(event.internalStatus, "received");
  assert.equal(event.jobStatus, "queued");
});

test("normalizeLearningEvent rejects missing eventId", () => {
  assert.throws(
    () => normalizeLearningEvent({ summary: "missing id" }),
    /learning event requires eventId/,
  );
  assert.throws(
    () => normalizeLearningEvent({ eventId: "   " }),
    /learning event requires eventId/,
  );
});

test("normalizeLearningEvent normalizes malformed locator arrays to empty arrays", () => {
  const event = normalizeLearningEvent({
    eventId: "event-arrays",
    sourceEventIds: "event-a",
    landingIds: { id: "rule-a" },
  });

  assert.deepEqual(event.sourceEventIds, []);
  assert.deepEqual(event.landingIds, []);
});

test("normalizeLearningEvent maps legacy status values into internal and job statuses", () => {
  const landed = normalizeLearningEvent({ eventId: "event-landed", status: "已生效" });
  assert.equal(landed.learningMode, "overall");
  assert.equal(landed.internalStatus, "landed");
  assert.equal(landed.jobStatus, "completed");
  assert.equal(landed.landingType, "current-rule");

  const failed = normalizeLearningEvent({ eventId: "event-failed", status: "失败" });
  assert.equal(failed.internalStatus, "failed");
  assert.equal(failed.jobStatus, "failed");

  const covered = normalizeLearningEvent({ eventId: "event-covered", status: "已被覆盖" });
  assert.equal(covered.internalStatus, "covered");
  assert.equal(covered.jobStatus, "completed");
});

test("normalizeLearningEvent preserves only public generation proof fields", () => {
  const event = normalizeLearningEvent({
    eventId: "event-proof",
    generationProof: {
      proofStatus: "validated",
      claimText: "已在生成中验证",
      currentRulesUsedRefs: ["rule-a", " ", 42],
      skillRulesUsedRefs: ["stable-a", " "],
      validationResultRefs: ["run-a", null, "run-b"],
      lastCheckedOutputId: 123,
      lastCheckedAt: "2026-07-04T00:00:00.000Z",
      failureEventIds: ["event-failed"],
      stack: "debug stack",
      debug: { raw: true },
    },
  });

  assert.deepEqual(event.generationProof, {
    proofStatus: "validated",
    claimText: "已在生成中验证",
    currentRulesUsedRefs: ["rule-a", "42"],
    skillRulesUsedRefs: ["stable-a"],
    validationResultRefs: ["run-a", "run-b"],
    lastCheckedOutputId: "123",
    lastCheckedAt: "2026-07-04T00:00:00.000Z",
    failureEventIds: ["event-failed"],
  });
  assert.equal(Object.hasOwn(event.generationProof, "stack"), false);
  assert.equal(Object.hasOwn(event.generationProof, "debug"), false);
});

test("validateGenerationProofCombination accepts valid proof and display status pairs", () => {
  assert.doesNotThrow(() => validateGenerationProofCombination({
    displayStatus: "已保存",
    affectsGeneration: false,
    proofStatus: "not_applicable",
    claimText: "这个学习只保存为资料，不直接影响生成。",
  }));
  assert.doesNotThrow(() => validateGenerationProofCombination({
    displayStatus: "已影响生成",
    affectsGeneration: true,
    proofStatus: "pending_first_hit",
    claimText: "正式稳定 skill 已准备参与后续生成，等待下一次命中验证。",
  }));
  assert.doesNotThrow(() => validateGenerationProofCombination({
    displayStatus: "已影响生成",
    affectsGeneration: true,
    proofStatus: "unknown",
    claimText: "当前仍会影响生成，证据不完整需排查。",
  }));
});

test("validateGenerationProofCombination rejects misleading proof combinations", () => {
  assert.throws(
    () => validateGenerationProofCombination({
      displayStatus: "已影响生成",
      affectsGeneration: true,
      proofStatus: "not_applicable",
      claimText: "不适用",
    }),
    /not_applicable/,
  );
  assert.throws(
    () => validateGenerationProofCombination({
      displayStatus: "已保存",
      affectsGeneration: false,
      proofStatus: "participated",
      claimText: "已参与生成",
    }),
    /已影响生成/,
  );
  assert.throws(
    () => validateGenerationProofCombination({
      displayStatus: "已影响生成",
      affectsGeneration: true,
      proofStatus: "failed",
      claimText: "失败",
    }),
    /failed/,
  );
  assert.throws(
    () => validateGenerationProofCombination({
      displayStatus: "已影响生成",
      affectsGeneration: true,
      proofStatus: "unknown",
      claimText: "证据未知",
    }),
    /证据不完整/,
  );
});
