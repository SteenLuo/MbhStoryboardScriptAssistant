const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { learnExplicitRule, updateCurrentRuleStatus } = require("./autonomousLearning");
const { buildLearningLibrary } = require("./learningLibrary");

test("buildLearningLibrary exposes records current rules and readonly skill groups", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-"));
  await fsp.mkdir(path.join(root, "skills/03-storyboard/storyboard-generate"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "skills/03-storyboard/storyboard-generate/SKILL.md"),
    [
      "---",
      "description: 用于把剧本生成标准 AI 漫剧分镜。",
      "---",
      "# 分镜生成",
      "",
      "## 使用场景",
      "",
      "当用户要求生成、修改或检查分镜时使用。",
      "",
    ].join("\n"),
    "utf8",
  );
  await fsp.mkdir(path.join(root, "skills/02-script/script-hard-issue-review"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "skills/02-script/script-hard-issue-review/SKILL.md"),
    [
      "---",
      "description: 用于检查 AI 漫剧剧本硬伤。",
      "---",
      "# 剧本硬伤评审",
      "",
      "检查剧情逻辑、画面可呈现性和格式问题。",
      "",
    ].join("\n"),
    "utf8",
  );

  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 20 字以内",
    summary: "分镜台词每句 20 字以内。",
    capability: "storyboard",
    sourceType: "conversation",
    conversationId: "chat-1",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-1",
  });
  await updateCurrentRuleStatus(root, {
    ruleId: "rule-event-1",
    status: "disabled",
  }, {
    now: () => "2026-07-01T10:05:00.000Z",
  });
  await fsp.mkdir(path.join(root, "learning/conversation-records"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "learning/conversation-records/2026-07-04-同一个镜号里边的台词不能超过20个字，超过要拆分镜头-chat01.md"),
    [
      "# 对话学习记录",
      "",
      "生成日期：2026-07-04",
      "",
      "## 一、判断结论",
      "",
      "| 项目 | 内容 |",
      "| --- | --- |",
      "| 标题 | 同一个镜号里边的台词不能超过20个字，超过要拆分镜头 |",
      "| 是否需要学习 | 是 |",
      "| 材料类型 | 分镜 |",
      "| 是否已采纳 | 未判断 |",
      "| 质量信号 | 无明显变化 |",
      "| 学习动作 | 候选规则 |",
      "",
      "## 三、证据",
      "",
      "用户消息：同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
      "",
    ].join("\n"),
    "utf8",
  );

  const library = await buildLearningLibrary(root);

  assert.ok(Array.isArray(library.records));
  assert.ok(Array.isArray(library.currentRules));
  assert.ok(Array.isArray(library.skills));
  assert.strictEqual(library.records.length, 1);
  assert.ok(library.records.some((record) => record.eventId === "event-1"));
  const eventRecord = library.records.find((record) => record.eventId === "event-1");
  assert.strictEqual(eventRecord.status, "已生效");
  assert.strictEqual(eventRecord.internalStatus, "landed");
  assert.strictEqual(eventRecord.jobStatus, "completed");
  assert.strictEqual(eventRecord.learningMode, "overall");
  assert.strictEqual(eventRecord.landingType, "current-rule");
  assert.ok(!library.records.some((record) => record.sourceType === "conversation_record"));
  assert.strictEqual(library.currentRules[0].topicKey, "storyboard.dialogue.length");
  assert.strictEqual(library.currentRules[0].status, "disabled");
  const storyboardSkill = library.skills.find((skill) => skill.id === "storyboard-generate");
  assert.ok(storyboardSkill);
  assert.match(storyboardSkill.description, /标准 AI 漫剧分镜/);
  assert.match(storyboardSkill.instructions, /使用场景/);
  const hardIssueSkill = library.skills.find((skill) => skill.path === "skills/02-script/script-hard-issue-review");
  assert.ok(hardIssueSkill);
  assert.match(hardIssueSkill.description, /剧本硬伤/);
  assert.strictEqual(hardIssueSkill.exists, true);
  assert.strictEqual(hardIssueSkill.discovered, true);
  assert.ok(library.skills.every((skill) => skill.readonly === true));
});
