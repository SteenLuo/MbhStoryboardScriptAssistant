const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  learnExplicitRule,
  listLearningEvents,
  readCurrentRuleset,
  updateCurrentRuleStatus,
  writeCurrentRuleset,
} = require("./autonomousLearning");
const { listNotifications } = require("./notifications");

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "mbh-autolearn-"));
}

test("learnExplicitRule publishes a valid rule into the current ruleset", async () => {
  const root = await tempRoot();
  const result = await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 20 字以内",
    summary: "分镜台词每句 20 字以内",
    capability: "storyboard",
    sourceType: "conversation",
    conversationId: "chat-1",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-1",
  });

  const ruleset = await readCurrentRuleset(root);
  const events = await listLearningEvents(root);

  assert.strictEqual(result.event.status, "已生效");
  assert.strictEqual(ruleset.rules.length, 1);
  assert.strictEqual(ruleset.rules[0].topicKey, "storyboard.dialogue.length");
  assert.match(ruleset.rules[0].content, /20 字以内/);
  assert.strictEqual(events[0].status, "已生效");
});

test("learnExplicitRule covers older same-topic events and keeps only the latest active rule", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-old", "event-new"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:20:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
  };

  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 20 字以内",
    summary: "分镜台词每句 20 字以内",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);
  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 15 字以内",
    summary: "分镜台词每句 15 字以内",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  const ruleset = await readCurrentRuleset(root);
  const events = await listLearningEvents(root, { includeCovered: true });
  const activeRules = ruleset.rules.filter((rule) => rule.status === "active");

  assert.strictEqual(activeRules.length, 1);
  assert.match(activeRules[0].content, /15 字以内/);
  assert.strictEqual(events.find((event) => event.eventId === "event-old").status, "已被覆盖");
  assert.strictEqual(events.find((event) => event.eventId === "event-old").coveredByEventId, "event-new");
});

test("learnExplicitRule records failure without replacing last-good ruleset", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-good", "event-bad"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:10:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
  };

  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 20 字以内",
    summary: "分镜台词每句 20 字以内",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);
  const failed = await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词限制",
    summary: "",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  const ruleset = await readCurrentRuleset(root);
  const events = await listLearningEvents(root, { includeCovered: true });

  assert.strictEqual(failed.event.status, "失败");
  assert.match(failed.event.error.message, /规则内容为空/);
  assert.strictEqual(ruleset.rules.filter((rule) => rule.status === "active").length, 1);
  assert.match(ruleset.rules[0].content, /20 字以内/);
  assert.strictEqual(events.find((event) => event.eventId === "event-bad").status, "失败");
});

test("learnExplicitRule notifies failure and withdraws stale failure when a newer same-topic rule succeeds", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-failed", "event-success"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:20:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
    notifyOnFailure: true,
  };

  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句必须限制长度",
    summary: "",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);
  let notifications = await listNotifications(root, { includeHandled: true });
  assert.strictEqual(notifications[0].sourceId, "event-failed");
  assert.strictEqual(notifications[0].status, "unread");
  assert.match(notifications[0].summary, /规则内容为空|瑙勫垯鍐呭涓虹┖/);

  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 15 字以内",
    summary: "分镜台词每句 15 字以内。",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  const events = await listLearningEvents(root, { includeCovered: true });
  notifications = await listNotifications(root, { includeHandled: true });

  assert.strictEqual(events.find((event) => event.eventId === "event-failed").status, "已被覆盖");
  assert.strictEqual(events.find((event) => event.eventId === "event-failed").coveredByEventId, "event-success");
  assert.strictEqual(notifications.find((item) => item.sourceId === "event-failed").status, "withdrawn");
});

test("updateCurrentRuleStatus lets users disable and enable an active rule", async () => {
  const root = await tempRoot();
  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-toggle",
  });

  let result = await updateCurrentRuleStatus(root, {
    ruleId: "rule-event-toggle",
    status: "disabled",
  }, {
    now: () => "2026-07-01T10:05:00.000Z",
  });

  assert.strictEqual(result.rule.status, "disabled");
  assert.strictEqual(result.rule.updatedAt, "2026-07-01T10:05:00.000Z");

  result = await updateCurrentRuleStatus(root, {
    ruleId: "rule-event-toggle",
    status: "active",
  }, {
    now: () => "2026-07-01T10:10:00.000Z",
  });

  const ruleset = await readCurrentRuleset(root);
  assert.strictEqual(result.rule.status, "active");
  assert.strictEqual(ruleset.rules[0].status, "active");
  assert.strictEqual(ruleset.rules[0].updatedAt, "2026-07-01T10:10:00.000Z");
});

test("updateCurrentRuleStatus rejects covered rules and duplicate active topics", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-old", "event-new"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:20:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
  };

  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);
  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 18 chars",
    summary: "dialogue max 18 chars",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  await assert.rejects(
    updateCurrentRuleStatus(root, { ruleId: "rule-event-old", status: "active" }),
    /已被覆盖|covered/,
  );

  await updateCurrentRuleStatus(root, { ruleId: "rule-event-new", status: "disabled" }, {
    now: () => "2026-07-01T10:30:00.000Z",
  });

  await assert.rejects(
    updateCurrentRuleStatus(root, { ruleId: "missing-rule", status: "disabled" }),
    /不存在|not found/,
  );

  await writeCurrentRuleset(root, {
    version: 10,
    lastGoodVersion: 10,
    updatedAt: "2026-07-01T11:00:00.000Z",
    rules: [{
      ruleId: "rule-active",
      topicKey: "storyboard.dialogue.length",
      capability: "storyboard",
      content: "active rule",
      priority: 50,
      sourceEventIds: ["event-active"],
      status: "active",
      createdAt: "2026-07-01T11:00:00.000Z",
      updatedAt: "2026-07-01T11:00:00.000Z",
    }, {
      ruleId: "rule-disabled",
      topicKey: "storyboard.dialogue.length",
      capability: "storyboard",
      content: "disabled rule",
      priority: 50,
      sourceEventIds: ["event-disabled"],
      status: "disabled",
      createdAt: "2026-07-01T11:00:00.000Z",
      updatedAt: "2026-07-01T11:00:00.000Z",
    }],
  });

  await assert.rejects(
    updateCurrentRuleStatus(root, { ruleId: "rule-disabled", status: "active" }),
    /同一主题已存在启用规则/,
  );
});

test("learnExplicitRule covers disabled same-topic rules when a newer rule succeeds", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-disabled", "event-new"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:20:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
  };

  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);
  await updateCurrentRuleStatus(root, { ruleId: "rule-event-disabled", status: "disabled" }, {
    now: () => "2026-07-01T10:05:00.000Z",
  });
  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 15 chars",
    summary: "dialogue max 15 chars",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  const ruleset = await readCurrentRuleset(root);
  const disabledOldRule = ruleset.rules.find((rule) => rule.ruleId === "rule-event-disabled");
  const activeNewRule = ruleset.rules.find((rule) => rule.ruleId === "rule-event-new");

  assert.strictEqual(disabledOldRule.status, "covered");
  assert.strictEqual(disabledOldRule.coveredByRuleId, "rule-event-new");
  assert.strictEqual(activeNewRule.status, "active");
});
