const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isStoryboardValidationResolved,
  storyboardContentFingerprint,
  splitDialogueLine,
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
