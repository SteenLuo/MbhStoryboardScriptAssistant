const assert = require("assert");
const test = require("node:test");

const { buildOutgoingText, canSendCompose } = require("./compose-validation");

test("canSendCompose rejects empty text even when a compose mode is selected", () => {
  assert.strictEqual(canSendCompose({ text: "", attachments: [], composeMode: "learning" }), false);
  assert.strictEqual(canSendCompose({ text: "   ", attachments: [], composeMode: "learning" }), false);
});

test("canSendCompose allows text or attachments", () => {
  assert.strictEqual(canSendCompose({ text: "小说正文", attachments: [], composeMode: "" }), true);
  assert.strictEqual(canSendCompose({ text: "", attachments: [{ name: "script.md" }], composeMode: "learning" }), true);
});

test("buildOutgoingText preserves learning material without generation prompts", () => {
  assert.strictEqual(buildOutgoingText("正文", "learning"), "正文");
  assert.strictEqual(buildOutgoingText("", "learning"), "");
});
