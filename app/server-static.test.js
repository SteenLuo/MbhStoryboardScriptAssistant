const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverSource = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
const learningLibrarySource = fs.readFileSync(path.join(__dirname, "lib", "learningLibrary.js"), "utf8");

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
  const contextSource = extractFunction("canvasStoryboardSkillContext");
  const promptSource = extractFunction("canvasStoryboardSkillPrompt");
  const generateSource = extractFunction("generateCanvasStoryboards");

  assert.match(contextSource, /loadLocalSkillContext\(BUSINESS_ROOT,\s*findLocalSkillRoute\("storyboard-generate"\)/);
  assert.match(contextSource, /skillContext\.prompt/);
  assert.match(contextSource, /findLocalSkillRoute\("storyboard-generate"\)/);
  assert.match(contextSource, /routeLocalSkill\("分镜"\)/);
  assert.match(contextSource, /分镜标准格式\.md/);
  assert.match(contextSource, /同一个镜号只能有一个说话人/);
  assert.match(contextSource, /单条台词不得超过 20 个字/);
  assert.match(contextSource, /字段标签使用纯文本/);
  assert.match(contextSource, /只输出分镜正文/);
  assert.match(promptSource, /canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /storyboardSkillContext/);
});

test("canvas storyboard nodes use stable skill rule refs instead of dynamic current rules", () => {
  const contextSource = extractFunction("canvasStoryboardSkillContext");
  const promptSource = extractFunction("canvasStoryboardSkillPrompt");
  const generateSource = extractFunction("generateCanvasStoryboards");

  assert.doesNotMatch(contextSource, /currentRulesUsed:\s*skillContext\.currentRulesUsed/);
  assert.match(promptSource, /canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /const storyboardSkillContext = await canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /skillPrompt:\s*storyboardSkillContext\.prompt/);
  assert.doesNotMatch(generateSource, /currentRulesUsed:\s*storyboardSkillContext\.currentRulesUsed/);
  assert.match(generateSource, /skillRulesUsed/);
});

