const assert = require("node:assert/strict");
const fs = require("node:fs");
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

  assert.equal(result.event.learningMode, "overall");
  assert.equal(result.event.internalStatus, "landed");
  assert.equal(result.event.jobStatus, "completed");
  assert.equal(result.event.landingType, "current-rule");
  assert.strictEqual(ruleset.rules.length, 1);
  assert.strictEqual(ruleset.rules[0].topicKey, "storyboard.dialogue.length");
  assert.strictEqual(ruleset.rules[0].conflictKey, "storyboard.dialogue.length");
  assert.match(ruleset.rules[0].content, /20 字以内/);
  assert.strictEqual(events[0].internalStatus, "landed");
  assert.strictEqual(events[0].jobStatus, "completed");
  assert.strictEqual(events[0].landingType, "current-rule");

  const snapshot = JSON.parse(await fsp.readFile(path.join(root, "learning/ruleset-history/v1.json"), "utf8"));
  assert.strictEqual(snapshot.version, 1);
  assert.strictEqual(snapshot.lastGoodVersion, 1);
  assert.strictEqual(snapshot.createdAt, "2026-07-01T10:00:00.000Z");
  assert.deepStrictEqual(snapshot.sourceEventIds, ["event-1"]);
  assert.strictEqual(snapshot.rules[0].ruleId, "rule-event-1");
  assert.strictEqual(snapshot.rules[0].conflictKey, "storyboard.dialogue.length");

  const rawRecords = (await fsp.readFile(path.join(root, "learning/events.jsonl"), "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.ok(rawRecords.every((record) => !Object.hasOwn(record, "status")));
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
  assert.strictEqual(events.find((event) => event.eventId === "event-old").internalStatus, "covered");
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
  const lastGoodSnapshot = await fsp.readFile(path.join(root, "learning/ruleset-history/v1.json"), "utf8");
  const failed = await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词限制",
    summary: "",
    capability: "storyboard",
    sourceType: "conversation",
  }, options);

  const ruleset = await readCurrentRuleset(root);
  const events = await listLearningEvents(root, { includeCovered: true });

  assert.strictEqual(failed.event.internalStatus, "failed");
  assert.strictEqual(failed.event.jobStatus, "failed");
  assert.match(failed.event.error.message, /规则内容为空/);
  assert.strictEqual(ruleset.version, 1);
  assert.strictEqual(ruleset.lastGoodVersion, 1);
  assert.strictEqual(ruleset.rules.filter((rule) => rule.status === "active").length, 1);
  assert.match(ruleset.rules[0].content, /20 字以内/);
  assert.strictEqual(events.find((event) => event.eventId === "event-bad").internalStatus, "failed");
  assert.strictEqual(await fsp.readFile(path.join(root, "learning/ruleset-history/v1.json"), "utf8"), lastGoodSnapshot);
  assert.strictEqual(fs.existsSync(path.join(root, "learning/ruleset-history/v2.json")), false);
});

test("learnExplicitRule does not advance current ruleset when snapshot write fails", async () => {
  const root = await tempRoot();
  await fsp.mkdir(path.join(root, "learning"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning/ruleset-history"), "not a directory", "utf8");

  const failedFirstPublish = await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-snapshot-fails",
  });

  const emptyRuleset = await readCurrentRuleset(root);
  assert.strictEqual(failedFirstPublish.event.internalStatus, "failed");
  assert.strictEqual(failedFirstPublish.event.jobStatus, "failed");
  assert.match(failedFirstPublish.event.error.message, /ruleset-history|ENOTDIR|not a directory|EEXIST/);
  assert.strictEqual(emptyRuleset.version, 0);
  assert.strictEqual(emptyRuleset.lastGoodVersion, 0);
  assert.deepStrictEqual(emptyRuleset.rules.filter((rule) => rule.status === "active"), []);

  const previousRoot = await tempRoot();
  await learnExplicitRule(previousRoot, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-good",
  });
  const previousRuleset = await readCurrentRuleset(previousRoot);
  const previousCurrentFile = await fsp.readFile(path.join(previousRoot, "learning/current-ruleset.json"), "utf8");
  await fsp.rm(path.join(previousRoot, "learning/ruleset-history"), { recursive: true, force: true });
  await fsp.writeFile(path.join(previousRoot, "learning/ruleset-history"), "not a directory", "utf8");

  const failedSecondPublish = await learnExplicitRule(previousRoot, {
    rawTrigger: "storyboard shot numbering",
    summary: "storyboard shot numbering",
    capability: "storyboard",
    conflictKey: "storyboard.shot.numbering",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:05:00.000Z",
    idSource: () => "event-snapshot-fails-again",
  });

  const unchangedRuleset = await readCurrentRuleset(previousRoot);
  assert.strictEqual(failedSecondPublish.event.internalStatus, "failed");
  assert.deepStrictEqual(unchangedRuleset, previousRuleset);
  assert.strictEqual(await fsp.readFile(path.join(previousRoot, "learning/current-ruleset.json"), "utf8"), previousCurrentFile);
});

