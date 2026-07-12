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

test("validateStoryboardHardRules flags repeated visuals when long dialogue is split", () => {
  const content = [
    "镜号：1",
    "景别：侧面俯拍近景",
    "运镜：缓推",
    "情绪/动作：吴科长将匿名举报信推到办公桌对面的林秀娥面前，信纸泛黄，他的手按在信上。",
    "音效：纸页摩擦声",
    "台词：吴科长：这封举报信说你卖的东西来路不明，",
    "时长：3s",
    "",
    "镜号：2",
    "景别：侧面俯拍近景",
    "运镜：缓推",
    "情绪/动作：吴科长将匿名举报信推到办公桌对面的林秀娥面前，信纸泛黄，他的手按在信上。",
    "音效：纸页摩擦声",
    "台词：吴科长：还说你扰乱供销社秩序。",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.strictEqual(result.ok, false);
  assert.ok(result.appliedRules.some((rule) => rule.ruleId === "stable-skill-storyboard-dialogue-split-visual-variation"));
  assert.ok(result.issues.some((issue) =>
    issue.type === "dialogue-split-repeated-visual" &&
    issue.hardRuleId === "storyboard.dialogue.split-visual-variation" &&
    issue.speaker === "吴科长" &&
    issue.previousShotNumber === "1" &&
    issue.shotNumber === "2" &&
    issue.combinedLength > 20
  ));
});

test("validateStoryboardHardRules allows long dialogue split when visual beat changes", () => {
  const content = [
    "镜号：1",
    "景别：侧面俯拍近景",
    "运镜：缓推",
    "情绪/动作：吴科长将匿名举报信推到办公桌对面的林秀娥面前，信纸泛黄，他的手按在信上。",
    "音效：纸页摩擦声",
    "台词：吴科长：这封举报信说你卖的东西来路不明，",
    "时长：3s",
    "",
    "镜号：2",
    "景别：反打近景",
    "运镜：固定",
    "情绪/动作：林秀娥低头看向信纸，目光从举报内容上扫过，脸色沉下来。",
    "音效：环境静音",
    "台词：吴科长：还说你扰乱供销社秩序。",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true });

  assert.ok(!result.issues.some((issue) => issue.type === "dialogue-split-repeated-visual"));
});

test("applyStoryboardHardRuleValidation repairs repeated visuals in long dialogue split", () => {
  const content = [
    "场次：46-1",
    "人物：赵小满、陈建军",
    "",
    "镜号：11",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：赵小满满脸笑意，探出脑袋冲着站台上的陈建军挥手调侃。",
    "音效：",
    "台词：赵小满：陈大哥，你就放心吧！有我呢，",
    "时长：6s",
    "",
    "镜号：12",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：赵小满满脸笑意，探出脑袋冲着站台上的陈建军挥手调侃。",
    "音效：",
    "台词：赵小满：肯定把秀娥姐平平安安带回来！",
    "时长：6s",
  ].join("\n");

  const initial = validateStoryboardHardRules(content, { useStableSkillRules: true });
  assert.ok(initial.issues.some((issue) => issue.type === "dialogue-split-repeated-visual"));

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });
  const final = validateStoryboardHardRules(repaired.content, { useStableSkillRules: true });

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.match(repaired.hardRuleValidation.repairStrategy, /vary-dialogue-split-visuals/);
  assert.strictEqual(final.ok, true);
  assert.ok(!final.issues.some((issue) => issue.type === "dialogue-split-repeated-visual"));
  assert.match(repaired.content, /镜号：12[\s\S]*?景别：(?!近景(?:\r?\n|$)).+/);
  assert.match(repaired.content, /^运镜：缓推/m);
  assert.match(repaired.content, /结合当前台词和剧本语境|根据这段台词的情绪和信息点|围绕当前剧情重新设计画面/);
  assert.doesNotMatch(repaired.content, /反打|双人中景|关系镜头|单人近景|手部特写|手部细节|画外音|切到[^，。\n]{1,20}的反应/);
  assert.doesNotMatch(repaired.content, /表情和身体姿态随这句后半段台词发生变化|随这句后半段台词|随这一句台词发生变化/);
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

