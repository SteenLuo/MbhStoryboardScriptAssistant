const assert = require("assert");
const test = require("node:test");

const { classifyChatIntent, selectHistoryForIntent } = require("./chatIntent");

test("classifyChatIntent keeps casual chat lightweight", () => {
  const intent = classifyChatIntent({ message: "哈哈，今天随便聊聊" });

  assert.strictEqual(intent.mode, "light");
  assert.strictEqual(intent.intent, "chat");
});

test("classifyChatIntent routes story inspiration brainstorming to skills", () => {
  const intent = classifyChatIntent({ message: "我想做豪门强女主，有什么冲突方向？" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "inspiration");
});

test("classifyChatIntent routes explicit script generation to skills", () => {
  const intent = classifyChatIntent({ message: "根据下面小说生成剧本" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "script");
});

test("classifyChatIntent routes script beat analysis to skills", () => {
  const intent = classifyChatIntent({ message: "分析一下这个剧本爽点" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "script_analysis");
});

test("classifyChatIntent routes plot revision advice to script analysis", () => {
  const intent = classifyChatIntent({ message: "对于现有的剧情有什么修改建议，比如哪些剧情进展平和没有起伏" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "script_analysis");
});

test("classifyChatIntent routes storyboard review questions to skills", () => {
  const intent = classifyChatIntent({ message: "当前分镜生成的规则有哪些？" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "storyboard_analysis");
});

test("classifyChatIntent routes general domain messages to script analysis skills", () => {
  const intent = classifyChatIntent({ message: "这个角色的人设是不是前后矛盾？" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "script_analysis");
});

test("classifyChatIntent routes upload-only material messages to script analysis", () => {
  const intent = classifyChatIntent({
    message: "已上传附件。",
    attachments: [{ name: "样章.txt", text: "第一章 落魄的中医" }],
  });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "script_analysis");
});

test("classifyChatIntent routes explicit storyboard generation to skills", () => {
  const intent = classifyChatIntent({ message: "把这个剧本生成分镜" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "storyboard");
});

test("classifyChatIntent routes English storyboard generation to skills", () => {
  const intent = classifyChatIntent({ message: "storyboard: generate storyboard from this accepted script" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "storyboard");
});

test("classifyChatIntent routes learning preferences to skills", () => {
  const intent = classifyChatIntent({ message: "以后分镜不要连续固定镜头，记住这个偏好" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "learning");
});

test("classifyChatIntent honors explicit button intent", () => {
  const intent = classifyChatIntent({ message: "这是一段正文", intent: "storyboard" });

  assert.strictEqual(intent.mode, "skill");
  assert.strictEqual(intent.intent, "storyboard");
});

test("selectHistoryForIntent caps light chat history", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `message-${index}`,
  }));
  const picked = selectHistoryForIntent(messages, { mode: "light" });

  assert.strictEqual(picked.length, 6);
  assert.strictEqual(picked[0].content, "message-6");
});
