const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverSource = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");

function extractFunction(name) {
  const asyncMarker = `async function ${name}`;
  const functionMarker = `function ${name}`;
  let start = serverSource.indexOf(asyncMarker);
  if (start === -1) start = serverSource.indexOf(functionMarker);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextAsync = serverSource.indexOf("\nasync function ", start + name.length);
  const nextFunction = serverSource.indexOf("\nfunction ", start + name.length);
  const candidates = [nextAsync, nextFunction].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : serverSource.length;
  return serverSource.slice(start, end);
}

test("canvas storyboard generation loads the local storyboard skill context", () => {
  const promptSource = extractFunction("canvasStoryboardSkillPrompt");
  const generateSource = extractFunction("generateCanvasStoryboards");

  assert.match(promptSource, /skills\/03-storyboard\/storyboard-generate/);
  assert.match(promptSource, /分镜生成规则\.md/);
  assert.match(promptSource, /分镜标准格式\.md/);
  assert.match(generateSource, /canvasStoryboardSkillPrompt\(\)/);
  assert.match(generateSource, /storyboardSkillPrompt/);
});

test("first-pass storyboard generation paths load the local storyboard skill", () => {
  const taskPromptSource = extractFunction("taskSkillPrompt");
  const workflowSource = extractFunction("runWorkflowTask");
  const workbenchSource = extractFunction("generateWithDeepSeek");

  assert.match(taskPromptSource, /storyboard-generate/);
  assert.match(taskPromptSource, /canvasStoryboardSkillPrompt\(\)/);
  assert.match(workflowSource, /taskSkillPrompt\(task\)/);
  assert.match(workflowSource, /skillPrompt/);
  assert.match(workbenchSource, /taskSkillPrompt\(body\.task\)/);
  assert.match(workbenchSource, /skillPrompt/);
});

test("canvas revision endpoint only updates revision nodes once", () => {
  const reviseSource = extractFunction("reviseCanvasNode");

  assert.match(serverSource, /\/api\/canvas\/revise-node/);
  assert.match(serverSource, /function isRevisionCanvasNode/);
  assert.match(serverSource, /function uniqueCanvasNodeTitle/);
  assert.match(reviseSource, /variantKind/);
  assert.match(reviseSource, /parentNodeId/);
  assert.match(reviseSource, /chatLocked/);
  assert.match(reviseSource, /deepseekChat/);
  assert.match(reviseSource, /chatPrompt/);
  assert.match(reviseSource, /chatResponse/);
});
