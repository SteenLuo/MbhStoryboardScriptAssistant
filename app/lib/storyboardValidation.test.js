const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyStoryboardHardRuleValidation,
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

function buildShot({ number, shotType = "中景", camera = "固定", dialogue = "" }) {
  return [
    `镜号：${number}`,
    `景别：${shotType}`,
    `运镜：${camera}`,
    "情绪/动作：人物在场景中完成明确动作。",
    "音效：环境声",
    `台词：${dialogue}`,
    "时长：3s",
  ].join("\n");
}

test("validateStoryboardContent does not check dialogue length by default", () => {
  const content = [
    "shot: 1",
    "dialogue: Lin: The system will become more complete and the team will keep improving together",
  ].join("\n");

  const result = validateStoryboardContent(content);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardContent checks dialogue length when enabled", () => {
  const content = [
    "镜号：8",
    "台词：林秀娥：会有更完善的制度，更好的待遇，更大的发展空间，希望大家继续努力。",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content, { checkDialogueLength: true });

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

  const result = validateStoryboardContent(content, { checkDialogueLength: true });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardContent does not count punctuation toward the 20 character limit", () => {
  const content = [
    "镜号：8",
    "台词：陈建军：林家村的吧？我下村的时候见过你。来镇上办事？",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content, { checkDialogueLength: true });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardContent reports the spoken dialogue without speaker labels", () => {
  const content = [
    "镜号：8",
    "台词：OS（林秀娥，平静）：会有更完善的制度，更好的待遇，更大的发展空间，希望大家继续努力。",
    "时长：5s",
  ].join("\n");

  const result = validateStoryboardContent(content, { checkDialogueLength: true });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].dialogue, "会有更完善的制度，更好的待遇，更大的发展空间，希望大家继续努力。");
});

test("validateStoryboardContent flags markdown bold dialogue labels", () => {
  const content = [
    "**镜号：10**",
    "**台词：** 王婶：秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？",
    "**时长：** 3s",
  ].join("\n");

  const result = validateStoryboardContent(content, { checkDialogueLength: true });

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

test("splitDialogueLine preserves spaces inside original dialogue", () => {
  const lines = splitDialogueLine("AI 不是万能的，要按原文来。", 8);

  assert.strictEqual(lines.map((line) => line.text).join(""), "AI 不是万能的，要按原文来。");
});

test("validateStoryboardHardRules skips stable skill rules by default", () => {
  const content = [
    "shot: 1",
    "dialogue: Lin: The system will become more complete and the team will keep improving together",
  ].join("\n");

  const result = validateStoryboardHardRules(content);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.checked, false);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardHardRules flags long dialogue through stable storyboard skill rules when enabled", () => {
  const content = [
    "shot: 1",
    "dialogue: Lin: The system will become more complete and the team will keep improving together",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.issues[0].type, "dialogue-too-long");
  assert.strictEqual(result.issues[0].hardRuleId, "storyboard.dialogue.length");
  assert.match(result.issues[0].skillRulesUsedRefs[0], /stable-skill/);
});

test("validateStoryboardHardRules flags multiple speakers through stable storyboard skill rules", () => {
  const content = [
    "镜号：10",
    "台词：王婶：昨天柳树沟那个赵媒婆又来了吧？",
    "台词：林秀娥：王婶，您家翠芬嫁人的时候收了三百还是三百五？",
    "时长：3s",
  ].join("\n");
  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-single-speaker"));
  assert.strictEqual(result.issues[0].type, "dialogue-multiple-speakers");
  assert.strictEqual(result.issues[0].hardRuleId, "storyboard.dialogue.speaker-count");
  assert.deepStrictEqual(result.issues[0].speakers, ["王婶", "林秀娥"]);
});

test("validateStoryboardHardRules flags more than one dialogue field in the same shot", () => {
  const content = [
    "镜号：5",
    "景别：近景",
    "台词：旁白VO：我到这儿一年了。",
    "台词：旁白VO：后半年在等机会。",
    "时长：4s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-dialogue-line-count"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "dialogue-too-many-lines" &&
    issue.hardRuleId === "storyboard.dialogue.line-count" &&
    issue.dialogueLineCount === 2
  ));
});

test("validateStoryboardHardRules flags non-empty dialogue without a speaker marker", () => {
  const content = [
    "镜号：1",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：陈建军轻轻掀开红盖头。",
    "音效：安静",
    "台词：秀娥，你今天真好看。",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-dialogue-speaker-marker"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "dialogue-missing-speaker-marker" &&
    issue.hardRuleId === "storyboard.dialogue.speaker-marker" &&
    issue.shotNumber === "1" &&
    issue.dialogue === "秀娥，你今天真好看。"
  ));
});

