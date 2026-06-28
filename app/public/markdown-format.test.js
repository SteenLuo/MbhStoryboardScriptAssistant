const assert = require("assert");
const test = require("node:test");

const { renderMarkdown } = require("./markdown-format");

test("renderMarkdown formats common assistant markdown", () => {
  const html = renderMarkdown([
    "### 分镜建议",
    "",
    "- 开场：猫主子入镜",
    "- 冲突：主角犹豫",
    "",
    "```text",
    "角色：先看这个镜头",
    "```",
  ].join("\n"));

  assert.match(html, /<h3>分镜建议<\/h3>/);
  assert.match(html, /<ul>\s*<li>开场：猫主子入镜<\/li>\s*<li>冲突：主角犹豫<\/li>\s*<\/ul>/);
  assert.match(html, /<pre><code>角色：先看这个镜头<\/code><\/pre>/);
});

test("renderMarkdown escapes raw html and unsafe links", () => {
  const html = renderMarkdown("**加粗** <script>alert(1)</script> [坏链接](javascript:alert(1))");

  assert.match(html, /<strong>加粗<\/strong>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /javascript:/);
});
