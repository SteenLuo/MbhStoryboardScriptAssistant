const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getApplicableStoryboardHardRules,
  isStoryboardValidationResolved,
  repairStoryboardDialogueIssues,
  storyboardContentFingerprint,
  splitDialogueLine,
  validateStoryboardHardRules,
  validateStoryboardContent,
} = require("./storyboardValidation");

function countTextCharacters(text) {
  return Array.from(String(text || "")).filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
}

test("validateStoryboardContent flags dialogue lines longer than 20 Chinese characters", () => {
  const content = [
    "镜号：8",
    "台词：林秀娥：会有更完善的制度，更好的待遇，更大的发展空间，希望大家继续努力。",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].lineNumber, 2);
  assert.strictEqual(result.issues[0].type, "dialogue-too-long");
  assert.ok(result.issues[0].suggestedLines.length > 1);
  assert.ok(result.issues[0].suggestedLines.every((line) => countTextCharacters(line.text) <= 20));
});

test("validateStoryboardContent counts only the spoken dialogue after speaker labels", () => {
  const content = [
    "镜号：8",
    "台词：OS（林秀娥，平静，很轻地看向镜头）：你好。",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardContent does not count punctuation toward the 20 character limit", () => {
  const content = [
    "镜号：8",
    "台词：陈建军：林家村的吧？我下村的时候见过你。来镇上办事？",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardContent reports the spoken dialogue without speaker labels", () => {
  const content = [
    "镜号：8",
    "台词：OS（林秀娥，平静）：会有更完善的制度，更好的待遇，更大的发展空间，希望大家继续努力。",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].dialogue, "会有更完善的制度，更好的待遇，更大的发展空间，希望大家继续努力。");
});

test("storyboardContentFingerprint changes when storyboard text changes", () => {
  const original = "台词：林秀娥：你好。";
  const changed = "台词：林秀娥：你好啊。";

  assert.strictEqual(storyboardContentFingerprint(original), storyboardContentFingerprint(original));
  assert.notStrictEqual(storyboardContentFingerprint(original), storyboardContentFingerprint(changed));
});

test("isStoryboardValidationResolved only accepts the same handled storyboard version", () => {
  const content = "台词：林秀娥：会有更完善的制度，更好的待遇，更大的发展空间。";
  const node = {
    type: "storyboard",
    content,
    meta: {
      validationResolution: {
        action: "acknowledged",
        contentFingerprint: storyboardContentFingerprint(content),
      },
    },
  };

  assert.strictEqual(isStoryboardValidationResolved(node), true);
  assert.strictEqual(isStoryboardValidationResolved({ ...node, content: `${content}新增一句。` }), false);
  assert.strictEqual(isStoryboardValidationResolved({
    ...node,
    meta: { validationResolution: { action: "ignored", contentFingerprint: storyboardContentFingerprint(content) } },
  }), false);
});

test("splitDialogueLine keeps short dialogue unchanged", () => {
  const lines = splitDialogueLine("赵小满：那就这么定了。");

  assert.deepStrictEqual(lines, [{ text: "赵小满：那就这么定了。" }]);
});
test("validateStoryboardHardRules flags long dialogue only when a dialogue length rule was used", () => {
  const content = [
    "shot: 1",
    "dialogue: Lin: The system will become more complete and the team will keep improving together",
  ].join("\n");
  const currentRulesUsed = [{
    ruleId: "rule-dialogue-length",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    sourceEventIds: ["event-dialogue-length"],
    status: "active",
  }];

  const result = validateStoryboardHardRules(content, { currentRulesUsed });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.appliedRules.length, 1);
  assert.strictEqual(result.appliedRules[0].ruleId, "rule-dialogue-length");
  assert.strictEqual(result.issues[0].type, "dialogue-too-long");
  assert.strictEqual(result.issues[0].hardRuleId, "storyboard.dialogue.length");
});

test("repairStoryboardDialogueIssues splits long dialogue into lines within the hard limit", () => {
  const content = [
    "shot: 1",
    "dialogue: Lin: The system will become more complete and the team will keep improving together",
    "duration: 3s",
  ].join("\n");
  const validation = validateStoryboardHardRules(content, {
    currentRulesUsed: [{
      ruleId: "rule-dialogue-length",
      topicKey: "storyboard.dialogue.length",
      conflictKey: "storyboard.dialogue.length",
    }],
  });

  const repaired = repairStoryboardDialogueIssues(content, validation.issues);
  const repairedValidation = validateStoryboardContent(repaired.content);

  assert.strictEqual(repaired.repaired, true);
  assert.strictEqual(repairedValidation.ok, true);
});

test("repairStoryboardDialogueIssues preserves voice and speaker markers when splitting", () => {
  const cases = [
    { marker: "\u65c1\u767dVO\uff1a", expected: "\u53f0\u8bcd\uff1a\u65c1\u767dVO\uff1a" },
    { marker: "\u89d2\u8272OS\uff1a", expected: "\u53f0\u8bcd\uff1a\u89d2\u8272OS\uff1a" },
    { marker: "\u753b\u5916\u97f3\uff1a", expected: "\u53f0\u8bcd\uff1a\u753b\u5916\u97f3\uff1a" },
    { marker: "\u51cc\u5929\u5c0a\u8005OS\uff1a", expected: "\u53f0\u8bcd\uff1a\u51cc\u5929\u5c0a\u8005OS\uff1a" },
    { marker: "\u6797\u79c0\u5a25\uff1a", expected: "\u53f0\u8bcd\uff1a\u6797\u79c0\u5a25\uff1a" },
    { marker: "Lin:", expected: "\u53f0\u8bcd\uff1aLin:" },
  ];

  for (const item of cases) {
    const content = [
      "shot: 1",
      `\u53f0\u8bcd\uff1a${item.marker}The system will become more complete and the team will keep improving together`,
      "duration: 3s",
    ].join("\n");
    const validation = validateStoryboardHardRules(content, {
      currentRulesUsed: [{
        ruleId: "rule-dialogue-length",
        topicKey: "storyboard.dialogue.length",
        conflictKey: "storyboard.dialogue.length",
      }],
    });

    const repaired = repairStoryboardDialogueIssues(content, validation.issues);

    assert.strictEqual(repaired.repaired, true, item.marker);
    const repairedDialogueLines = repaired.content.split(/\r?\n/).filter((line) => line.startsWith("\u53f0\u8bcd"));
    assert.ok(repairedDialogueLines.length > 1, item.marker);
    assert.ok(repairedDialogueLines.every((line) => line.startsWith(item.expected)), item.marker);
  }
});

test("getApplicableStoryboardHardRules ignores style preferences that are not programmatically checkable", () => {
  const rules = getApplicableStoryboardHardRules([
    {
      ruleId: "rule-style",
      topicKey: "storyboard.style.preference",
      conflictKey: "storyboard.style.preference",
      status: "active",
    },
    {
      ruleId: "rule-disabled-dialogue",
      topicKey: "storyboard.dialogue.length",
      conflictKey: "storyboard.dialogue.length",
      status: "disabled",
    },
  ]);

  assert.deepStrictEqual(rules, []);
});
