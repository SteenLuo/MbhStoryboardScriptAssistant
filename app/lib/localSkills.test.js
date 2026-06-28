const assert = require("assert");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
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

test("loadLocalSkillContext includes user confirmed preferences", async () => {
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

  assert.match(context.prompt, /网页确认偏好/);
  assert.match(context.prompt, /分镜避免连续固定镜头/);
});
