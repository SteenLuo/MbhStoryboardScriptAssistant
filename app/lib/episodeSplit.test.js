const assert = require("assert");
const test = require("node:test");

const {
  buildStoryboardNodePlan,
  splitScriptIntoEpisodes,
} = require("./episodeSplit");

test("splitScriptIntoEpisodes detects Arabic and Chinese episode headings", () => {
  const script = [
    "# 第1集 医院风波",
    "第一集内容",
    "## 第二集 反击开始",
    "第二集内容",
    "第十集 终局",
    "第十集内容",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), [1, 2, 10]);
  assert.strictEqual(episodes[0].title, "第1集 医院风波");
  assert.match(episodes[1].content, /第二集内容/);
});

test("splitScriptIntoEpisodes supports partial ranges with spaced episode headings", () => {
  const script = [
    "第 7 集 中段开始",
    "第七集内容",
    "第 8 集 继续推进",
    "第八集内容",
    "第 9 集 暗线浮出",
    "第九集内容",
    "第 10 集 反转",
    "第十集内容",
    "第11集 追击",
    "第十一集内容",
    "第12集 真相",
    "第十二集内容",
    "第13集 收束",
    "第十三集内容",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), [7, 8, 9, 10, 11, 12, 13]);
  assert.strictEqual(episodes[0].title, "第 7 集 中段开始");
  assert.match(episodes[3].content, /第十集内容/);
  assert.match(episodes[6].content, /第十三集内容/);
});

test("splitScriptIntoEpisodes falls back to a single episode when no heading exists", () => {
  const episodes = splitScriptIntoEpisodes("这是一个未分集的短剧剧本。");

  assert.strictEqual(episodes.length, 1);
  assert.strictEqual(episodes[0].number, 1);
  assert.strictEqual(episodes[0].title, "第1集");
});

test("splitScriptIntoEpisodes does not leak the next markdown heading marker", () => {
  const script = [
    "# \u7b2c1\u96c6 \u533b\u9662\u98ce\u6ce2",
    "\u7b2c\u4e00\u96c6\u5185\u5bb9",
    "## \u7b2c2\u96c6 \u53cd\u51fb\u5f00\u59cb",
    "\u7b2c\u4e8c\u96c6\u5185\u5bb9",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.strictEqual(episodes.length, 2);
  assert.strictEqual(episodes[0].content.includes("##"), false);
  assert.strictEqual(episodes[0].content.includes("\u7b2c2\u96c6"), false);
});

test("buildStoryboardNodePlan positions one storyboard node per confirmed episode", () => {
  const episodes = [
    { number: 1, title: "第1集", content: "A" },
    { number: 2, title: "第2集", content: "B" },
    { number: 3, title: "第3集", content: "C" },
  ];

  const plan = buildStoryboardNodePlan({ scriptNodeId: "script-1", episodes }, () => "id01");

  assert.strictEqual(plan.nodes.length, 3);
  assert.strictEqual(plan.edges.length, 3);
  assert.deepStrictEqual(plan.nodes.map((node) => node.type), ["storyboard", "storyboard", "storyboard"]);
  assert.ok(plan.nodes[2].y > plan.nodes[0].y);
});