test("validateStoryboardHardRules ignores source parenthetical actions for dialogue fidelity", () => {
  const sourceScript = [
    "人物：王老板",
    "王老板：单批布30元，量大的话——（他低头又按了一下）五十匹，能再降两毛。",
  ].join("\n");
  const content = [
    "镜号：1",
    "景别：近景",
    "台词：王老板：单批布30元，量大的话——五十匹，能再降两毛。",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.ok(!result.issues.some((issue) => issue.type === "dialogue-not-source-exact"));
});

test("validateStoryboardHardRules maps source speaker action suffixes to scene speakers", () => {
  const sourceScript = [
    "人物：林秀娥、赵小满、陈建军",
    "赵小满：我的天…… 秀娥姐！这么多款式！",
    "赵小满调侃： 陈大哥，你就放心吧！有我呢，肯定把秀娥姐平平安安带回来！",
  ].join("\n");
  const content = [
    "镜号：1",
    "景别：近景",
    "台词：赵小满VO：陈大哥，你就放心吧！",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.ok(!result.issues.some((issue) => issue.type === "dialogue-not-source-exact"));
});

test("applyStoryboardHardRuleValidation splits multiple dialogue lines into separate shots", () => {
  const content = [
    "人物：赵小满、林秀娥",
    "镜号：22",
    "景别：过肩近景",
    "运镜：固定",
    "情绪/动作：越过赵小满肩头，看向林秀娥。林秀娥看着衣服，沉稳交代。",
    "音效：",
    "台词：赵小满：可比咱们那儿新潮多了！",
    "台词：林秀娥：咱们多跑几家。多问问价，对比对比。",
    "时长：5s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });
  const final = validateStoryboardHardRules(repaired.content, { useStableSkillRules: true });
  const dialogueLines = repaired.content.split(/\r?\n/).filter((line) => /^台词：/.test(line));

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.match(repaired.hardRuleValidation.repairStrategy, /split-multiple-dialogue-lines/);
  assert.strictEqual(final.ok, true);
  assert.strictEqual(dialogueLines.length, 2);
  assert.ok(!final.issues.some((issue) => issue.type === "dialogue-too-many-lines"));
  assert.ok(!final.issues.some((issue) => issue.type === "dialogue-multiple-speakers"));
  assert.doesNotMatch(repaired.content, /表情和身体姿态随这一句台词发生变化|随这句后半段台词|随这一句台词发生变化/);
});

test("applyStoryboardHardRuleValidation rewrites vague reaction placeholders", () => {
  const content = [
    "镜号：10",
    "景别：反打近景",
    "运镜：缓推",
    "情绪/动作：切到林秀娥的反应，林秀娥看向林大柱，表情和身体姿态随这句后半段台词发生变化。",
    "音效：",
    "台词：林大柱：差点把你……",
    "时长：5s",
  ].join("\n");

  const result = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });

  assert.doesNotMatch(result.content, /表情和身体姿态随这句后半段台词发生变化|随这句后半段台词|随这一句台词发生变化/);
  assert.doesNotMatch(result.content, /眼神一顿，轻轻抿住嘴/);
  assert.match(result.content, /林大柱/);
});

test("applyStoryboardHardRuleValidation rewrites persisted generic reactions with dialogue context", () => {
  const content = [
    "场次：52-2",
    "人物：王婶、林大柱、林秀娥",
    "镜号：28",
    "景别：反打近景",
    "运镜：缓推",
    "情绪/动作：切到林大柱的反应，林大柱沉默片刻，视线停在王婶身上。",
    "音效：",
    "台词：王婶：还帮咱们村解决销路。跟着她干，准没错。",
    "时长：6.5s",
  ].join("\n");

  const result = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });

  assert.doesNotMatch(result.content, /沉默片刻，视线停在王婶身上|眼神一顿，轻轻抿住嘴/);
  assert.match(result.content, /销路|踏实|认可|笃定/);
});

