const assert = require("node:assert/strict");
const test = require("node:test");

const { applyCanvasStoryboardValidation } = require("./canvasStoryboardValidation");
const { storyboardContentFingerprint } = require("./storyboardValidation");

const LONG_DIALOGUE_STORYBOARD = [
  "shot: 12",
  "dialogue: Wang: The system will become more complete and the team will keep improving together",
].join("\n");

test("applyCanvasStoryboardValidation does not flag dialogue length by default", () => {
  const canvas = {
    id: "canvas-a",
    nodes: [
      {
        id: "storyboard-a",
        type: "storyboard",
        title: "Episode 1 Storyboard",
        content: LONG_DIALOGUE_STORYBOARD,
        meta: {},
      },
    ],
  };

  const next = applyCanvasStoryboardValidation(canvas);
  const node = next.nodes[0];

  assert.strictEqual(node.content, canvas.nodes[0].content);
  assert.strictEqual(node.meta.validation.ok, true);
  assert.strictEqual(node.meta.validation.issues.length, 0);
  assert.strictEqual(node.meta.hardRuleValidation, undefined);
  assert.strictEqual(node.meta.skillRulesUsed, undefined);
  assert.strictEqual(node.meta.currentRulesUsed, undefined);
});

test("applyCanvasStoryboardValidation records long dialogue when stable skill rules are enabled", () => {
  const canvas = {
    id: "canvas-a",
    nodes: [
      {
        id: "storyboard-a",
        type: "storyboard",
        title: "Episode 1 Storyboard",
        content: LONG_DIALOGUE_STORYBOARD,
        meta: {},
      },
    ],
  };

  const next = applyCanvasStoryboardValidation(canvas, { useStableSkillRules: true });
  const node = next.nodes[0];

  assert.strictEqual(node.content, canvas.nodes[0].content);
  assert.strictEqual(node.meta.validation.ok, false);
  assert.ok(node.meta.validation.issues.length > 0);
  assert.strictEqual(node.meta.hardRuleValidation.checked, true);
  assert.strictEqual(node.meta.hardRuleValidation.repaired, false);
  assert.strictEqual(node.meta.hardRuleValidation.finalOk, false);
  assert.strictEqual(node.meta.currentRulesUsed, undefined);
  assert.ok(node.meta.skillRulesUsed.length > 0);
});

test("applyCanvasStoryboardValidation preserves user-resolved storyboard content", () => {
  const content = LONG_DIALOGUE_STORYBOARD;
  const canvas = {
    id: "canvas-a",
    nodes: [
      {
        id: "storyboard-a",
        type: "storyboard",
        title: "Episode 1 Storyboard",
        content,
        meta: {
          validation: { ok: true, issues: [] },
          validationResolution: {
            action: "adopted",
            contentFingerprint: storyboardContentFingerprint(content),
          },
        },
      },
    ],
  };

  const next = applyCanvasStoryboardValidation(canvas);

  assert.strictEqual(next.nodes[0].content, content);
  assert.deepStrictEqual(next.nodes[0].meta, canvas.nodes[0].meta);
});

test("applyCanvasStoryboardValidation uses source script node for grounding checks", () => {
  const canvas = {
    id: "canvas-source",
    nodes: [
      {
        id: "script-a",
        type: "script",
        title: "剧本",
        content: [
          "第五十一集",
          "51-1 日 外 林家院子",
          "人物：林秀娥、林大柱、村民们",
          "△快过年了，林秀娥出钱，把家里的老屋翻新了。",
          "村民甲：大柱，你家可真是翻身了！这房子，比村支书家都气派！",
        ].join("\n"),
        meta: {},
      },
      {
        id: "storyboard-a",
        type: "storyboard",
        title: "第五十一集 分镜",
        content: [
          "场次：51-1",
          "人物：林秀娥、林大柱、村民们",
          "镜号：1",
          "景别：反打近景",
          "运镜：固定",
          "情绪/动作：几只鸡在干净的院子里啄食，一个新贴的福字贴在玻璃窗上。",
          "音效：",
          "台词：村民甲：这房子，比村支书家都气派！",
          "时长：3s",
        ].join("\n"),
        meta: {
          sourceScriptNodeId: "script-a",
        },
      },
    ],
  };

  const next = applyCanvasStoryboardValidation(canvas, { useStableSkillRules: true });
  const node = next.nodes.find((item) => item.id === "storyboard-a");

  assert.strictEqual(node.meta.hardRuleValidation.checked, true);
  assert.strictEqual(node.meta.hardRuleValidation.repaired, true);
  assert.strictEqual(node.meta.hardRuleValidation.finalOk, true);
  assert.match(node.meta.hardRuleValidation.repairStrategy, /repair-source-grounding/);
  assert.doesNotMatch(node.content, /鸡|福字/);
});
