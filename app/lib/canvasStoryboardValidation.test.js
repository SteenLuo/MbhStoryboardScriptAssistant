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
