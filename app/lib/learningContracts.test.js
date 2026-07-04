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
