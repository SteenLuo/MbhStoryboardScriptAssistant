const assert = require("assert");
const test = require("node:test");

const {
  normalizeScriptGrade,
  formatScriptGrade,
  buildScriptGradePrompt,
} = require("./script-grade");

test("normalizeScriptGrade defaults to B and accepts A aliases", () => {
  assert.strictEqual(normalizeScriptGrade(), "B");
  assert.strictEqual(normalizeScriptGrade(""), "B");
  assert.strictEqual(normalizeScriptGrade("b"), "B");
  assert.strictEqual(normalizeScriptGrade("A级本"), "A");
  assert.strictEqual(normalizeScriptGrade("a"), "A");
});

test("formatScriptGrade renders compact metadata text", () => {
  assert.strictEqual(formatScriptGrade("A"), "grade A");
  assert.strictEqual(formatScriptGrade("b"), "grade B");
});

test("buildScriptGradePrompt describes different quality budgets", () => {
  const aPrompt = buildScriptGradePrompt("A");
  const bPrompt = buildScriptGradePrompt("B");

  assert.match(aPrompt, /A级本/);
  assert.match(aPrompt, /正式投放/);
  assert.match(aPrompt, /自检/);
  assert.match(bPrompt, /B级本/);
  assert.match(bPrompt, /快速可用/);
});
