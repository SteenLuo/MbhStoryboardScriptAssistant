const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildCurrentRulesetContext } = require("./currentRulesetContext");

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "mbh-current-rules-"));
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function ruleset(version, rules, extra = {}) {
  return {
    version,
    lastGoodVersion: version,
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...extra,
    rules,
  };
}

function rule(overrides = {}) {
  return {
    ruleId: "rule-storyboard",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    capability: "storyboard",
    content: "分镜台词每句 20 字以内。",
    priority: 50,
    sourceEventIds: ["event-storyboard"],
    status: "active",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

test("buildCurrentRulesetContext filters active rules by capability and exposes trace refs", async () => {
  const root = await tempRoot();
  await writeJson(path.join(root, "learning/current-ruleset.json"), ruleset(3, [
    rule(),
    rule({
      ruleId: "rule-general",
      topicKey: "general.style",
      conflictKey: "general.style",
      capability: "general",
      content: "输出保持简洁。",
      sourceEventIds: ["event-general"],
    }),
    rule({
      ruleId: "rule-script",
      topicKey: "script.review",
      conflictKey: "script.review",
      capability: "script",
      content: "SCRIPT_RULE_SHOULD_NOT_LOAD",
      sourceEventIds: ["event-script"],
    }),
    rule({
      ruleId: "rule-disabled",
      topicKey: "storyboard.disabled",
      conflictKey: "storyboard.disabled",
      content: "DISABLED_RULE_SHOULD_NOT_LOAD",
      sourceEventIds: ["event-disabled"],
      status: "disabled",
    }),
  ]));

  const context = await buildCurrentRulesetContext(root, { capability: "storyboard" });

  assert.strictEqual(context.ok, true);
  assert.strictEqual(context.loadError, null);
  assert.match(context.promptText, /当前规则层/);
  assert.match(context.promptText, /分镜台词每句 20 字以内/);
  assert.match(context.promptText, /输出保持简洁/);
  assert.doesNotMatch(context.promptText, /SCRIPT_RULE_SHOULD_NOT_LOAD/);
  assert.doesNotMatch(context.promptText, /DISABLED_RULE_SHOULD_NOT_LOAD/);
  assert.deepStrictEqual(context.currentRulesUsed.map((item) => item.ruleId), ["rule-storyboard", "rule-general"]);
  assert.deepStrictEqual(context.currentRulesUsed[0].sourceEventIds, ["event-storyboard"]);
  assert.strictEqual(context.currentRulesUsed[0].conflictKey, "storyboard.dialogue.length");
});

test("buildCurrentRulesetContext falls back to last-good snapshot when current ruleset is invalid", async () => {
  const root = await tempRoot();
  await fsp.mkdir(path.join(root, "learning"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning/current-ruleset.json"), "{ bad json", "utf8");
  await writeJson(path.join(root, "learning/ruleset-history/v2.json"), {
    version: 2,
    lastGoodVersion: 2,
    createdAt: "2026-07-01T10:00:00.000Z",
    sourceEventIds: ["event-storyboard"],
    rules: [rule()],
  });

  const context = await buildCurrentRulesetContext(root, { capability: "storyboard" });

  assert.strictEqual(context.ok, true);
  assert.match(context.loadError, /current-ruleset\.json/);
  assert.match(context.promptText, /分镜台词每句 20 字以内/);
  assert.deepStrictEqual(context.currentRulesUsed.map((item) => item.ruleId), ["rule-storyboard"]);
});

test("buildCurrentRulesetContext reports ok=false when current ruleset is invalid and no fallback exists", async () => {
  const root = await tempRoot();
  await fsp.mkdir(path.join(root, "learning"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning/current-ruleset.json"), "{ bad json", "utf8");

  const context = await buildCurrentRulesetContext(root, { capability: "storyboard" });

  assert.strictEqual(context.ok, false);
  assert.deepStrictEqual(context.rules, []);
  assert.strictEqual(context.promptText, "");
  assert.deepStrictEqual(context.currentRulesUsed, []);
  assert.match(context.loadError, /current-ruleset\.json/);
});
