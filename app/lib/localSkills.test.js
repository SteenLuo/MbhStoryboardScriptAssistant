const assert = require("assert");
const { execFile } = require("child_process");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { promisify } = require("util");

const {
  findLocalSkillRoute,
  loadLocalSkillContext,
  routeLocalSkill,
} = require("./localSkills");

const ROOT = path.resolve(__dirname, "..", "..");
const execFileAsync = promisify(execFile);

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

test("loadLocalSkillContext does not load current rules into generation prompts", async () => {
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

  assert.doesNotMatch(context.prompt, /当前规则层/);
  assert.doesNotMatch(context.prompt, /分镜台词每句 20 字以内/);
  assert.ok(!context.files.includes("learning/current-ruleset.json"));
  assert.deepStrictEqual(context.currentRulesUsed, []);
});

test("pending skill evolution drafts stay out of generated local skill context and routes", async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-draft-context-"));
  const skillDir = path.join(tempRoot, "skills/03-storyboard/storyboard-generate");
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), "# Official storyboard skill\n\nOfficial route only.\n", "utf8");
  await fsp.mkdir(path.join(tempRoot, "learning/skill-evolution-reports"), { recursive: true });
  await fsp.writeFile(
    path.join(tempRoot, "learning/skill-evolution-reports/skill-evolution-draft-2026-07-04.json"),
    JSON.stringify({
      skillId: "storyboard-generate",
      humanConfirmationStatus: "pending",
      publishAllowed: false,
      affectsGeneration: false,
      diffSummary: "Draft-only content that must not enter prompts.",
    }),
    "utf8",
  );

  const routeBefore = findLocalSkillRoute("storyboard-generate");
  const routedBefore = routeLocalSkill("storyboard request");
  const context = await loadLocalSkillContext(tempRoot, routeBefore);
  const routeAfter = findLocalSkillRoute("storyboard-generate");
  const routedAfter = routeLocalSkill("storyboard request");

  assert.deepStrictEqual(routeAfter, routeBefore);
  assert.deepStrictEqual(routedAfter, routedBefore);
  assert.doesNotMatch(context.prompt, /Draft-only content/);
  assert.ok(!context.files.some((file) => file.includes("skill-evolution-draft")));
});

test("New-SkillEvolutionDraft writes draft metadata without touching official skills or skill index", async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-draft-script-"));
  const snapshotDir = path.join(tempRoot, "learning/snapshots");
  const skillDir = path.join(tempRoot, "skills/03-storyboard/storyboard-generate");
  await fsp.mkdir(snapshotDir, { recursive: true });
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.mkdir(path.join(tempRoot, "learning/candidate-rules"), { recursive: true });
  await fsp.mkdir(path.join(tempRoot, "learning/evals"), { recursive: true });
  await fsp.mkdir(path.join(tempRoot, "learning/conversation-records"), { recursive: true });

  const officialSkillPath = path.join(skillDir, "SKILL.md");
  const officialSkillText = "# Official storyboard skill\n\nThis is the current official skill.\n";
  await fsp.writeFile(officialSkillPath, officialSkillText, "utf8");
  await fsp.writeFile(
    path.join(snapshotDir, "learning-snapshot-2026-07-04.md"),
    [
      "# Learning Snapshot",
      "",
      "## 一、资产概览",
      "| 资产 | 数量 |",
      "| --- | --- |",
      "| 候选规则文件 | 1 |",
      "| 评测结果 | 1 |",
      "",
      "## 三、已完成的新样例对齐任务",
      "- event-alpha: completed alignment",
    ].join("\n"),
    "utf8",
  );
  await fsp.writeFile(path.join(tempRoot, "learning/candidate-rules/rule-alpha.md"), "# Rule alpha\n", "utf8");
  await fsp.writeFile(path.join(tempRoot, "learning/evals/eval-alpha.md"), "# Eval alpha\n", "utf8");
  await fsp.writeFile(path.join(tempRoot, "learning/conversation-records/event-alpha.md"), "# Event alpha\n", "utf8");

  const scriptPath = path.join(ROOT, "tools/New-SkillEvolutionDraft.ps1");
  const { stdout } = await execFileAsync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-Root",
    tempRoot,
    "-Date",
    "2026-07-04",
    "-Force",
  ]);

  const metadataPath = path.join(
    tempRoot,
    "learning/skill-evolution-reports/skill-evolution-draft-2026-07-04.json",
  );
  const metadata = JSON.parse(await fsp.readFile(metadataPath, "utf8"));

  assert.match(stdout, /JsonPath/);
  assert.strictEqual(metadata.skillId, "skill-evolution");
  assert.deepStrictEqual(metadata.relatedRuleIds, ["rule-alpha"]);
  assert.deepStrictEqual(metadata.relatedEvalResultIds, ["eval-alpha"]);
  assert.deepStrictEqual(metadata.sourceEventIds, ["event-alpha"]);
  assert.match(metadata.diffSummary, /Draft only/);
  assert.strictEqual(metadata.humanConfirmationStatus, "pending");
  assert.strictEqual(metadata.publishAllowed, false);
  assert.strictEqual(metadata.affectsGeneration, false);
  assert.strictEqual(await fsp.readFile(officialSkillPath, "utf8"), officialSkillText);
  await assert.rejects(fsp.access(path.join(tempRoot, "learning/skill-index.json")));
  await assert.rejects(fsp.access(path.join(tempRoot, "skills/skill-evolution/SKILL.md")));
});