test("learnExplicitRule removes official snapshot when current ruleset write fails", async () => {
  const originalWriteFile = fsp.writeFile;
  const originalRename = fsp.rename;
  const failCurrentTarget = (target) => path.basename(String(target)) === "current-ruleset.json";
  fsp.writeFile = async (target, ...args) => {
    if (failCurrentTarget(target)) throw new Error("simulated current ruleset write failure");
    return originalWriteFile.call(fsp, target, ...args);
  };
  fsp.rename = async (from, to) => {
    if (failCurrentTarget(to)) throw new Error("simulated current ruleset rename failure");
    return originalRename.call(fsp, from, to);
  };

  try {
    const root = await tempRoot();
    const failedFirstPublish = await learnExplicitRule(root, {
      rawTrigger: "dialogue max 20 chars",
      summary: "dialogue max 20 chars",
      capability: "storyboard",
      conflictKey: "storyboard.dialogue.length",
      sourceType: "conversation",
    }, {
      now: () => "2026-07-01T10:00:00.000Z",
      idSource: () => "event-current-write-fails",
    });

    const emptyRuleset = await readCurrentRuleset(root);
    assert.strictEqual(failedFirstPublish.event.internalStatus, "failed");
    assert.match(failedFirstPublish.event.error.message, /simulated current ruleset/);
    assert.strictEqual(emptyRuleset.version, 0);
    assert.strictEqual(emptyRuleset.lastGoodVersion, 0);
    assert.deepStrictEqual(emptyRuleset.rules.filter((rule) => rule.status === "active"), []);
    assert.strictEqual(fs.existsSync(path.join(root, "learning/ruleset-history/v1.json")), false);

    fsp.writeFile = originalWriteFile;
    fsp.rename = originalRename;
    const previousRoot = await tempRoot();
    await learnExplicitRule(previousRoot, {
      rawTrigger: "dialogue max 20 chars",
      summary: "dialogue max 20 chars",
      capability: "storyboard",
      conflictKey: "storyboard.dialogue.length",
      sourceType: "conversation",
    }, {
      now: () => "2026-07-01T10:00:00.000Z",
      idSource: () => "event-good",
    });
    const previousRuleset = await readCurrentRuleset(previousRoot);
    const previousSnapshot = await fsp.readFile(path.join(previousRoot, "learning/ruleset-history/v1.json"), "utf8");

    fsp.writeFile = async (target, ...args) => {
      if (failCurrentTarget(target)) throw new Error("simulated current ruleset write failure");
      return originalWriteFile.call(fsp, target, ...args);
    };
    fsp.rename = async (from, to) => {
      if (failCurrentTarget(to)) throw new Error("simulated current ruleset rename failure");
      return originalRename.call(fsp, from, to);
    };

    const failedSecondPublish = await learnExplicitRule(previousRoot, {
      rawTrigger: "storyboard shot numbering",
      summary: "storyboard shot numbering",
      capability: "storyboard",
      conflictKey: "storyboard.shot.numbering",
      sourceType: "conversation",
    }, {
      now: () => "2026-07-01T10:05:00.000Z",
      idSource: () => "event-current-write-fails-again",
    });

    const unchangedRuleset = await readCurrentRuleset(previousRoot);
    assert.strictEqual(failedSecondPublish.event.internalStatus, "failed");
    assert.deepStrictEqual(unchangedRuleset, previousRuleset);
    assert.strictEqual(fs.existsSync(path.join(previousRoot, "learning/ruleset-history/v2.json")), false);
    assert.strictEqual(await fsp.readFile(path.join(previousRoot, "learning/ruleset-history/v1.json"), "utf8"), previousSnapshot);
  } finally {
    fsp.writeFile = originalWriteFile;
    fsp.rename = originalRename;
  }
});

