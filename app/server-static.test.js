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

  assert.match(promptSource, /loadLocalSkillContext\(ROOT,\s*findLocalSkillRoute\("storyboard-generate"\)/);
  assert.match(promptSource, /skillContext\.prompt/);
  assert.match(promptSource, /findLocalSkillRoute\("storyboard-generate"\)/);
  assert.match(promptSource, /routeLocalSkill\("分镜"\)/);
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

test("server prompts no longer apply script level rules", () => {
  assert.doesNotMatch(serverSource, /scriptGrade|buildScriptGradePrompt|normalizeScriptGrade|scriptGradeLabel/);
  assert.doesNotMatch(serverSource, /B级本|A级本/);
});

test("explicit skill learning mode is handled locally without model generation", () => {
  const chatSource = extractFunction("chatWithAssistant");
  const learningSource = extractFunction("handleLearningCompose");

  assert.match(chatSource, /const explicitLearningMode = body\.learningMode === true/);
  assert.match(chatSource, /routeLocalSkill\("样例 学习 入库 技能学习"\)/);
  assert.match(chatSource, /if \(explicitLearningMode\)/);
  assert.match(chatSource, /handleLearningCompose/);
  assert.match(learningSource, /writeConversationLearningRecord/);
  assert.match(learningSource, /applyAutonomousConversationLearning/);
  assert.match(learningSource, /local-learning/);
  assert.match(learningSource, /已记录为技能学习材料/);
  assert.match(learningSource, /learningEventStatus === "已生效"/);
  assert.match(learningSource, /已同步到当前规则/);
  assert.doesNotMatch(learningSource, /deepseekChat/);
});

test("chat composer can force dedicated review and adaptation skills", () => {
  const chatSource = extractFunction("chatWithAssistant");

  assert.match(serverSource, /findLocalSkillRoute/);
  assert.match(chatSource, /const forcedSkillRoute = findLocalSkillRoute\(body\.skillRouteId\)/);
  assert.match(chatSource, /forcedSkillRoute \? "script_analysis" : ""/);
  assert.match(chatSource, /forcedSkillRoute \|\| routeLocalSkill/);
});

test("canvas revision endpoint only updates revision nodes once", () => {
  const reviseSource = extractFunction("reviseCanvasNode");

  assert.match(serverSource, /\/api\/canvas\/revise-node/);
  assert.match(serverSource, /function isRevisionCanvasNode/);
  assert.match(serverSource, /function storyboardRevisionIssuesForPrompt/);
  assert.match(serverSource, /function formatStoryboardRevisionIssues/);
  assert.match(serverSource, /已识别的分镜问题清单/);
  assert.match(serverSource, /必须逐条处理/);
  assert.match(serverSource, /不能只做换行、排版或解释/);
  assert.match(serverSource, /function uniqueCanvasNodeTitle/);
  assert.match(reviseSource, /variantKind/);
  assert.match(reviseSource, /parentNodeId/);
  assert.match(reviseSource, /chatLocked/);
  assert.match(reviseSource, /formatStoryboardRevisionIssues\(storyboardRevisionIssuesForPrompt\(parentNode\)\)/);
  assert.match(reviseSource, /storyboardIssueContext \? `\\n\$\{storyboardIssueContext\}` : ""/);
  assert.match(reviseSource, /const revisedValidation = node\.type === "storyboard" \? validateStoryboardContent\(result\.content\) : null/);
  assert.match(reviseSource, /validation: revisedValidation/);
  assert.match(reviseSource, /deepseekChat/);
  assert.match(reviseSource, /chatPrompt/);
  assert.match(reviseSource, /chatResponse/);
});

test("canvas revision saves into the latest canvas after long model calls", () => {
  const reviseSource = extractFunction("reviseCanvasNode");
  const resultIndex = reviseSource.indexOf("const result = await deepseekChat");
  const latestIndex = reviseSource.indexOf("const latestCanvas = await getCanvas(body.canvasId)");
  const saveLatestIndex = reviseSource.indexOf("canvas = await saveCanvas(latestCanvas)");

  assert.ok(resultIndex > -1, "revision should call the model");
  assert.ok(latestIndex > resultIndex, "revision should reload the latest canvas after the model returns");
  assert.ok(saveLatestIndex > latestIndex, "revision should save the reloaded latest canvas");
  assert.match(reviseSource, /latestNode\.meta\?\.chatLocked/);
});

test("notification API exposes unread queue and handling endpoint", () => {
  const apiSource = extractFunction("handleApi");

  assert.match(serverSource, /require\("\.\/lib\/notifications"\)/);
  assert.match(apiSource, /\/api\/notifications/);
  assert.match(apiSource, /listNotifications\(ROOT\)/);
  assert.match(apiSource, /\/api\/notifications\/handle/);
  assert.match(apiSource, /handleNotification\(ROOT/);
});

test("learning library API exposes records rules and skills", () => {
  const apiSource = extractFunction("handleApi");

  assert.match(serverSource, /require\("\.\/lib\/learningLibrary"\)/);
  assert.match(serverSource, /updateCurrentRuleStatus/);
  assert.match(apiSource, /\/api\/learning-library/);
  assert.match(apiSource, /buildLearningLibrary\(ROOT\)/);
  assert.match(apiSource, /\/api\/learning-rules\/status/);
  assert.match(apiSource, /updateCurrentRuleStatus\(ROOT/);
});

test("chat flow applies explicit learning rules into the current ruleset", () => {
  const chatSource = extractFunction("chatWithAssistant");
  const helperSource = extractFunction("applyAutonomousConversationLearning");

  assert.match(serverSource, /extractExplicitRuleLearningInput/);
  assert.match(serverSource, /learnExplicitRule/);
  assert.match(chatSource, /applyAutonomousConversationLearning/);
  assert.match(helperSource, /notifyOnFailure:\s*true/);
  assert.match(helperSource, /assistantMessage\.learningEvent/);
});

test("chat flow no longer exposes legacy long-memory confirmation", () => {
  const apiSource = extractFunction("handleApi");

  assert.doesNotMatch(serverSource, /learningConfirmations/);
  assert.doesNotMatch(serverSource, /applyLearningDecision/);
  assert.doesNotMatch(serverSource, /learningSuggestion\s*=/);
  assert.doesNotMatch(apiSource, /\/api\/learning-confirm/);
});

test("canvas archive endpoints validate storyboard issues and freeze archived canvases", () => {
  const apiSource = extractFunction("handleApi");
  const saveSource = extractFunction("saveCanvas");
  const archiveSource = extractFunction("archiveCanvasRecord");
  const checkSource = extractFunction("buildCanvasArchiveCheck");

  assert.match(serverSource, /require\("\.\/lib\/canvasArchive"\)/);
  assert.match(serverSource, /require\("\.\/lib\/storyboardValidation"\)/);
  assert.match(serverSource, /isStoryboardValidationResolved/);
  assert.match(apiSource, /\/api\/canvas\/archive-check/);
  assert.match(apiSource, /\/api\/canvas\/archive/);
  assert.match(saveSource, /allowArchived/);
  assert.match(saveSource, /archivedAt/);
  assert.match(checkSource, /analyzeCanvasArchiveReadiness/);
  assert.match(checkSource, /validateStoryboardContent/);
  assert.match(checkSource, /isStoryboardValidationResolved/);
  assert.match(archiveSource, /allowArchived:\s*true/);
});

test("canvas delete and restore are soft-delete endpoints for trash", () => {
  const apiSource = extractFunction("handleApi");
  const listSource = extractFunction("listCanvases");
  const deleteSource = extractFunction("deleteCanvasRecord");

  assert.match(apiSource, /\/api\/canvas\/delete/);
  assert.match(apiSource, /\/api\/canvas\/restore/);
  assert.match(apiSource, /includeDeleted/);
  assert.match(listSource, /deletedAt/);
  assert.match(deleteSource, /deletedAt/);
  assert.match(deleteSource, /allowArchived:\s*true/);
});
