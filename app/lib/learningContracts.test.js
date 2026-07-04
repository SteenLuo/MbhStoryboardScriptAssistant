const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeLearningEvent } = require("./learningContracts");

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
