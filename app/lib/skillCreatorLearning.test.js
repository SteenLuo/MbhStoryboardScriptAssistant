const assert = require("node:assert/strict");
const test = require("node:test");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  CHANGE_SUMMARY_BEGIN,
  CHANGE_SUMMARY_END,
  parseSkillCreatorApplyResult,
  targetSkillPathFor,
  UPDATED_SKILL_BEGIN,
  UPDATED_SKILL_END,
  validateUpdatedSkillMarkdown,
  VALIDATION_NOTES_BEGIN,
  VALIDATION_NOTES_END,
  writeSkillCreatorUpdatedSkill,
} = require("./skillCreatorLearning");

const BASE_SKILL = [
  "---",
  "name: storyboard-generate",
  "description: Generate AI manju storyboard scripts.",
  "---",
  "",
  "# 分镜生成",
  "",
  "按稳定分镜规范输出。",
  "",
].join("\n");

test("targetSkillPathFor maps storyboard learning to the official storyboard skill", () => {
  assert.equal(targetSkillPathFor("storyboard-generate"), "skills/03-storyboard/storyboard-generate");
  assert.equal(targetSkillPathFor("unknown"), "skills/05-evolution/skill-creator");
});

test("parseSkillCreatorApplyResult accepts skill-creator JSON output", () => {
  const parsed = parseSkillCreatorApplyResult(JSON.stringify({
    updatedSkillMarkdown: `${BASE_SKILL}\n## 台词约束\n\n每个镜号只能保留一行台词。\n`,
    changeSummary: "补充分镜台词约束。",
    validationNotes: "保留原技能 name。",
  }));

  assert.match(parsed.updatedSkillMarkdown, /每个镜号只能保留一行台词/);
  assert.equal(parsed.changeSummary, "补充分镜台词约束。");
  assert.equal(parsed.validationNotes, "保留原技能 name。");
});

test("parseSkillCreatorApplyResult accepts marked markdown output", () => {
  const parsed = parseSkillCreatorApplyResult([
    UPDATED_SKILL_BEGIN,
    `${BASE_SKILL}\n## 台词约束\n\n每个镜号只能保留一行台词。\n`,
    UPDATED_SKILL_END,
    CHANGE_SUMMARY_BEGIN,
    "补充分镜台词约束。",
    CHANGE_SUMMARY_END,
    VALIDATION_NOTES_BEGIN,
    "保留原技能 name。",
    VALIDATION_NOTES_END,
  ].join("\n"));

  assert.match(parsed.updatedSkillMarkdown, /每个镜号只能保留一行台词/);
  assert.equal(parsed.changeSummary, "补充分镜台词约束。");
  assert.equal(parsed.validationNotes, "保留原技能 name。");
});

test("writeSkillCreatorUpdatedSkill writes only validated skill-creator output", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-creator-learning-"));
  const skillDir = path.join(root, "skills", "03-storyboard", "storyboard-generate");
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), BASE_SKILL, "utf8");

  const updatedSkillMarkdown = `${BASE_SKILL}\n## 台词约束\n\n一个镜号下只能有一行台词，不得改动既有分镜字段格式。\n`;
  const result = await writeSkillCreatorUpdatedSkill(root, {
    skillId: "storyboard-generate",
    learningId: "learn-a",
    creatorOutput: JSON.stringify({
      updatedSkillMarkdown,
      changeSummary: "新增台词行数约束。",
      validationNotes: "frontmatter 保持不变。",
    }),
  });

  assert.equal(result.skillId, "storyboard-generate");
  assert.equal(result.relativePath, "skills/03-storyboard/storyboard-generate/SKILL.md");
  assert.equal(result.changeSummary, "新增台词行数约束。");

  const text = await fsp.readFile(path.join(root, result.relativePath), "utf8");
  assert.match(text, /一个镜号下只能有一行台词/);
  assert.doesNotMatch(text, /MBH_SKILL_LEARNING_BEGIN/);
  assert.doesNotMatch(text, /用户学习规则（自动写入）/);
});

test("validateUpdatedSkillMarkdown rejects old raw auto-write block", () => {
  const polluted = `${BASE_SKILL}\n<!-- MBH_SKILL_LEARNING_BEGIN -->\n## 用户学习规则（自动写入）\n`;
  assert.throws(
    () => validateUpdatedSkillMarkdown(polluted, BASE_SKILL),
    /旧的自动直写区块/,
  );
});

test("writeSkillCreatorUpdatedSkill rejects output that changes skill name", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-skill-creator-learning-"));
  const skillDir = path.join(root, "skills", "03-storyboard", "storyboard-generate");
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), BASE_SKILL, "utf8");

  const badSkill = BASE_SKILL.replace("name: storyboard-generate", "name: another-skill");
  await assert.rejects(
    writeSkillCreatorUpdatedSkill(root, {
      skillId: "storyboard-generate",
      creatorOutput: JSON.stringify({ updatedSkillMarkdown: badSkill }),
    }),
    /不应修改技能 name/,
  );
});
