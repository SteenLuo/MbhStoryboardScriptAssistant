const assert = require("assert");
const test = require("node:test");

const { formatTokenUsage } = require("./usage-format");

test("formatTokenUsage renders compact total token text", () => {
  assert.strictEqual(formatTokenUsage({ total_tokens: 416 }), "token 416");
  assert.strictEqual(formatTokenUsage({ total_tokens: 11321 }), "token 11.3k");
});

test("formatTokenUsage hides missing usage", () => {
  assert.strictEqual(formatTokenUsage(null), "");
  assert.strictEqual(formatTokenUsage({}), "");
});
