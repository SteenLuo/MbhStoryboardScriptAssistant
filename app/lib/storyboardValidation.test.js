const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyStoryboardHardRuleValidation,
  getApplicableStoryboardHardRules,
  isStoryboardValidationResolved,
  repairStoryboardDialogueIssues,
  storyboardContentFingerprint,
  splitDialogueLine,
  validateStoryboardSpeakerCount,
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

test("validateStoryboardContent flags markdown bold dialogue labels", () => {
  const content = [
    "**镜号：10**",
    "**台词：** 王婶：秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？",
    "**时长：** 3s",
  ].join("\n");

  const result = validateStoryboardContent(content);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].lineNumber, 2);
  assert.strictEqual(result.issues[0].dialogue, "秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？");
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
test("validateStoryboardHardRules flags long dialogue through stable storyboard skill rules", () => {
  const content = [
    "shot: 1",
    "dialogue: Lin: The system will become more complete and the team will keep improving together",
  ].join("\n");

  const result = validateStoryboardHardRules(content);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].type, "dialogue-too-long");
  assert.strictEqual(result.issues[0].hardRuleId, "storyboard.dialogue.length");
  assert.match(result.issues[0].skillRulesUsedRefs[0], /stable-skill/);
  assert.deepStrictEqual(result.issues[0].currentRulesUsedRefs, []);
});

test("validateStoryboardHardRules flags multiple speakers in the same shot when a speaker-count rule was used", () => {
  const content = [
    "镜号：10",
    "台词：王婶：昨天柳树沟那个赵媒婆又来了吧？",
    "台词：林秀娥：王婶，您家翠芬嫁人的时候收了三百还是三百五？",
    "时长：3s",
  ].join("\n");
  const currentRulesUsed = [{
    ruleId: "rule-one-speaker",
    topicKey: "storyboard.dialogue.speaker-count",
    conflictKey: "storyboard.dialogue.speaker-count.single-speaker",
    sourceEventIds: ["event-one-speaker"],
    status: "active",
  }];

  const result = validateStoryboardHardRules(content, { currentRulesUsed, includeCurrentRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "rule-one-speaker"));
  assert.strictEqual(result.issues[0].type, "dialogue-multiple-speakers");
  assert.strictEqual(result.issues[0].hardRuleId, "storyboard.dialogue.speaker-count");
  assert.deepStrictEqual(result.issues[0].speakers, ["王婶", "林秀娥"]);
});

test("validateStoryboardSpeakerCount allows different speakers in different shots", () => {
  const content = [
    "镜号：10",
    "台词：王婶：昨天赵媒婆又来了吧？",
    "时长：3s",
    "",
    "镜号：11",
    "台词：林秀娥：王婶，您怎么知道？",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardSpeakerCount(content);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardSpeakerCount does not treat explanatory labels inside one speaker dialogue as speakers", () => {
  const content = [
    "场次：1-1",
    "人物：林秀娥",
    "镜号：3",
    "台词：林秀娥（OS）：前世：电商运营主管，存款18.7万。",
    "台词：林秀娥（OS）：结论：这个价码开得太低了。",
    "时长：4s",
  ].join("\n");

  const result = validateStoryboardSpeakerCount(content);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardSpeakerCount flags embedded second speaker only when it is a scene character", () => {
  const content = [
    "场次：1-1",
    "人物：王婶、林秀娥",
    "镜号：12",
    "台词：王婶：秀娥啊，昨天赵媒婆来了吧？林秀娥：王婶，您怎么知道？",
    "时长：4s",
  ].join("\n");

  const result = validateStoryboardSpeakerCount(content);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].type, "dialogue-multiple-speakers");
  assert.deepStrictEqual(result.issues[0].speakers, ["王婶", "林秀娥"]);
});

test("applyStoryboardHardRuleValidation normalizes markdown field labels for final storyboard content", () => {
  const content = [
    "**镜号：10**",
    "**景别：** 中景",
    "**台词：** 王婶：昨天赵媒婆又来了吧？",
    "**时长：** 3s",
  ].join("\n");
  const result = applyStoryboardHardRuleValidation(content);

  assert.strictEqual(result.content.includes("**"), false);
  assert.match(result.content, /^镜号：10/m);
  assert.match(result.content, /^景别：中景/m);
  assert.match(result.content, /^台词：王婶：昨天赵媒婆又来了吧？/m);
  assert.match(result.content, /^时长：3s/m);
});

test("applyStoryboardHardRuleValidation strips non-storyboard preamble and markdown separators", () => {
  const content = [
    "好的，收到任务。现在根据第2集剧本生成分镜脚本。",
    "",
    "# 第2集 分镜脚本",
    "",
    "场次：2-1",
    "地点：柳河镇主街",
    "人物：林秀娥、陈建军",
    "---",
    "镜号：1",
    "景别：远景",
    "运镜：固定",
    "情绪/动作：柳河镇主街全景",
    "音效：街道环境音",
    "台词：",
    "时长：3s",
    "---",
  ].join("\n");

  const result = applyStoryboardHardRuleValidation(content);

  assert.doesNotMatch(result.content, /好的|收到任务|分镜脚本|---/);
  assert.match(result.content, /^场次：2-1/);
  assert.match(result.content, /^镜号：1/m);
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
    { marker: "\uff08\u753b\u5916\u97f3\uff09\u6797\u79c0\u5a25\uff1a", expected: "\u53f0\u8bcd\uff1a\uff08\u753b\u5916\u97f3\uff09\u6797\u79c0\u5a25\uff1a" },
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

test("repairStoryboardDialogueIssues preserves markdown bold dialogue labels", () => {
  const content = [
    "**镜号：10**",
    "**台词：** 王婶：秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？",
    "**时长：** 3s",
  ].join("\n");
  const validation = validateStoryboardHardRules(content, {
    currentRulesUsed: [{
      ruleId: "rule-dialogue-length",
      topicKey: "storyboard.dialogue.length",
      conflictKey: "storyboard.dialogue.length.max-chars",
    }],
  });

  const repaired = repairStoryboardDialogueIssues(content, validation.issues);
  const repairedValidation = validateStoryboardContent(repaired.content);
  const repairedDialogueLines = repaired.content.split(/\r?\n/).filter((line) => line.includes("王婶："));

  assert.strictEqual(repaired.repaired, true);
  assert.strictEqual(repairedValidation.ok, true);
  assert.ok(repairedDialogueLines.length > 1);
  assert.ok(repairedDialogueLines.every((line) => line.startsWith("**台词：** 王婶：")));
  assert.ok(repairedDialogueLines.every((line) => countTextCharacters(line.slice(line.indexOf("王婶：") + "王婶：".length)) <= 20));
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