test("canvas storyboard generation applies hard-rule validation repair and failure feedback", () => {
  const generateSource = extractFunction("generateCanvasStoryboards");
  const reviseSource = extractFunction("reviseCanvasNode");

  assert.match(serverSource, /applyStoryboardHardRuleValidation/);
  assert.match(serverSource, /recordStoryboardHardRuleFailure/);
  assert.match(generateSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.match(generateSource, /hardRuleValidation/);
  assert.match(generateSource, /recordStoryboardHardRuleFailure/);
  assert.match(reviseSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.match(reviseSource, /hardRuleValidation/);
});

test("workflow storyboard generation applies stable skill validation without current rule trace refs", () => {
  const workflowSource = extractFunction("runWorkflowTask");

  assert.match(workflowSource, /taskSkillContext\(task\)/);
  assert.match(workflowSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.doesNotMatch(workflowSource, /currentRulesUsed:\s*skillContext\.currentRulesUsed/);
  assert.match(workflowSource, /skillRulesUsed/);
  assert.match(workflowSource, /recordStoryboardHardRuleFailure/);
});

test("hard-rule failure event records its own event id in generation proof", () => {
  const failureSource = extractFunction("recordStoryboardHardRuleFailure");

  assert.match(failureSource, /const eventId = `hard-rule-validation-failed-/);
  assert.match(failureSource, /eventId,/);
  assert.match(failureSource, /failureEventIds:\s*\[eventId\]/);
  assert.match(failureSource, /sourceEventIds,/);
});

test("first-pass storyboard generation paths load the local storyboard skill", () => {
  const taskPromptSource = extractFunction("taskSkillPrompt");
  const workflowSource = extractFunction("runWorkflowTask");
  const workbenchSource = extractFunction("generateWithDeepSeek");

  assert.match(taskPromptSource, /storyboard-generate/);
  assert.match(taskPromptSource, /canvasStoryboardSkillPrompt\(\)/);
  assert.match(workflowSource, /taskSkillContext\(task\)/);
  assert.match(workflowSource, /skillPrompt/);
  assert.match(workbenchSource, /taskSkillContext\(body\.task\)/);
  assert.match(workbenchSource, /skillPrompt/);
});

test("generic storyboard generation and canvas save apply storyboard validation", () => {
  const workbenchSource = extractFunction("generateWithDeepSeek");
  const saveSource = extractFunction("saveCanvas");

  assert.doesNotMatch(serverSource, /buildCurrentRulesetContext/);
  assert.match(workbenchSource, /body\.task === "storyboard-generate"/);
  assert.match(workbenchSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.doesNotMatch(workbenchSource, /currentRulesUsed:\s*skillContext\.currentRulesUsed/);
  assert.match(workbenchSource, /skillRulesUsed/);
  assert.match(workbenchSource, /recordStoryboardHardRuleFailure/);
  assert.match(saveSource, /applyCanvasStoryboardValidation/);
  assert.doesNotMatch(saveSource, /currentStoryboardRulesUsed\(\)/);
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
  assert.match(learningSource, /已保存到学习资料库/);
  assert.match(learningSource, /不会自动改写生成规则/);
  assert.match(learningSource, /沉淀到稳定 skill/);
  assert.doesNotMatch(learningSource, /已同步到当前规则/);
  assert.doesNotMatch(learningSource, /deepseekChat/);
});

test("chat composer can force dedicated review and adaptation skills", () => {
  const chatSource = extractFunction("chatWithAssistant");

  assert.match(serverSource, /findLocalSkillRoute/);
  assert.match(chatSource, /const forcedSkillRoute = findLocalSkillRoute\(body\.skillRouteId\)/);
  assert.match(chatSource, /forcedSkillRoute \? "script_analysis" : ""/);
  assert.match(chatSource, /forcedSkillRoute \|\| routeLocalSkill/);
});

test("chat assistant skillRoute does not expose dynamic current rules trace refs", () => {
  const chatSource = extractFunction("chatWithAssistant");

  assert.doesNotMatch(chatSource, /currentRulesUsed:\s*skillContext\.currentRulesUsed/);
  assert.match(chatSource, /skillRulesUsed:\s*skillContext\.skillRulesUsed/);
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
  assert.match(reviseSource, /const hardRuleResult = node\.type === "storyboard"/);
  assert.match(reviseSource, /const revisedValidation = hardRuleResult\?\.validation \|\| null/);
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
  assert.match(apiSource, /listNotifications\(BUSINESS_ROOT\)/);
  assert.match(apiSource, /\/api\/notifications\/handle/);
  assert.match(apiSource, /handleNotification\(BUSINESS_ROOT/);
});

test("acceptance fixture mode separates code root from mutable business data root", () => {
  const apiSource = extractFunction("handleApi");
  const correctionSource = extractFunction("handleLearningCorrection");
  const archiveSource = extractFunction("archiveCanvasRecord");
  const learningCycleSource = extractFunction("runLearningCycle");

  assert.match(serverSource, /const ACCEPTANCE_ROOT = process\.env\.MBH_ACCEPTANCE_ROOT/);
  assert.match(serverSource, /const BUSINESS_ROOT = ACCEPTANCE_ROOT \|\| ROOT/);
  assert.match(serverSource, /const RUNS_DIR = path\.join\(BUSINESS_ROOT,\s*"runs"\)/);
  assert.match(serverSource, /const DATA_DIR = path\.join\(BUSINESS_ROOT,\s*"app",\s*"data"\)/);
  assert.match(apiSource, /acceptanceMode:\s*ACCEPTANCE_MODE/);
  assert.match(apiSource, /acceptanceRoot:\s*ACCEPTANCE_ROOT/);
  assert.match(apiSource, /buildLearningLibrary\(BUSINESS_ROOT\)/);
  assert.match(apiSource, /listNotifications\(BUSINESS_ROOT\)/);
  assert.match(apiSource, /updateCurrentRuleStatus\(BUSINESS_ROOT/);
  assert.match(apiSource, /handleNotification\(BUSINESS_ROOT/);
  assert.match(correctionSource, /applyLearningCorrectionRequest\(BUSINESS_ROOT,\s*body/);
  assert.match(archiveSource, /recordArchiveLearningEvidence\(BUSINESS_ROOT/);
  assert.match(learningCycleSource, /"-Root",\s*BUSINESS_ROOT/);
});

test("learning library API exposes fixed D7 contract fields", () => {
  const apiSource = extractFunction("handleApi");

  assert.match(serverSource, /require\("\.\/lib\/learningLibrary"\)/);
  assert.match(serverSource, /require\("\.\/lib\/learningCorrection"\)/);
  assert.match(serverSource, /updateCurrentRuleStatus/);
  assert.match(apiSource, /\/api\/learning-library/);
  assert.match(apiSource, /buildLearningLibrary\(BUSINESS_ROOT\)/);
  for (const field of ["records", "impactItems", "sampleItems", "evalItems", "skillItems", "accessIssues"]) {
    assert.match(learningLibrarySource, new RegExp(`${field}:`));
  }
  assert.match(apiSource, /\/api\/learning-rules\/status/);
  assert.match(apiSource, /updateCurrentRuleStatus\(BUSINESS_ROOT/);
});

test("learning correction API writes referenced correction events without blind rule edits", () => {
  const apiSource = extractFunction("handleApi");
  const correctionSource = extractFunction("handleLearningCorrection");

  assert.match(apiSource, /\/api\/learning-corrections/);
  assert.match(apiSource, /handleLearningCorrection\(body\)/);
  assert.match(serverSource, /applyLearningCorrectionRequest/);
  assert.match(correctionSource, /applyLearningCorrectionRequest\(BUSINESS_ROOT,\s*body/);
  assert.match(correctionSource, /appendLearningEvent/);
  assert.match(correctionSource, /updateCurrentRuleStatus/);
  assert.match(correctionSource, /buildLearningLibrary/);
});

test("chat flow saves explicit learning into the learning event pipeline without generation", () => {
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

test("canvas archive writes learning evidence after save and records evidence failures", () => {
  const archiveSource = extractFunction("archiveCanvasRecord");

  assert.match(serverSource, /require\("\.\/lib\/learningEvidence"\)/);
  assert.match(archiveSource, /const archived = await saveCanvas/);
  assert.match(archiveSource, /recordArchiveLearningEvidence\(BUSINESS_ROOT/);
  assert.match(archiveSource, /learningEvidence/);
  assert.match(archiveSource, /ok:\s*true/);
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
