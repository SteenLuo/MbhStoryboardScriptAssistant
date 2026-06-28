const assert = require("assert");
const test = require("node:test");

const { buildOutgoingText, canSendCompose } = require("./compose-validation");

test("canSendCompose rejects empty text even when a compose mode is selected", () => {
  assert.strictEqual(canSendCompose({ text: "", attachments: [], composeMode: "script" }), false);
  assert.strictEqual(canSendCompose({ text: "   ", attachments: [], composeMode: "storyboard" }), false);
});

test("canSendCompose allows text or attachments", () => {
  assert.strictEqual(canSendCompose({ text: "小说正文", attachments: [], composeMode: "" }), true);
  assert.strictEqual(canSendCompose({ text: "", attachments: [{ name: "script.md" }], composeMode: "storyboard" }), true);
});

test("buildOutgoingText only adds compose prompt after validation decides sending is allowed", () => {
  assert.strictEqual(buildOutgoingText("正文", "script"), "请将以下内容按 AI 漫剧标准生成剧本。\n\n正文");
  assert.strictEqual(buildOutgoingText("", "storyboard"), "请将以下内容按 AI 漫剧标准生成分镜。");
});