test("validateStoryboardHardRules allows empty dialogue fields without a speaker marker", () => {
  const content = [
    "镜号：1",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：林秀娥坐在床边，低头整理衣角。",
    "音效：衣料摩擦声",
    "台词：",
    "时长：3s",
    "",
    "镜号：2",
    "景别：手部特写",
    "运镜：固定",
    "情绪/动作：玉佩被她握在掌心。",
    "音效：无",
    "台词：无",
    "时长：2s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.ok(!result.issues.some((issue) => issue.type === "dialogue-missing-speaker-marker"));
});

test("validateStoryboardHardRules flags adjacent short dialogue split for the same speaker", () => {
  const content = [
    "镜号：10",
    "景别：侧面俯拍中景",
    "运镜：轻移",
    "情绪/动作：从侧上方俯拍林秀娥，她微颔首，语调平稳。",
    "音效：",
    "台词：林秀娥：您言重了。",
    "时长：1s",
    "",
    "镜号：11",
    "景别：过肩近景",
    "运镜：拉",
    "情绪/动作：越过林秀娥肩膀看张主任。张主任脸上浮现一丝老人对后辈的宽容笑容，语气温和。",
    "音效：",
    "台词：林秀娥：您以前也是按规矩办事。",
    "时长：2s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-dialogue-short-merge"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "dialogue-short-same-speaker-split" &&
    issue.hardRuleId === "storyboard.dialogue.short-merge" &&
    issue.speaker === "林秀娥" &&
    issue.previousShotNumber === "10" &&
    issue.shotNumber === "11" &&
    issue.combinedLength <= 20
  ));
});

test("validateStoryboardHardRules allows adjacent short dialogue from different speakers", () => {
  const content = [
    "镜号：1",
    "景别：中景",
    "运镜：固定",
    "情绪/动作：两人在仓库门口打照面。",
    "音效：环境声",
    "台词：林秀娥：张主任。",
    "时长：1s",
    "",
    "镜号：2",
    "景别：侧面近景",
    "运镜：固定",
    "情绪/动作：张主任点点头。",
    "音效：",
    "台词：张主任：林老板。",
    "时长：1s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.ok(!result.issues.some((issue) => issue.type === "dialogue-short-same-speaker-split"));
});

test("validateStoryboardHardRules flags rewritten character dialogue when source script is provided", () => {
  const sourceScript = [
    "人物：周裁缝",
    "周裁缝：笑着摇头 你啊，就是个劳碌命。嫁衣我给你做。",
  ].join("\n");
  const content = [
    "镜号：6",
    "景别：侧面近景",
    "台词：周裁缝：你啊，就是劳碌命。",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-dialogue-fidelity"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "dialogue-not-source-exact" &&
    issue.hardRuleId === "storyboard.dialogue.fidelity" &&
    issue.speaker === "周裁缝"
  ));
});

test("validateStoryboardHardRules accepts original dialogue segments from source script", () => {
  const sourceScript = [
    "人物：陈桂花",
    "陈桂花：秀娥，妈没什么本事，就给你做两身新衣服，缝两床新被子。以后到了婆家，要好好过日子。",
  ].join("\n");
  const content = [
    "镜号：1",
    "景别：近景",
    "台词：陈桂花：秀娥，妈没什么本事，就给你做两身新衣服，",
    "时长：3s",
    "",
    "镜号：2",
    "景别：侧面近景",
    "台词：陈桂花：缝两床新被子。以后到了婆家，要好好过日子。",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardHardRules flags moving shot ratio above forty percent", () => {
  const content = Array.from({ length: 10 }, (_, index) => buildShot({
    number: index + 1,
    shotType: index < 4 ? "中景" : "侧面中景",
    camera: index < 5 ? "缓推" : "固定",
  })).join("\n\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-motion-ratio"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-motion-ratio-out-of-range" &&
    issue.hardRuleId === "storyboard.motion.ratio" &&
    issue.dynamicShotCount === 5 &&
    issue.totalShotCount === 10
  ));
});

test("validateStoryboardHardRules flags ratios even when the current shot count has no exact integer solution", () => {
  const content = Array.from({ length: 7 }, (_, index) => buildShot({
    number: index + 1,
    shotType: index < 2 ? "中景" : "侧面中景",
    camera: index < 2 ? "缓推" : "固定",
  })).join("\n\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-motion-ratio-out-of-range" &&
    issue.dynamicShotCount === 2 &&
    issue.totalShotCount === 7
  ));
});