test("learnExplicitRule does not cover old events when replacement publish fails", async () => {
  const root = await tempRoot();
  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-good",
  });
  await learnExplicitRule(root, {
    rawTrigger: "dialogue max failed",
    summary: "",
    capability: "storyboard",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:02:00.000Z",
    idSource: () => "event-stale-failed",
    notifyOnFailure: true,
  });

  const originalRename = fsp.rename;
  fsp.rename = async (from, to) => {
    if (path.basename(String(to)) === "current-ruleset.json") {
      throw new Error("simulated current ruleset rename failure");
    }
    return originalRename.call(fsp, from, to);
  };

  try {
    const failedReplacement = await learnExplicitRule(root, {
      rawTrigger: "dialogue max 18 chars",
      summary: "dialogue max 18 chars",
      capability: "storyboard",
      conflictKey: "storyboard.dialogue.length",
      sourceType: "conversation",
    }, {
      now: () => "2026-07-01T10:05:00.000Z",
      idSource: () => "event-failed-replacement",
    });

    const ruleset = await readCurrentRuleset(root);
    const events = await listLearningEvents(root, { includeCovered: true });
    const notifications = await listNotifications(root, { includeHandled: true });
    const oldEvent = events.find((event) => event.eventId === "event-good");
    const staleFailedEvent = events.find((event) => event.eventId === "event-stale-failed");
    const failedEvent = events.find((event) => event.eventId === "event-failed-replacement");
    const staleNotification = notifications.find((notification) => notification.sourceId === "event-stale-failed");

    assert.strictEqual(failedReplacement.event.internalStatus, "failed");
    assert.strictEqual(failedEvent.internalStatus, "failed");
    assert.notStrictEqual(oldEvent.internalStatus, "covered");
    assert.strictEqual(staleFailedEvent.internalStatus, "failed");
    assert.strictEqual(staleNotification.status, "unread");
    assert.strictEqual(ruleset.version, 1);
    assert.strictEqual(ruleset.lastGoodVersion, 1);
    assert.strictEqual(ruleset.rules.filter((rule) => rule.status === "active").length, 1);
    assert.strictEqual(ruleset.rules.find((rule) => rule.status === "active").ruleId, "rule-event-good");
    assert.strictEqual(fs.existsSync(path.join(root, "learning/ruleset-history/v2.json")), false);
  } finally {
    fsp.rename = originalRename;
  }
});

test("concurrent learnExplicitRule publishes serialize current ruleset updates", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-concurrent-a", "event-concurrent-b"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:00:01.000Z"];
  const options = {
    now: () => times[Math.min(index, times.length - 1)],
    idSource: () => ids[index++],
  };

  const [first, second] = await Promise.all([
    learnExplicitRule(root, {
      rawTrigger: "dialogue max 20 chars",
      summary: "dialogue max 20 chars",
      capability: "storyboard",
      conflictKey: "storyboard.dialogue.length",
      sourceType: "conversation",
    }, options),
    learnExplicitRule(root, {
      rawTrigger: "dialogue max 18 chars",
      summary: "dialogue max 18 chars",
      capability: "storyboard",
      conflictKey: "storyboard.dialogue.length",
      sourceType: "conversation",
    }, options),
  ]);

  const ruleset = await readCurrentRuleset(root);
  const snapshot = JSON.parse(await fsp.readFile(path.join(root, "learning/ruleset-history/v2.json"), "utf8"));
  const activeRules = ruleset.rules.filter((rule) => rule.status === "active");
  const activeConflictKeys = activeRules.map((rule) => rule.conflictKey);

  assert.deepStrictEqual([first.event.internalStatus, second.event.internalStatus].sort(), ["landed", "landed"]);
  assert.strictEqual(ruleset.version, 2);
  assert.strictEqual(ruleset.lastGoodVersion, 2);
  assert.strictEqual(snapshot.version, 2);
  assert.strictEqual(activeRules.length, 1);
  assert.strictEqual(new Set(activeConflictKeys).size, activeConflictKeys.length);
});

