const assert = require("node:assert/strict");
const test = require("node:test");

const {
  markdownToModelPlainText,
  modelMessagesToPlainText,
} = require("./modelPlainText");

test("markdownToModelPlainText removes display markdown while preserving structure", () => {
  const markdown = [
    "# 第1集",
    "",
    "**人物：** 林秀娥",
    "- 台词：林秀娥：我回来了。",
    "> 场景需要保持连续。",
    "",
    "```text",
    "镜号：1",
    "```",
  ].join("\n");

  assert.strictEqual(markdownToModelPlainText(markdown), [
    "第1集",
    "",
    "人物： 林秀娥",
    "台词：林秀娥：我回来了。",
    "场景需要保持连续。",
    "",
    "镜号：1",
  ].join("\n"));
});

test("markdownToModelPlainText handles fragmented emphasis and markdown tables", () => {
  const markdown = [
    "**第****十三****集：**",
    "",
    "| 镜号 | 台词 |",
    "| --- | --- |",
    "| 1 | **林秀娥：**回来了。 |",
  ].join("\n");

  assert.strictEqual(markdownToModelPlainText(markdown), [
    "第十三集：",
    "",
    "镜号；台词",
    "1；林秀娥：回来了。",
  ].join("\n"));
});

test("markdownToModelPlainText preserves machine markers and useful link targets", () => {
  const markdown = [
    "=== UPDATED_SKILL_MD_BEGIN ===",
    "请查看 [分镜规则](references/分镜规则.md)。",
    "<<<EPISODE:17>>>",
  ].join("\n");

  const plain = markdownToModelPlainText(markdown);

  assert.match(plain, /UPDATED_SKILL_MD_BEGIN/);
  assert.match(plain, /分镜规则（references\/分镜规则\.md）/);
  assert.match(plain, /<<<EPISODE:17>>>/);
});

test("modelMessagesToPlainText normalizes every textual message without changing roles", () => {
  const messages = modelMessagesToPlainText([
    { role: "system", content: "## 规则\n\n- 不改台词" },
    { role: "user", content: "**第1集**" },
  ]);

  assert.deepStrictEqual(messages, [
    { role: "system", content: "规则\n\n不改台词" },
    { role: "user", content: "第1集" },
  ]);
});