test("validateStoryboardHardRules flags three consecutive moving shots", () => {
  const cameras = ["固定", "缓推", "轻移", "拉", "固定", "固定", "固定", "固定", "固定", "固定"];
  const content = cameras.map((camera, index) => buildShot({
    number: index + 1,
    shotType: index < 4 ? "中景" : "侧面中景",
    camera,
  })).join("\n\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-motion-sequence"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-motion-three-consecutive" &&
    issue.hardRuleId === "storyboard.motion.sequence" &&
    issue.sequenceLength === 3
  ));
});

test("validateStoryboardHardRules flags front flat ratio below thirty percent", () => {
  const content = Array.from({ length: 10 }, (_, index) => buildShot({
    number: index + 1,
    shotType: index < 2 ? "中景" : "侧面中景",
    camera: [0, 3, 6, 9].includes(index) ? "缓推" : "固定",
  })).join("\n\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-front-flat-ratio"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-front-flat-ratio-out-of-range" &&
    issue.hardRuleId === "storyboard.composition.front-flat-ratio" &&
    issue.frontFlatShotCount === 2 &&
    issue.totalShotCount === 10
  ));
});

test("validateStoryboardHardRules accepts motion and front flat ratios in range", () => {
  const content = Array.from({ length: 10 }, (_, index) => buildShot({
    number: index + 1,
    shotType: index < 4 ? "中景" : "侧面中景",
    camera: [0, 3, 6, 9].includes(index) ? "缓推" : "固定",
  })).join("\n\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.issues.length, 0);
});

test("validateStoryboardHardRules flags repeated identical composition for the same visual beat", () => {
  const content = [
    "镜号：14",
    "景别：侧面中景",
    "运镜：固定",
    "情绪/动作：红烛光影下，两人对坐着，都笑了，气氛有点拘谨又有点甜蜜。",
    "音效：红烛燃烧的细微噼啪声",
    "台词：",
    "时长：3s",
    "",
    "镜号：15",
    "景别：双人中景",
    "运镜：缓推",
    "情绪/动作：陈建军收敛了笑容，认真地看着林秀娥。",
    "音效：安静",
    "台词：陈建军：秀娥，以后我会好好对你的。",
    "时长：3.5s",
    "",
    "镜号：16",
    "景别：双人中景",
    "运镜：固定",
    "情绪/动作：维持上一镜的构图，陈建军语气温柔而坚定。",
    "音效：安静",
    "台词：陈建军：你有啥秘密，愿意说就说，",
    "时长：3s",
    "",
    "镜号：17",
    "景别：双人中景",
    "运镜：固定",
    "情绪/动作：继续上一镜，林秀娥的眼神微微有些动容。陈建军的声音饱含耐心。",
    "音效：安静",
    "台词：陈建军：不愿意说，我就等。",
    "时长：2.5s",
    "",
    "镜号：18",
    "景别：双人中景",
    "运镜：固定",
    "情绪/动作：继续上一镜。陈建军的话音落下，时间仿佛静止了一两秒。",
    "音效：安静",
    "台词：陈建军：等你愿意说的那天。",
    "时长：2.5s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-duplicate-composition"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-duplicate-composition-sequence" &&
    issue.hardRuleId === "storyboard.composition.duplicate-sequence" &&
    issue.shotType === "双人中景" &&
    issue.previousShotNumber === "15" &&
    issue.shotNumber === "16"
  ));
});

test("validateStoryboardHardRules treats omitted default front-flat wording as the same composition", () => {
  const content = [
    "镜号：1",
    "景别：正面平视双人中景",
    "运镜：固定",
    "情绪/动作：林秀娥和陈建军对坐在红烛前，气氛安静。",
    "音效：安静",
    "台词：",
    "时长：3s",
    "",
    "镜号：2",
    "景别：双人中景",
    "运镜：固定",
    "情绪/动作：接上一镜，两人仍保持对坐姿态，陈建军继续说话。",
    "音效：安静",
    "台词：陈建军：我就等。",
    "时长：2s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-duplicate-composition-sequence" &&
    issue.previousShotNumber === "1" &&
    issue.shotNumber === "2"
  ));
});