test("learnExplicitRule validates overall mode conflictKey and expectedVersion before publishing", async () => {
  const root = await tempRoot();

  await learnExplicitRule(root, {
    rawTrigger: "dialogue max 20 chars",
    summary: "dialogue max 20 chars",
    capability: "storyboard",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
    expectedVersion: 0,
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-good",
  });

  const before = await readCurrentRuleset(root);
  assert.strictEqual(before.version, 1);
  assert.strictEqual(before.lastGoodVersion, 1);

  const expectedVersionMismatch = await learnExplicitRule(root, {
    rawTrigger: "storyboard shot numbering",
    summary: "storyboard shot numbering",
    capability: "storyboard",
    conflictKey: "storyboard.shot.numbering",
    sourceType: "conversation",
    expectedVersion: 0,
  }, {
    now: () => "2026-07-01T10:05:00.000Z",
    idSource: () => "event-version-mismatch",
  });

  const temporaryMode = await learnExplicitRule(root, {
    rawTrigger: "temporary only",
    summary: "temporary only",
    capability: "storyboard",
    conflictKey: "storyboard.temporary",
    learningMode: "temporary",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:10:00.000Z",
    idSource: () => "event-temporary",
  });

  const emptyConflictKey = await learnExplicitRule(root, {
    rawTrigger: "empty conflict",
    summary: "empty conflict",
    capability: "storyboard",
    conflictKey: " ",
    sourceType: "conversation",
  }, {
    now: () => "2026-07-01T10:15:00.000Z",
    idSource: () => "event-empty-conflict",
  });

  const after = await readCurrentRuleset(root);
  assert.strictEqual(expectedVersionMismatch.event.internalStatus, "failed");
  assert.match(expectedVersionMismatch.event.error.message, /expectedVersion|版本|version/);
  assert.strictEqual(temporaryMode.event.internalStatus, "failed");
  assert.match(temporaryMode.event.error.message, /overall|当前规则|learningMode/);
  assert.strictEqual(emptyConflictKey.event.internalStatus, "failed");
  assert.match(emptyConflictKey.event.error.message, /conflictKey|冲突键/);
  assert.deepStrictEqual(after, before);
  assert.strictEqual(fs.existsSync(path.join(root, "learning/ruleset-history/v2.json")), false);
});

test("learnExplicitRule covers older same-conflict rules when a newer rule succeeds", async () => {
  const root = await tempRoot();
  let index = 0;
  const ids = ["event-script", "event-storyboard"];
  const times = ["2026-07-01T10:00:00.000Z", "2026-07-01T10:20:00.000Z"];
  const options = {
    now: () => times[index],
    idSource: () => ids[index++],
  };

  await learnExplicitRule(root, {
    rawTrigger: "script shared conflict",
    summary: "script shared conflict",
    capability: "script",
    conflictKey: "shared.output.format",
    sourceType: "conversation",
  }, options);
  await learnExplicitRule(root, {
    rawTrigger: "storyboard shared conflict",
    summary: "storyboard shared conflict",
    capability: "storyboard",
    conflictKey: "shared.output.format",
    sourceType: "conversation",
  }, options);

  const ruleset = await readCurrentRuleset(root);
  const activeRules = ruleset.rules.filter((rule) => rule.status === "active");
  const coveredRule = ruleset.rules.find((rule) => rule.ruleId === "rule-event-script");

  assert.strictEqual(ruleset.version, 2);
  assert.strictEqual(ruleset.lastGoodVersion, 2);
  assert.strictEqual(activeRules.length, 1);
  assert.strictEqual(activeRules[0].ruleId, "rule-event-storyboard");
  assert.strictEqual(activeRules[0].conflictKey, "shared.output.format");
  assert.strictEqual(coveredRule.status, "covered");
  assert.strictEqual(coveredRule.coveredByRuleId, "rule-event-storyboard");
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

  assert.strictEqual(events.find((event) => event.eventId === "event-failed").internalStatus, "covered");
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
