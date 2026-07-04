const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadLocalSkillContext, routeLocalSkill } = require("./localSkills");

test("loadLocalSkillContext includes active current ruleset rules for the routed skill", async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-"));
  const skillDir = path.join(tempRoot, "skills/03-storyboard/storyboard-generate");
  await fsp.mkdir(path.join(skillDir, "references"), { recursive: true });
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), "# 分镜生成\n", "utf8");
  await fsp.mkdir(path.join(tempRoot, "learning"), { recursive: true });
  await fsp.writeFile(
    path.join(tempRoot, "learning/current-ruleset.json"),
    JSON.stringify({
      version: 1,
      lastGoodVersion: 1,
      rules: [{
        ruleId: "rule-1",
        topicKey: "storyboard.dialogue.length",
        capability: "storyboard",
        content: "分镜台词每句 20 字以内。",
        priority: 50,
        sourceEventIds: ["event-1"],
        status: "active",
      }, {
        ruleId: "rule-disabled",
        topicKey: "storyboard.disabled.example",
        capability: "storyboard",
        content: "DISABLED_RULE_SHOULD_NOT_LOAD",
        priority: 50,
        sourceEventIds: ["event-disabled"],
        status: "disabled",
      }],
    }),
    "utf8",
  );

  const context = await loadLocalSkillContext(tempRoot, routeLocalSkill("帮我生成分镜"));

  assert.match(context.prompt, /当前规则层/);
  assert.match(context.prompt, /分镜台词每句 20 字以内/);
  assert.doesNotMatch(context.prompt, /DISABLED_RULE_SHOULD_NOT_LOAD/);
  assert.ok(context.files.includes("learning/current-ruleset.json"));
});