test("validateStoryboardHardRules allows the same shot type when the visual beat changes", () => {
  const content = [
    "镜号：1",
    "景别：双人中景",
    "运镜：固定",
    "情绪/动作：林秀娥从门口走进屋里，陈建军回头看向她。",
    "音效：脚步声",
    "台词：",
    "时长：3s",
    "",
    "镜号：2",
    "景别：双人中景",
    "运镜：固定",
    "情绪/动作：两人坐到桌边，林秀娥把账本推到陈建军面前。",
    "音效：纸页声",
    "台词：",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.ok(!result.issues.some((issue) => issue.type === "storyboard-duplicate-composition-sequence"));
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

test("repairStoryboardDialogueIssues splits long dialogue into continuous shots", () => {
  const content = [
    "镜号：1",
    "景别：近景",
    "台词：陈桂花：秀娥，妈没什么本事，就给你做两身新衣服，缝两床新被子。",
    "时长：3s",
  ].join("\n");
  const validation = validateStoryboardHardRules(content, { useStableSkillRules: true });

  const repaired = repairStoryboardDialogueIssues(content, validation.issues);
  const repairedValidation = validateStoryboardHardRules(repaired.content, { useStableSkillRules: true });
  const shotLines = repaired.content.split(/\r?\n/).filter((line) => /^镜号：/.test(line));
  const dialogueLines = repaired.content.split(/\r?\n/).filter((line) => /^台词：/.test(line));

  assert.strictEqual(repaired.repaired, true);
  assert.ok(shotLines.length > 1);
  assert.deepStrictEqual(shotLines, shotLines.map((_, index) => `镜号：${index + 1}`));
  assert.strictEqual(dialogueLines.length, shotLines.length);
  assert.strictEqual(repairedValidation.ok, true);
  assert.strictEqual(repairedValidation.issues.length, 0);
});

test("repairStoryboardDialogueIssues keeps voice and speaker markers while splitting", () => {
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
      "镜号：1",
      `\u53f0\u8bcd\uff1a${item.marker}The system will become more complete and the team will keep improving together`,
      "时长：3s",
    ].join("\n");
    const validation = validateStoryboardHardRules(content, { useStableSkillRules: true });

    const repaired = repairStoryboardDialogueIssues(content, validation.issues);
    const repairedValidation = validateStoryboardHardRules(repaired.content, { useStableSkillRules: true });
    const dialogueLines = repaired.content.split(/\r?\n/).filter((line) => line.startsWith("\u53f0\u8bcd\uff1a"));

    assert.strictEqual(repaired.repaired, true, item.marker);
    assert.strictEqual(repairedValidation.ok, true, item.marker);
    assert.ok(dialogueLines.length > 1, item.marker);
    assert.ok(dialogueLines.every((line) => line.startsWith(item.expected)), item.marker);
  }
});

test("applyStoryboardHardRuleValidation normalizes markdown and repairs long dialogue", () => {
  const content = [
    "**镜号：10**",
    "**台词：** 王婶：秀娥啊，昨天柳树沟那个赵媒婆又来了吧？听说是加价了，三百五。你爹还没松口？",
    "**时长：** 3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });
  const repairedDialogueLines = repaired.content.split(/\r?\n/).filter((line) => line.includes("王婶："));

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.doesNotMatch(repaired.content, /\*\*/);
  assert.ok(repairedDialogueLines.length > 1);
});

test("applyStoryboardHardRuleValidation repairs moving shot ratio below range", () => {
  const movingIndexes = new Set([0, 6, 12, 18, 24]);
  const content = Array.from({ length: 28 }, (_, index) => buildShot({
    number: index + 1,
    shotType: index < 9 ? "中景" : "侧面中景",
    camera: movingIndexes.has(index) ? "缓推" : "固定",
    dialogue: index === 2 ? "林秀娥：张主任。" : "",
  })).join("\n\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });
  const movingCount = repaired.content
    .split(/\r?\n/)
    .filter((line) => /^运镜：/.test(line) && !/固定/.test(line))
    .length;

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.ok(movingCount >= 9 && movingCount <= 11);
  assert.match(repaired.content, /台词：林秀娥：张主任。/);
});

test("applyStoryboardHardRuleValidation breaks three consecutive moving shots", () => {
  const cameras = ["缓推", "轻移", "拉", "固定", "固定", "固定", "缓推", "固定", "固定", "固定"];
  const content = cameras.map((camera, index) => buildShot({
    number: index + 1,
    shotType: index < 4 ? "中景" : "侧面中景",
    camera,
  })).join("\n\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.doesNotMatch(repaired.content, /运镜：缓推[\s\S]*?运镜：轻移[\s\S]*?运镜：拉/);
});

test("applyStoryboardHardRuleValidation repairs front flat ratio below range", () => {
  const content = Array.from({ length: 10 }, (_, index) => buildShot({
    number: index + 1,
    shotType: index < 2 ? "中景" : "侧面中景",
    camera: [0, 3, 6, 9].includes(index) ? "缓推" : "固定",
  })).join("\n\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.ok((repaired.content.match(/^景别：中景$/gm) || []).length >= 3);
});
