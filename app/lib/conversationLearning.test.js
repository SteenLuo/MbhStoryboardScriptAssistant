const assert = require("assert");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
  classifyConversationLearning,
  extractExplicitRuleLearningInput,
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
  assert.strictEqual(result.learningAction, "学习记录");
});

test("classifyConversationLearning captures lightweight English preference signals", () => {
  const result = classifyConversationLearning({
    userMessage: { content: "learning preference: from now on, avoid too many fixed camera shots" },
  });

  assert.strictEqual(result.needLearning, "是");
  assert.strictEqual(result.learningAction, "学习记录");
});

test("classifyConversationLearning records explicit learning-mode material without keywords", () => {
  const result = classifyConversationLearning({
    userMessage: {
      content: "这是一份优秀分镜样例，适合作为后续拆镜参考。",
      learningMode: true,
    },
  });

  assert.strictEqual(result.needLearning, "是");
  assert.strictEqual(result.materialType, "分镜");
  assert.strictEqual(result.learningAction, "学习记录");
});

test("classifyConversationLearning captures repeated storyboard constraints", () => {
  const userMessage = {
    role: "user",
    content: "同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
  };
  const result = classifyConversationLearning({
    conversation: {
      messages: [
        { role: "user", content: "分镜台词超过20字要拆镜头" },
        userMessage,
      ],
    },
    userMessage,
    skillRoute: { id: "storyboard-generate", name: "分镜生成" },
  });

  assert.strictEqual(result.needLearning, "是");
  assert.strictEqual(result.materialType, "分镜");
  assert.strictEqual(result.triggerReason, "重复强调");
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
  assert.match(text, /\| 学习动作 \| 学习记录 \|/);
  assert.match(text, /skills\/00-orchestrator\/mbh-workflow\/SKILL.md/);
  assert.equal(record.suggestion, undefined);
});

test("writeConversationLearningRecord includes readable attachment evidence", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-attachment-"));
  const record = await writeConversationLearningRecord(
    root,
    {
      conversation: { id: "20260704-learn" },
      userMessage: {
        content: "",
        learningMode: true,
        attachments: [{
          name: "good-storyboard.md",
          type: "text/markdown",
          extracted: true,
          text: "这是一个适合学习的分镜样例正文。",
        }],
      },
      assistantMessage: {
        skillRoute: { id: "sample-ingest", name: "样例学习", path: "skills/04-learning/sample-ingest" },
      },
    },
    () => new Date("2026-07-04T02:30:00Z"),
  );

  const text = fs.readFileSync(record.path, "utf8");
  assert.match(text, /good-storyboard\.md/);
  assert.match(text, /这是一个适合学习的分镜样例正文/);
});

test("extractExplicitRuleLearningInput turns clear future rules into fast-channel learning input", () => {
  const input = extractExplicitRuleLearningInput({
    conversation: { id: "chat-1" },
    userMessage: { content: "以后分镜台词每句 20 字以内，超出就拆新分镜。" },
    assistantMessage: {
      skillRoute: { id: "storyboard-generate", name: "分镜生成" },
      usage: { total_tokens: 42 },
    },
  });

  assert.strictEqual(input.conversationId, "chat-1");
  assert.strictEqual(input.capability, "storyboard");
  assert.match(input.summary, /20 字以内/);
  assert.match(input.rawTrigger, /拆新分镜/);
  assert.strictEqual(input.tokenUsage.total_tokens, 42);
});

test("extractExplicitRuleLearningInput promotes repeated constraints without future-rule keywords", () => {
  const userMessage = {
    role: "user",
    content: "同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
  };
  const input = extractExplicitRuleLearningInput({
    conversation: {
      id: "chat-repeat",
      messages: [
        { role: "user", content: "分镜台词超过20字要拆镜头" },
        userMessage,
      ],
    },
    userMessage,
    assistantMessage: {
      skillRoute: { id: "storyboard-generate", name: "分镜生成" },
    },
  });

  assert.strictEqual(input.conversationId, "chat-repeat");
  assert.strictEqual(input.capability, "storyboard");
  assert.match(input.summary, /不能超过20个字/);
  assert.match(input.rawTrigger, /重复强调依据/);
});

test("extractExplicitRuleLearningInput treats explicit skill learning button as a rule", () => {
  const input = extractExplicitRuleLearningInput({
    conversation: { id: "chat-2" },
    userMessage: {
      content: "同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
      learningMode: true,
    },
    assistantMessage: {
      skillRoute: { id: "sample-ingest", name: "样例学习" },
    },
  });

  assert.strictEqual(input.conversationId, "chat-2");
  assert.strictEqual(input.capability, "storyboard");
  assert.match(input.summary, /不能超过20个字/);
  assert.match(input.rawTrigger, /拆分镜头/);
});