test("applyStoryboardHardRuleValidation relaxes rigid look-at-speaker reaction templates", () => {
  const content = [
    "场次：52-1",
    "人物：王婶、陈桂花、林秀娥",
    "镜号：8",
    "景别：反打近景",
    "运镜：缓推",
    "情绪/动作：切到陈桂花的反应，陈桂花看向王婶，神情从迟疑转为专注。",
    "音效：",
    "台词：王婶：想问问你那加工组还招不招人……",
    "时长：5s",
  ].join("\n");

  const result = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });

  assert.doesNotMatch(result.content, /看向王婶|神情从迟疑转为专注|表情随语气/);
  assert.match(result.content, /结合当前台词和剧本语境|根据这段台词的情绪和信息点|围绕当前剧情重新设计画面/);
  assert.doesNotMatch(result.content, /画外音|双人中景|关系镜头|单人近景|手部细节|切到[^，。\n]{1,20}的反应/);
});

test("validateStoryboardHardRules flags invented active action for source-inactive character", () => {
  const sourceScript = [
    "第五十一集",
    "51-1 日 外 林家院子",
    "人物：林秀娥、林大柱、陈桂花、村民们",
    "△快过年了，林秀娥出钱，把家里的老屋翻新了。",
    "村民甲：大柱，你家可真是翻身了！",
    "林大柱：笑着摆手 一般一般。",
  ].join("\n");
  const content = [
    "场次：51-1",
    "地点：林家院子",
    "时间：日 外",
    "人物：林秀娥、林大柱、陈桂花、村民们",
    "镜号：6",
    "景别：过肩中景",
    "运镜：固定",
    "情绪/动作：从林大柱身后越肩拍摄，陈桂花从堂屋走出来，手里端着一盆刚洗好的新碗筷，朝林大柱扬了扬下巴。",
    "音效：碗筷轻微的碰撞声",
    "台词：",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-source-ungrounded-character-action" &&
    issue.character === "陈桂花" &&
    issue.sceneId === "51-1"
  ));
});

test("validateStoryboardHardRules treats backstory mentions as inactive for reaction shots", () => {
  const sourceScript = [
    "第五十一集",
    "51-1 日 外 林家院子",
    "人物：林秀娥、林大柱、陈桂花、村民们",
    "△快过年了，林秀娥出钱，把家里的老屋翻新了。",
    "村民甲：大柱，你家可真是翻身了！这房子，比村支书家都气派！",
    "林大柱：笑着摆手 一般一般。",
  ].join("\n");
  const content = [
    "场次：51-1",
    "人物：林秀娥、林大柱、陈桂花、村民们",
    "镜号：6",
    "景别：反打近景",
    "运镜：缓推",
    "情绪/动作：切到林秀娥的反应，林秀娥看向村民甲，眼神一顿，轻轻抿住嘴。",
    "音效：",
    "台词：村民甲：这房子，比村支书家都气派！",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-source-ungrounded-character-action" &&
    issue.character === "林秀娥" &&
    issue.sceneId === "51-1"
  ));
});

test("validateStoryboardHardRules flags invented concrete visual details not in source scene", () => {
  const sourceScript = [
    "第五十一集",
    "51-1 日 外 林家院子",
    "人物：林秀娥、林大柱、陈桂花、村民们",
    "△快过年了，林秀娥出钱，把家里的老屋翻新了。土坯墙换成了砖墙，窗户换成了玻璃，院子也铺了青砖，还盖了两间新厢房。",
  ].join("\n");
  const content = [
    "场次：51-1",
    "人物：林秀娥、林大柱、陈桂花、村民们",
    "镜号：1",
    "景别：侧面全景",
    "运镜：缓移",
    "情绪/动作：几只鸡在干净的院子里啄食，一个新贴的福字贴在玻璃窗上。",
    "音效：",
    "台词：",
    "时长：3s",
  ].join("\n");

  const result = validateStoryboardHardRules(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) =>
    issue.type === "storyboard-source-ungrounded-concrete-detail" &&
    issue.sceneId === "51-1" &&
    issue.details.includes("鸡") &&
    issue.details.includes("福字")
  ));
});

