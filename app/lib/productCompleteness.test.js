const assert = require("assert");
const test = require("node:test");

const { buildCompletenessMatrix } = require("./productCompleteness");

test("buildCompletenessMatrix covers M0 through M6", () => {
  const matrix = buildCompletenessMatrix();

  assert.deepStrictEqual(
    matrix.map((item) => item.milestone),
    ["M0", "M1", "M2", "M3", "M4", "M5", "M6"],
  );
});

test("buildCompletenessMatrix marks newly connected skill routing and learning loop", () => {
  const matrix = buildCompletenessMatrix();
  const m5 = matrix.find((item) => item.milestone === "M5");
  const m6 = matrix.find((item) => item.milestone === "M6");

  assert.match(m5.webStatus, /已接入/);
  assert.match(m6.webStatus, /已接入/);
  assert.ok(m6.evidence.some((item) => item.includes("app/lib/localSkills.js")));
});

test("buildCompletenessMatrix marks M3 workbench as connected", () => {
  const matrix = buildCompletenessMatrix();
  const m3 = matrix.find((item) => item.milestone === "M3");

  assert.match(m3.webStatus, /工作台/);
  assert.ok(m3.evidence.some((item) => item.includes("app/lib/workbench.js")));
});
