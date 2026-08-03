const assert = require("assert");
const test = require("node:test");

const {
  buildStoryboardNodePlan,
  parseEpisodeNumber,
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

test("splitScriptIntoEpisodes detects markdown bold episode headings", () => {
  const script = [
    "**\u7b2c\u4e00\u96c6\uff1a **",
    "1-1 \u5185 \u8c08\u5224\u684c",
    "\u7b2c\u4e00\u96c6\u5185\u5bb9",
    "**\u7b2c\u4e8c\u96c6\uff1a **",
    "2-1 \u5185 \u516c\u5bd3",
    "\u7b2c\u4e8c\u96c6\u5185\u5bb9",
    "**\u7b2c\u4e09\u96c6\uff1a **",
    "3-1 \u5185 \u623f\u95f4",
    "\u7b2c\u4e09\u96c6\u5185\u5bb9",
  ].join("\n\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), [1, 2, 3]);
  assert.strictEqual(episodes[0].title, "\u7b2c\u4e00\u96c6\uff1a");
  assert.strictEqual(episodes[1].title, "\u7b2c\u4e8c\u96c6\uff1a");
  assert.strictEqual(episodes[0].content.startsWith("1-1"), true);
  assert.strictEqual(episodes[0].content.includes("\u7b2c\u4e8c\u96c6"), false);
});

test("splitScriptIntoEpisodes detects episode headings with fragmented markdown emphasis", () => {
  const script = [
    "**第****十三****集：**",
    "13-1 场景：日 内 管理员室",
    "第十三集内容",
    "**第****十四****集：**",
    "14-1 场景：日 内 管理员室",
    "第十四集内容",
    "**第****十五****集：**",
    "15-1 场景：夜 内 房间",
    "第十五集内容",
    "**第****十六****集：**",
    "16-1 场景：夜 内 走廊",
    "第十六集内容",
    "**第****十七****集：**",
    "17-1 场景：夜 内 404房间",
    "第十七集内容",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), [13, 14, 15, 16, 17]);
  assert.deepStrictEqual(episodes.map((item) => item.title), [
    "第十三集：",
    "第十四集：",
    "第十五集：",
    "第十六集：",
    "第十七集：",
  ]);
  assert.strictEqual(episodes[0].content.startsWith("13-1"), true);
  assert.strictEqual(episodes[0].content.includes("第十四集内容"), false);
  assert.strictEqual(episodes[4].content.includes("第十七集内容"), true);
});

test("splitScriptIntoEpisodes recognizes visually obvious episode heading formats", () => {
  const headings = [
    ["**（第１集：开场）**", 1],
    ["(第2集)", 2],
    ["【第三话】", 3],
    ["《第十七章：反转》", 17],
    ["第(18)集", 18],
    ["第⑲集", 19],
    ["EP. 20", 20],
    ["第㉑集", 21],
    ["第伍期", 5],
  ];
  const script = headings.flatMap(([heading, number]) => [
    heading,
    `${number}-1 场景：日 内 测试场景`,
  ]).join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), headings.map((item) => item[1]));
  assert.strictEqual(episodes[0].title, "（第１集：开场）");
  assert.strictEqual(episodes[6].content.startsWith("20-1"), true);
});

test("splitScriptIntoEpisodes recognizes standalone wrapped and decorated episode numbers", () => {
  const headings = [
    ["(1)", 1],
    ["（２）", 2],
    ["[3]", 3],
    ["【17】", 17],
    ["《18》", 18],
    ["⑲", 19],
    ["⑳", 20],
    ["｛4｝", 4],
    ["＜5＞", 5],
    ["〈6〉", 6],
    ["［7］", 7],
    ["﹝8﹞", 8],
    ["〘9〙", 9],
    ["1️⃣", 1],
    ["㊿", 50],
  ];
  const script = headings.flatMap(([heading, number]) => [
    heading,
    `${number}-1 场景：夜 内 测试场景`,
  ]).join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), headings.map((item) => item[1]));
});

test("splitScriptIntoEpisodes recognizes numbered prefixes before explicit episode titles", () => {
  const script = [
    "① 第一集 开始",
    "1-1 场景：日 内 房间",
    "(2) 第二集 继续",
    "2-1 场景：日 内 走廊",
    "3）第3集 收束",
    "3-1 场景：夜 外 天台",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), [1, 2, 3]);
});

test("splitScriptIntoEpisodes recognizes bare episode numbers only with matching scene context", () => {
  const script = [
    "1",
    "1-1 场景：日 内 房间",
    "2",
    "2-1 场景：日 内 走廊",
    "１７",
    "１７-1 场景：夜 外 天台",
    "十八",
    "18-1 场景：夜 内 客厅",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.deepStrictEqual(episodes.map((item) => item.number), [1, 2, 17, 18]);
});

test("splitScriptIntoEpisodes does not confuse scene numbers or prose lists with episodes", () => {
  const script = [
    "13-1 场景：日 内 管理员室",
    "1. 道具准备",
    "秦穹：第一集内容我已经看过了。",
    "（近景）角色推门进入。",
    "第17集团正在开会。",
    "17",
    "这只是倒计时中的数字，不是场次标题。",
  ].join("\n");

  const episodes = splitScriptIntoEpisodes(script);

  assert.strictEqual(episodes.length, 1);
  assert.strictEqual(episodes[0].number, 1);
  assert.strictEqual(episodes[0].content, script);
});

test("parseEpisodeNumber supports full-width, decorated, and larger Chinese numbers", () => {
  assert.strictEqual(parseEpisodeNumber("１７"), 17);
  assert.strictEqual(parseEpisodeNumber("⑱"), 18);
  assert.strictEqual(parseEpisodeNumber("㊿"), 50);
  assert.strictEqual(parseEpisodeNumber("1️⃣8️⃣"), 18);
  assert.strictEqual(parseEpisodeNumber("一百零二"), 102);
  assert.strictEqual(parseEpisodeNumber("壹佰零贰"), 102);
  assert.strictEqual(parseEpisodeNumber("二〇三"), 203);
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