test("applyStoryboardHardRuleValidation removes rigid split-dialogue reaction templates", () => {
  const content = [
    "场次：51-1",
    "人物：林大柱、林秀娥",
    "镜号：9",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：林大柱放下杯子，声音发涩。",
    "音效：",
    "台词：林大柱：秀娥，爹以前对不住你。以前家里穷，爹糊涂，",
    "时长：5s",
    "",
    "镜号：10",
    "景别：反打近景",
    "运镜：缓推",
    "情绪/动作：切到林秀娥的反应，林秀娥看向林大柱，眼神一顿，轻轻抿住嘴。",
    "音效：",
    "台词：林大柱：差点把你……",
    "时长：5s",
    "",
    "镜号：11",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：林秀娥眼眶微红，轻轻摇头。",
    "音效：",
    "台词：林秀娥：爹，都过去了。",
    "时长：3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });

  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.doesNotMatch(repaired.content, /切到林秀娥的反应|林秀娥看向林大柱/);
  assert.match(repaired.content, /结合当前台词和剧本语境|根据这段台词的情绪和信息点|围绕当前剧情重新设计画面/);
  assert.doesNotMatch(repaired.content, /画外音|双人中景|关系镜头|单人近景|手部细节/);
});

test("applyStoryboardHardRuleValidation repairs source grounding over-enrichment", () => {
  const sourceScript = [
    "第五十一集",
    "51-1 日 外 林家院子",
    "人物：林秀娥、林大柱、村民们",
    "△快过年了，林秀娥出钱，把家里的老屋翻新了。土坯墙换成了砖墙，窗户换成了玻璃，院子也铺了青砖，还盖了两间新厢房。",
    "村民甲：大柱，你家可真是翻身了！这房子，比村支书家都气派！",
  ].join("\n");
  const content = [
    "场次：51-1",
    "人物：林秀娥、林大柱、村民们",
    "镜号：1",
    "景别：侧面全景",
    "运镜：缓移",
    "情绪/动作：几只鸡在干净的院子里啄食，一个新贴的福字贴在玻璃窗上。",
    "音效：",
    "台词：",
    "时长：3s",
    "",
    "镜号：2",
    "景别：反打近景",
    "运镜：固定",
    "情绪/动作：切到林秀娥的反应，林秀娥看向村民甲，眼神一顿，轻轻抿住嘴。",
    "音效：",
    "台词：村民甲：这房子，比村支书家都气派！",
    "时长：3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.match(repaired.hardRuleValidation.repairStrategy, /repair-source-grounding/);
  assert.doesNotMatch(repaired.content, /鸡|福字|切到林秀娥的反应|林秀娥看向村民甲/);
  assert.doesNotMatch(repaired.content, /台词中的情绪|当前台词|原文/);
});

test("applyStoryboardHardRuleValidation repairs invented concrete details in sound fields", () => {
  const sourceScript = [
    "第五十一集",
    "51-1 日 外 林家院子",
    "人物：林大柱、村民们",
    "△快过年了，家里的老屋翻新了。土坯墙换成了砖墙，窗户换成了玻璃。",
  ].join("\n");
  const content = [
    "场次：51-1",
    "人物：林大柱、村民们",
    "镜号：1",
    "景别：中景",
    "运镜：固定",
    "情绪/动作：镜头扫过翻新后的砖墙和玻璃窗。",
    "音效：风声，远处鸡鸣",
    "台词：",
    "时长：3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.match(repaired.hardRuleValidation.repairStrategy, /repair-source-grounding/);
  assert.match(repaired.content, /^音效：风声$/m);
});

test("applyStoryboardHardRuleValidation varies repeated reaction fallback descriptions", () => {
  const content = [
    "场次：52-2",
    "人物：王婶、林大柱、林秀娥",
    "镜号：1",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在大棚边说话。",
    "音效：",
    "台词：王婶：秀娥这孩子实诚，给的价钱公道，",
    "时长：3s",
    "",
    "镜号：2",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在大棚边说话。",
    "音效：",
    "台词：王婶：还帮咱们村解决销路。跟着她干，",
    "时长：3s",
    "",
    "镜号：3",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在大棚边说话。",
    "音效：",
    "台词：王婶：准没错。大家以后都踏实干，",
    "时长：3s",
    "",
    "镜号：4",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在大棚边说话。",
    "音效：",
    "台词：王婶：日子肯定越过越有奔头。",
    "时长：3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });
  const actionLines = (repaired.content.match(/^情绪\/动作：.*$/gm) || [])
    .map((line) => line.replace(/^情绪\/动作：/, ""));
  const changedActions = actionLines.filter((line) => !/王婶站在大棚边说话/.test(line));
  const uniqueActions = new Set(changedActions);
  const nonReactionActions = changedActions.filter((line) => !/的反应/.test(line));

  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.ok(changedActions.length >= 2);
  assert.ok(nonReactionActions.length >= 1);
  assert.ok(uniqueActions.size >= 2);
  assert.strictEqual(changedActions.some((line) => /眼神一顿，轻轻抿住嘴/.test(line)), false);
});

test("applyStoryboardHardRuleValidation keeps split-dialogue visual repair content-agnostic", () => {
  const content = [
    "场次：52-2",
    "人物：王婶、陈桂花、林秀娥",
    "镜号：1",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在院门口说话。",
    "音效：",
    "台词：王婶：想问问你那加工组还招不招人，",
    "时长：3s",
    "",
    "镜号：2",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在院门口说话。",
    "音效：",
    "台词：王婶：我家小身子骨还行，能不能跟着学点活计？",
    "时长：3s",
    "",
    "镜号：3",
    "景别：近景",
    "运镜：固定",
    "情绪/动作：王婶站在院门口说话。",
    "音效：",
    "台词：王婶：要是能学会做工，以后日子也稳当些。",
    "时长：3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true });
  const actionLines = (repaired.content.match(/^情绪\/动作：.*$/gm) || [])
    .map((line) => line.replace(/^情绪\/动作：/, ""));
  const genericRepairLines = actionLines.filter((line) =>
    /结合当前台词和剧本语境|根据这段台词的情绪和信息点|围绕当前剧情重新设计画面/.test(line)
  );

  assert.strictEqual(repaired.hardRuleValidation.finalOk, true);
  assert.ok(genericRepairLines.length >= 1, repaired.content);
  assert.doesNotMatch(repaired.content, /画外音|双人中景|关系镜头|单人近景|手部细节|侧脸|切到[^，。\n]{1,20}的反应/);
  assert.doesNotMatch(repaired.content, /眼神一顿，轻轻抿住嘴|神情从迟疑转为专注|表情和身体姿态随/);
});

test("applyStoryboardHardRuleValidation merges same-speaker short dialogue split", () => {
  const sourceScript = [
    "人物：林秀娥",
    "林秀娥：（举起布块对着灯看）掉得不算厉害，但边缘的染色不均匀。（把布块搁在桌边晾着，在那块布上打了个叉）这家也不行。",
  ].join("\n");
  const content = [
    "人物：林秀娥",
    "镜号：9",
    "景别：正三四仰拍近景",
    "运镜：固定",
    "情绪/动作：林秀娥举起布块对着灯看。",
    "音效：",
    "台词：林秀娥：掉得不算厉害，但边缘的染色不均匀。",
    "时长：4s",
    "",
    "镜号：10",
    "景别：手部特写",
    "运镜：轻移",
    "情绪/动作：她把布块搁在桌边晾着，拿笔打叉。",
    "音效：",
    "台词：林秀娥：这家也不行。",
    "时长：3s",
  ].join("\n");

  const repaired = applyStoryboardHardRuleValidation(content, { useStableSkillRules: true, sourceScript });
  const final = validateStoryboardHardRules(repaired.content, { useStableSkillRules: true, sourceScript });

  assert.strictEqual(repaired.hardRuleValidation.repaired, true);
  assert.match(repaired.hardRuleValidation.repairStrategy, /merge-short-same-speaker-dialogue/);
  assert.strictEqual(final.ok, true);
  assert.match(repaired.content, /台词：林秀娥：掉得不算厉害，但边缘的染色不均匀。这家也不行。/);
  assert.strictEqual((repaired.content.match(/^镜号：/gm) || []).length, 1);
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
