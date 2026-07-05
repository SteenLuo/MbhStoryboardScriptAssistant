const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  appendLearningEvent,
  appendSampleInsufficientLearningEvent,
  learnExplicitRule,
  listLearningEvents,
  readLearningEventRecords,
} = require("./autonomousLearning");

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "mbh-autolearn-"));
}

test("learnExplicitRule saves an overall learning record without creating a current ruleset", async () => {
  const root = await tempRoot();
  const result = await learnExplicitRule(root, {
    rawTrigger: "同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
    summary: "同一个镜号里的台词不能超过20个字，超过要拆分镜头",
    capability: "storyboard",
    sourceType: "conversation",
    conversationId: "chat-1",
    tokenUsage: {
      prompt_tokens: 11,
      completion_tokens: 7,
      total_tokens: 18,
    },
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-1",
  });

  const events = await listLearningEvents(root);

  assert.equal(result.event.learningMode, "overall");
  assert.equal(result.event.internalStatus, "landed");
  assert.equal(result.event.jobStatus, "completed");
  assert.equal(result.event.landingType, "learning-record");
  assert.equal(result.event.ruleId, "");
  assert.equal(result.event.topicKey, "storyboard.dialogue.length");
  assert.equal(result.event.conflictKey, "storyboard.dialogue.length.max-chars");
  assert.equal(result.event.tokenUsage.total_tokens, 18);
  assert.equal(events.length, 1);
  assert.equal(events[0].landingType, "learning-record");
  assert.equal(fs.existsSync(path.join(root, "learning", "current-ruleset.json")), false);
  assert.equal(fs.existsSync(path.join(root, "learning", "ruleset-history")), false);
});

test("learnExplicitRule keeps different dialogue requirements as separate saved records", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-dialogue-length", "event-dialogue-line-count"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:20:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
  };

  await learnExplicitRule(root, {
    rawTrigger: "storyboard dialogue max 20 chars",
    summary: "storyboard dialogue max 20 chars",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);
  await learnExplicitRule(root, {
    rawTrigger: "一个镜号下只能有一行台词，不允许变动skill中的已有格式。",
    summary: "一个镜号下只能有一行台词，不允许变动skill中的已有格式。",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  const events = await listLearningEvents(root, { includeCovered: true });
  const topics = events.map((event) => event.topicKey).sort();

  assert.deepEqual(events.map((event) => event.eventId).sort(), ids.sort());
  assert.deepEqual(topics, ["storyboard.dialogue.length", "storyboard.dialogue.line-count"]);
  assert.ok(events.every((event) => event.internalStatus === "landed"));
  assert.ok(events.every((event) => event.coveredByEventId === ""));
  assert.equal(fs.existsSync(path.join(root, "learning", "current-ruleset.json")), false);
});

test("appendLearningEvent keeps latest event state and hides covered records by default", async () => {
  const root = await tempRoot();
  await appendLearningEvent(root, {
    eventId: "event-a",
    summary: "first",
    internalStatus: "landed",
    jobStatus: "completed",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  });
  await appendLearningEvent(root, {
    eventId: "event-a",
    summary: "covered later",
    internalStatus: "covered",
    jobStatus: "completed",
    coveredByEventId: "event-b",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:10:00.000Z",
  });

  const visible = await listLearningEvents(root);
  const all = await listLearningEvents(root, { includeCovered: true });

  assert.equal(visible.length, 0);
  assert.equal(all.length, 1);
  assert.equal(all[0].summary, "covered later");
  assert.equal(all[0].coveredByEventId, "event-b");
});

test("appendSampleInsufficientLearningEvent preserves eval sample request fields", async () => {
  const root = await tempRoot();

  const event = await appendSampleInsufficientLearningEvent(root, {
    eventId: "event-need-samples",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    neededSampleType: "dialogue-length-failure",
    neededCount: 2,
    relatedRecordIds: ["record-a", "record-b"],
    sourceEventIds: ["event-a"],
    summary: "Need more comparable samples before L1 evaluation.",
    canvasId: "canvas-1",
    outputId: "output-1",
  }, {
    now: () => "2026-07-04T08:00:00.000Z",
  });

  const events = await listLearningEvents(root);
  const saved = events.find((item) => item.eventId === "event-need-samples");

  assert.equal(event.internalStatus, "received");
  assert.equal(event.jobStatus, "waiting");
  assert.equal(event.landingType, "sample-insufficient");
  assert.equal(saved.neededSampleType, "dialogue-length-failure");
  assert.equal(saved.neededCount, 2);
  assert.deepEqual(saved.relatedRecordIds, ["record-a", "record-b"]);
  assert.deepEqual(saved.sourceEventIds, ["event-a"]);
  assert.equal(saved.canvasId, "canvas-1");
  assert.equal(saved.outputId, "output-1");
});

test("learnExplicitRule writes sample-insufficient event instead of a learning record when evaluation needs samples", async () => {
  const root = await tempRoot();

  const result = await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars needs L1 evaluation",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
    requiresEvaluation: true,
    neededSampleType: "dialogue-length-failure",
    neededCount: 2,
    relatedRecordIds: ["record-a"],
    sourceEventIds: ["event-a"],
  }, {
    now: () => "2026-07-04T09:00:00.000Z",
    idSource: () => "event-needs-eval",
  });

  const events = await listLearningEvents(root);
  const event = events.find((item) => item.eventId === "event-needs-eval");

  assert.equal(result.event.landingType, "sample-insufficient");
  assert.equal(event.jobStatus, "waiting");
  assert.equal(event.neededSampleType, "dialogue-length-failure");
  assert.equal(event.neededCount, 2);
  assert.deepEqual(event.relatedRecordIds, ["record-a"]);
  assert.equal(fs.existsSync(path.join(root, "learning", "current-ruleset.json")), false);
});

test("readLearningEventRecords ignores malformed JSONL lines", async () => {
  const root = await tempRoot();
  const file = path.join(root, "learning", "events.jsonl");
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, [
    JSON.stringify({ eventId: "event-good", summary: "good" }),
    "{",
    JSON.stringify({ summary: "missing id" }),
  ].join("\n"), "utf8");

  const records = await readLearningEventRecords(root);

  assert.equal(records.length, 1);
  assert.equal(records[0].eventId, "event-good");
});
