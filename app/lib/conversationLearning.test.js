const assert = require("assert");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
  classifyConversationLearning,
  writeConversationLearningRecord,
} = require("./conversationLearning");

test("classifyConversationLearning skips ordinary chat", () => {
  const result = classifyConversationLearning({
    userMessage: { content: "你好，今天能帮我看一下吗" },
  });

  assert.strictEqual(result, null);
});

test("classifyConversationLearning captures workflow and skill requirements", () => {
  const result = classifyConversationLearning({
    userMessage: { content: "这个一定要做，包括自主无感学习机制也要正常运行" },
    skillRoute: { id: "mbh-workflow", name: "总控路由" },
  });

  assert.strictEqual(result.needLearning, "是");
  assert.strictEqual(result.materialType, "流程偏好");
  assert.strictEqual(result.learningAction, "候选规则");
});

test("classifyConversationLearning captures lightweight English preference signals", () => {
  const result = classifyConversationLearning({
    userMessage: { content: "learning preference: from now on, avoid too many fixed camera shots" },
  });

  assert.strictEqual(result.needLearning, "是");
  assert.strictEqual(result.learningAction, "候选规则");
});

test("writeConversationLearningRecord creates a record usable by the learning cycle", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-"));
  const record = await writeConversationLearningRecord(
    root,
    {
      conversation: {
        id: "20260611-test",
        runName: "20260611-test-run",
      },
      userMessage: {
        content: "以后默认要读取本地 skill，并保持无感学习正常运行",
      },
      assistantMessage: {
        skillRoute: {
          id: "mbh-workflow",
          name: "总控路由",
          path: "skills/00-orchestrator/mbh-workflow",
          files: ["skills/00-orchestrator/mbh-workflow/SKILL.md"],
        },
      },
    },
    () => new Date("2026-06-11T04:30:00Z"),
  );

  const text = fs.readFileSync(record.path, "utf8");
  assert.match(text, /\| 是否需要学习 \| 是 \|/);
  assert.match(text, /\| 学习动作 \| 候选规则 \|/);
  assert.match(text, /skills\/00-orchestrator\/mbh-workflow\/SKILL.md/);
});
