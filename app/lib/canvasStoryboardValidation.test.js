const assert = require("node:assert/strict");
const test = require("node:test");

const { applyCanvasStoryboardValidation } = require("./canvasStoryboardValidation");
const { storyboardContentFingerprint } = require("./storyboardValidation");

const dialogueRule = {
  ruleId: "rule-dialogue-length",
  topicKey: "storyboard.dialogue.length",
  conflictKey: "storyboard.dialogue.length",
  capability: "storyboard",
  sourceEventIds: ["event-dialogue-length"],
};

test("applyCanvasStoryboardValidation repairs long dialogue on canvas save", () => {
  const canvas = {
    id: "canvas-a",
    nodes: [
      {
        id: "storyboard-a",
        type: "storyboard",
        title: "第1集 分镜",
        content: [
          "镜号：12",
          "台词：王婶：秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？",
        ].join("\n"),
        meta: {},
      },
    ],
  };

  const next = applyCanvasStoryboardValidation(canvas);
  const node = next.nodes[0];

  assert.notStrictEqual(node.content, canvas.nodes[0].content);
  assert.strictEqual(node.meta.validation.ok, true);
  assert.strictEqual(node.meta.validation.issues.length, 0);
  assert.strictEqual(node.meta.hardRuleValidation.checked, true);
  assert.strictEqual(node.meta.hardRuleValidation.repaired, true);
  assert.strictEqual(node.meta.hardRuleValidation.finalOk, true);
  assert.strictEqual(node.meta.currentRulesUsed, undefined);
  assert.ok(node.meta.skillRulesUsed.length > 0);
});

test("applyCanvasStoryboardValidation preserves user-resolved storyboard content", () => {
  const content = "台词：王婶：秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？";
  const canvas = {
    id: "canvas-a",
    nodes: [
      {
        id: "storyboard-a",
        type: "storyboard",
        title: "第1集 分镜",
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

  const next = applyCanvasStoryboardValidation(canvas, { currentRulesUsed: [dialogueRule] });

  assert.strictEqual(next.nodes[0].content, content);
  assert.deepStrictEqual(next.nodes[0].meta, canvas.nodes[0].meta);
});
