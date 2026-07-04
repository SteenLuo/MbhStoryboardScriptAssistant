const assert = require("assert");
const test = require("node:test");

const { renderMarkdown, markdownFromHtml } = require("./markdown-format");

test("renderMarkdown formats common assistant markdown", () => {
  const html = renderMarkdown([
    "### 分镜建议",
    "",
    "- 开场：猫主子入镜",
    "- 冲突：主角犹豫",
    "",
    "---",
    "",
    "```text",
    "角色：先看这个镜头",
    "```",
  ].join("\n"));

  assert.match(html, /<h3>分镜建议<\/h3>/);
  assert.match(html, /<ul>\s*<li>开场：猫主子入镜<\/li>\s*<li>冲突：主角犹豫<\/li>\s*<\/ul>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<pre><code>角色：先看这个镜头<\/code><\/pre>/);
});

test("renderMarkdown escapes raw html and unsafe links", () => {
  const html = renderMarkdown("**加粗** <script>alert(1)</script> [坏链接](javascript:alert(1))");

  assert.match(html, /<strong>加粗<\/strong>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /javascript:/);
});

test("renderMarkdown supports safe color spans from toolbar syntax", () => {
  const html = renderMarkdown("[重点台词]{#ff4d4f} [坏颜色]{javascript:alert(1)}");

  assert.match(html, /<span style="color: #ff4d4f">重点台词<\/span>/);
  assert.doesNotMatch(html, /javascript:/);
});

test("markdownFromHtml converts rich editor html back to markdown", () => {
  const markdown = markdownFromHtml([
    "<h2>第二集</h2>",
    "<p><strong>冲突升级</strong>，<em>角色犹豫</em></p>",
    "<hr>",
    "<ul><li>镜头一</li><li><span style=\"color: #ef4444\">重点台词</span></li></ul>",
    "<blockquote><p>旁白提示</p></blockquote>",
  ].join(""));

  assert.match(markdown, /## 第二集/);
  assert.match(markdown, /\*\*冲突升级\*\*，\*角色犹豫\*/);
  assert.match(markdown, /---/);
  assert.match(markdown, /- 镜头一/);
  assert.match(markdown, /- \[重点台词\]\{#ef4444\}/);
  assert.match(markdown, /> 旁白提示/);
});
