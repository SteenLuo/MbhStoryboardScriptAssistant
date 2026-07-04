const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const asyncMarker = `async function ${name}`;
  let start = appSource.indexOf(asyncMarker);
  if (start === -1) start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextAsync = appSource.indexOf("\nasync function ", start + name.length);
  const nextFunction = appSource.indexOf("\nfunction ", start + name.length);
  const candidates = [nextAsync, nextFunction].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : appSource.length;
  return appSource.slice(start, end);
}

test("archiveCurrentCanvas warns when archive succeeds but learning evidence fails", () => {
  const archiveSource = extractFunction("archiveCurrentCanvas");

  assert.match(archiveSource, /data\.learningEvidence\?\.status === "failed"/);
  assert.match(archiveSource, /画布已归档，但学习证据生成失败，可在学习资料库查看。/);
  assert.match(archiveSource, /canvasStatus\("画布已归档，但学习证据生成失败，可在学习资料库查看。", \{ lockMs: 6000 \}\)/);
});

test("sendMessage submits pending learning corrections through correction API", () => {
  const sendSource = extractFunction("sendMessage");

  assert.match(sendSource, /const pendingCorrection = state\.pendingLearningCorrection/);
  assert.match(sendSource, /\/api\/learning-corrections/);
  assert.match(sendSource, /waiting\.textContent = "正在记录纠正说明\.\.\."/);
});

test("sendMessage preserves pending learning correction when correction API fails", () => {
  const sendSource = extractFunction("sendMessage");

  assert.match(sendSource, /state\.pendingLearningCorrection = pendingCorrection/);
  assert.match(sendSource, /input\.value = text/);
  assert.match(sendSource, /autoGrowTextarea\(\)/);
  assert.match(sendSource, /updateSendState\(\)/);
});
