const assert = require("assert");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
  findLocalSkillRoute,
  loadLocalSkillContext,
  routeLocalSkill,
} = require("./localSkills");

const ROOT = path.resolve(__dirname, "..", "..");

test("routeLocalSkill selects storyboard skill for direct storyboard requests", () => {
  const route = routeLocalSkill("请根据这个已经认可的剧本生成分镜");

  assert.strictEqual(route.id, "storyboard-generate");
  assert.strictEqual(route.path, "skills/03-storyboard/storyboard-generate");
});

test("routeLocalSkill sends novel-to-script requests to input intake first", () => {
  const route = routeLocalSkill("请根据下面小说原文生成剧本");

  assert.strictEqual(route.id, "novel-intake");
  assert.strictEqual(route.path, "skills/01-input-analysis/novel-intake");
});

test("routeLocalSkill selects hard issue review for dedicated script review requests", () => {
  const route = routeLocalSkill("请做剧本评审，列出硬伤问题清单和返修意见");

  assert.strictEqual(route.id, "script-hard-issue-review");
  assert.strictEqual(route.path, "skills/02-script/script-hard-issue-review");
});

test("routeLocalSkill selects manju adaptation analysis for adaptation requests", () => {
  const route = routeLocalSkill("请判断这个项目是否适合做漫剧，输出漫剧适配分析");

  assert.strictEqual(route.id, "script-manju-adaptation-analysis");
  assert.strictEqual(route.path, "skills/02-script/script-manju-adaptation-analysis");
});

test("findLocalSkillRoute returns dedicated routes by id", () => {
  const reviewRoute = findLocalSkillRoute("script-hard-issue-review");
  const adaptationRoute = findLocalSkillRoute("script-manju-adaptation-analysis");

  assert.strictEqual(reviewRoute.name, "剧本评审");
  assert.strictEqual(reviewRoute.path, "skills/02-script/script-hard-issue-review");
  assert.strictEqual(adaptationRoute.name, "漫剧适配分析");
  assert.strictEqual(adaptationRoute.path, "skills/02-script/script-manju-adaptation-analysis");
  assert.strictEqual(findLocalSkillRoute("unknown-skill"), null);
});

test("routeLocalSkill falls back to orchestrator for unclear chat", () => {
  const route = routeLocalSkill("我这里有一段材料，帮我判断下一步怎么走");

  assert.strictEqual(route.id, "mbh-workflow");
});

test("loadLocalSkillContext reads the matched SKILL.md and reference files only", async () => {
  const route = routeLocalSkill("帮我生成 AI 漫剧分镜");
  const context = await loadLocalSkillContext(ROOT, route);

  assert.strictEqual(context.id, "storyboard-generate");
  assert.match(context.prompt, /# 分镜生成/);
  assert.match(context.prompt, /## 参考规则/);
  assert.ok(context.files.includes("skills/03-storyboard/storyboard-generate/SKILL.md"));
  assert.ok(
    context.files.some((file) => file.startsWith("skills/03-storyboard/storyboard-generate/references/")),
  );
  assert.ok(!context.files.some((file) => file.includes("script-generate")));
});

test("loadLocalSkillContext ignores legacy web confirmed preferences", async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-"));
  await fsp.mkdir(path.join(tempRoot, "skills/00-orchestrator/mbh-workflow"), { recursive: true });
  await fsp.writeFile(path.join(tempRoot, "skills/00-orchestrator/mbh-workflow/SKILL.md"), "# 总控", "utf8");
  await fsp.mkdir(path.join(tempRoot, "learning/accepted-rules"), { recursive: true });
  await fsp.writeFile(
    path.join(tempRoot, "learning/accepted-rules/web-confirmed-preferences.md"),
    "# 网页确认偏好\n\n- 分镜避免连续固定镜头。",
    "utf8",
  );

  const context = await loadLocalSkillContext(tempRoot, routeLocalSkill("hello"));

  assert.doesNotMatch(context.prompt, /网页确认偏好/);
  assert.doesNotMatch(context.prompt, /分镜避免连续固定镜头/);
  assert.ok(!context.files.includes("learning/accepted-rules/web-confirmed-preferences.md"));
});

test("loadLocalSkillContext includes current rules context and exposes currentRulesUsed", async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-rules-"));
  const skillDir = path.join(tempRoot, "skills/03-storyboard/storyboard-generate");
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), "# 分镜生成\n", "utf8");
  await fsp.mkdir(path.join(tempRoot, "learning"), { recursive: true });
  await fsp.writeFile(
    path.join(tempRoot, "learning/current-ruleset.json"),
    JSON.stringify({
      version: 1,
      lastGoodVersion: 1,
      updatedAt: "2026-07-01T10:00:00.000Z",
      rules: [{
        ruleId: "rule-storyboard",
        topicKey: "storyboard.dialogue.length",
        conflictKey: "storyboard.dialogue.length",
        capability: "storyboard",
        content: "分镜台词每句 20 字以内。",
        priority: 50,
        sourceEventIds: ["event-storyboard"],
        status: "active",
      }],
    }),
    "utf8",
  );

  const context = await loadLocalSkillContext(tempRoot, routeLocalSkill("帮我生成分镜"));

  assert.match(context.prompt, /当前规则层/);
  assert.match(context.prompt, /分镜台词每句 20 字以内/);
  assert.ok(context.files.includes("learning/current-ruleset.json"));
  assert.deepStrictEqual(context.currentRulesUsed, [{
    ruleId: "rule-storyboard",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    capability: "storyboard",
    sourceEventIds: ["event-storyboard"],
    content: "分镜台词每句 20 字以内。",
  }]);
});
