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
  assert.match(contextSource, /字段标签使用纯文本/);
  assert.match(contextSource, /景别字段必须同时承载必要的构图角度和拍摄视角/);
  assert.match(contextSource, /低角度侧面中景/);
  assert.match(contextSource, /正三四仰拍近景/);
  assert.match(contextSource, /运动镜头占比必须控制在总镜数的 30% 到 40% 之间/);
  assert.match(contextSource, /正面平视镜头占比必须控制在总镜数的 30% 到 40% 之间/);
  assert.match(contextSource, /只输出分镜正文/);
  assert.match(contextSource, /enforceStableHardRules:\s*hasStoryboardDialogueHardRules\(prompt\)/);
  assert.match(serverSource, /STORYBOARD_DIALOGUE_HARD_RULE_PATTERN/);
  assert.match(promptSource, /canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /storyboardSkillContext/);
});

test("canvas storyboard nodes use stable skill rule refs instead of dynamic current rules", () => {
  const contextSource = extractFunction("canvasStoryboardSkillContext");
  const promptSource = extractFunction("canvasStoryboardSkillPrompt");
  const generateSource = extractFunction("generateCanvasStoryboards");

  assert.doesNotMatch(contextSource, /currentRulesUsed:\s*skillContext\.currentRulesUsed/);
  assert.doesNotMatch(contextSource, /每个镜号只能有一行台词/);
  assert.doesNotMatch(contextSource, /超过 20 个字时必须拆成新的连续镜号/);
  assert.doesNotMatch(contextSource, /拆成多条台词/);
  assert.match(promptSource, /canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /const storyboardSkillContext = await canvasStoryboardSkillContext\(\)/);
  assert.match(generateSource, /skillPrompt:\s*storyboardSkillContext\.prompt/);
  assert.match(generateSource, /enforceStableHardRules:\s*storyboardSkillContext\.enforceStableHardRules/);
  assert.doesNotMatch(generateSource, /currentRulesUsed:\s*storyboardSkillContext\.currentRulesUsed/);
  assert.match(generateSource, /skillRulesUsed/);
});

test("canvas storyboard planning rejects empty script nodes before episode splitting", () => {
  const planSource = extractFunction("planCanvasStoryboards");
  const generateSource = extractFunction("generateCanvasStoryboards");

  assert.match(serverSource, /function canvasScriptNodeContentForStoryboard/);
  assert.match(planSource, /const scriptContent = canvasScriptNodeContentForStoryboard\(sourceNode\)/);
  assert.match(generateSource, /const scriptContent = canvasScriptNodeContentForStoryboard\(sourceNode\)/);
  assert.match(planSource, /splitScriptIntoEpisodes\(scriptContent\)/);
  assert.match(generateSource, /splitScriptIntoEpisodes\(scriptContent\)/);
  assert.doesNotMatch(planSource, /splitScriptIntoEpisodes\(sourceNode\.content\)/);
  assert.doesNotMatch(generateSource, /splitScriptIntoEpisodes\(sourceNode\.content\)/);
});

test("local static assets disable browser caching for iterative fixes", () => {
  const staticSource = extractFunction("serveStatic");

  assert.match(serverSource, /function sendStatic/);
  assert.match(serverSource, /Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"/);
  assert.match(serverSource, /"Pragma": "no-cache"/);
  assert.match(serverSource, /"Expires": "0"/);
  assert.match(staticSource, /sendStatic\(res,\s*200/);
  assert.doesNotMatch(staticSource, /sendText\(res,\s*200/);
});

test("canvas storyboard generation marks hard-rule issues without blocking output", () => {
  const generateSource = extractFunction("generateCanvasStoryboards");
  const generationSource = extractFunction("generateStoryboardEpisodeWithValidation");
  const generationInputSource = extractFunction("buildStoryboardEpisodeGenerationInput");
  const reviseSource = extractFunction("reviseCanvasNode");

  assert.match(serverSource, /applyStoryboardHardRuleValidation/);
  assert.match(generateSource, /generateStoryboardEpisodeWithValidation/);
  assert.match(generationSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.match(generationSource, /STORYBOARD_GENERATION_MAX_ATTEMPTS/);
  assert.match(generationSource, /buildStoryboardHardRuleRetryFeedback/);
  assert.match(generationInputSource, /已命中的分镜 skill 硬规则/);
  assert.match(generationInputSource, /20-40 字拆 2 个镜号/);
  assert.match(generationInputSource, /连续台词总字数不超过 20 字/);
  assert.match(generationInputSource, /禁止仅为了变化景别/);
  assert.match(generationInputSource, /林秀娥：您言重了/);
  assert.match(generationInputSource, /必须写在同一个镜号/);
  assert.match(generationInputSource, /非空台词必须在台词内容前标注说话人或声音来源/);
  assert.match(generationInputSource, /台词：陈建军：秀娥，你今天真好看/);
  assert.match(generationInputSource, /人物台词必须保真/);
  assert.match(generationInputSource, /拼回必须与剧本原台词完全一致/);
  assert.match(generationInputSource, /运动镜头占比必须在总镜数的 30% 到 40% 之间/);
  assert.match(generationInputSource, /禁止连续 3 个及以上运动镜头/);
  assert.match(generationInputSource, /正面平视镜头占比必须在总镜数的 30% 到 40% 之间/);
  assert.match(generationInputSource, /禁止连续使用相同景别\/角度\/构图/);
  assert.match(generationInputSource, /只差默认正面平视省略词的写法视为同构图/);
  assert.match(generationInputSource, /接上一镜/);
  assert.match(generationInputSource, /连续多个“景别：双人中景”/);
  assert.match(generationSource, /sourceScript:\s*input\.episode\?\.content \|\| input\.sourceNode\?\.content/);
  assert.match(generationInputSource, /拆完后逐条自查/);
  assert.match(generationInputSource, /非空台词必须写成“台词：说话人：原文台词”/);
  assert.match(generationInputSource, /同一说话人相邻短台词合并后不超过 20 字/);
  assert.match(generationInputSource, /修正连续相同景别\/角度\/构图拍同一画面的镜头/);
  assert.match(generationInputSource, /运动镜头占比和正面平视镜头占比都调整到 30% 到 40%/);
  assert.match(generateSource, /hardRuleValidation/);
  assert.doesNotMatch(generateSource, /throw createStoryboardHardRuleError/);
  assert.match(generateSource, /content:\s*hardRuleResult\.content/);
  assert.match(generateSource, /validation:\s*hardRuleResult\.validation/);
  assert.match(generateSource, /generationAttempts/);
  assert.match(reviseSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.match(reviseSource, /hardRuleValidation/);
  assert.doesNotMatch(reviseSource, /throw createStoryboardHardRuleError/);
});

test("workflow storyboard generation marks stable skill validation without blocking output", () => {
  const workflowSource = extractFunction("runWorkflowTask");

  assert.match(workflowSource, /taskSkillContext\(task\)/);
  assert.match(workflowSource, /applyStoryboardHardRuleValidation\(result\.content/);
  assert.doesNotMatch(workflowSource, /currentRulesUsed:\s*skillContext\.currentRulesUsed/);
  assert.match(workflowSource, /skillRulesUsed/);
  assert.doesNotMatch(workflowSource, /throw createStoryboardHardRuleError/);
  assert.match(workflowSource, /finalContent = hardRuleResult\.content/);
});

test("hard-rule failure event records its own event id in generation proof", () => {
  const failureSource = extractFunction("recordStoryboardHardRuleFailure");
  const errorSource = extractFunction("createStoryboardHardRuleError");

  assert.match(failureSource, /const eventId = `hard-rule-validation-failed-/);
  assert.match(failureSource, /const skillId = "storyboard-generate"/);
  assert.match(failureSource, /skills\/03-storyboard\/storyboard-generate\/SKILL\.md/);
  assert.match(failureSource, /eventId,/);
  assert.match(failureSource, /skillId,/);
  assert.match(failureSource, /landingIds:\s*\[skillFileRef\]/);
  assert.match(failureSource, /failureEventIds:\s*\[eventId\]/);
  assert.match(failureSource, /sourceEventIds,/);
  assert.match(failureSource, /return \{/);
  assert.match(errorSource, /issueCount/);
  assert.match(errorSource, /lineNumber/);
  assert.match(errorSource, /lineText/);
  assert.match(errorSource, /skillFile/);
  assert.match(errorSource, /appendStoryboardHardRuleSummary/);
  assert.match(errorSource, /STORYBOARD_HARD_RULE_VALIDATION_FAILED/);
  const summarySource = extractFunction("appendStoryboardHardRuleSummary");
  assert.match(summarySource, /共 \$\{issueCount/);
  assert.match(summarySource, /第 \$\{first\.lineNumber\} 行/);
});

test("API errors preserve structured hard-rule details", () => {
  const responseSource = extractFunction("errorResponse");
  const handleSource = serverSource.slice(serverSource.indexOf("const server = http.createServer"));

  assert.match(responseSource, /payload\.code = error\.code/);
  assert.match(responseSource, /payload\.details = error\.details/);
  assert.match(handleSource, /sendJson\(res,\s*500,\s*errorResponse\(error\)\)/);
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
  assert.doesNotMatch(workbenchSource, /throw createStoryboardHardRuleError/);
  assert.match(workbenchSource, /finalContent = hardRuleResult\.content/);
  assert.match(saveSource, /applyCanvasStoryboardValidation/);
  assert.doesNotMatch(saveSource, /currentStoryboardRulesUsed\(\)/);
});

test("server prompts no longer apply script level rules", () => {
  assert.doesNotMatch(serverSource, /scriptGrade|buildScriptGradePrompt|normalizeScriptGrade|scriptGradeLabel/);
  assert.doesNotMatch(serverSource, /B级本|A级本/);
});

test("explicit skill learning mode applies target skill updates through skill creator", () => {
  const chatSource = extractFunction("chatWithAssistant");
  const learningSource = extractFunction("handleLearningCompose");
  const helperSource = extractFunction("applyAutonomousConversationLearning");

  assert.match(chatSource, /const explicitLearningMode = body\.learningMode === true/);
  assert.match(chatSource, /findLocalSkillRoute\("skill-creator"\)/);
  assert.doesNotMatch(chatSource, /routeLocalSkill\("样例 学习 入库 技能学习"\)/);
  assert.match(chatSource, /if \(explicitLearningMode\)/);
  assert.match(chatSource, /handleLearningCompose/);
  assert.match(serverSource, /writeSkillCreatorUpdatedSkill/);
  assert.match(learningSource, /inferTargetSkillIdForLearning/);
  assert.match(learningSource, /const targetRoute = findLocalSkillRoute\(targetSkillId\) \|\| findLocalSkillRoute\("skill-creator"\)/);
  assert.match(learningSource, /loadLocalSkillContext\(BUSINESS_ROOT,\s*targetRoute/);
  assert.match(learningSource, /loadLocalSkillContext\(BUSINESS_ROOT,\s*skillCreatorRoute/);
  assert.match(learningSource, /deepseekChat/);
  assert.match(learningSource, /buildSkillCreatorApplySystemPrompt/);
  assert.match(learningSource, /writeSkillCreatorUpdatedSkill\(BUSINESS_ROOT/);
  assert.match(learningSource, /landingType:\s*"formal-skill"/);
  assert.match(learningSource, /proofStatus:\s*"pending_first_hit"/);
  assert.match(learningSource, /writeConversationLearningRecord/);
  assert.doesNotMatch(learningSource, /applyAutonomousConversationLearning/);
  assert.doesNotMatch(learningSource, /writeSkillCreatorTaskRecord/);
  assert.doesNotMatch(learningSource, /buildSkillCreatorTaskDraft/);
  assert.doesNotMatch(serverSource, /writeDirectSkillLearning/);
  assert.doesNotMatch(helperSource, /writeSkillLearningReference/);
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

test("chat persists the user message before long assistant generation starts", () => {
  const chatSource = extractFunction("chatWithAssistant");
  const pushIndex = chatSource.indexOf("conversation.messages.push(userMessage);");
  const saveIndex = chatSource.indexOf("await saveConversation(conversation);", pushIndex);
  const workflowIntentIndex = chatSource.indexOf("const workflowIntent", pushIndex);
  const learningCallIndex = chatSource.indexOf("await handleLearningCompose", pushIndex);
  const workflowCallIndex = chatSource.indexOf("await runWorkflowChat", pushIndex);
  const modelCallIndex = chatSource.indexOf("await deepseekChat", pushIndex);

  assert.ok(pushIndex > -1, "chat should append the user message");
  assert.ok(saveIndex > pushIndex, "chat should save after appending the user message");
  assert.ok(saveIndex < workflowIntentIndex, "save should happen before routing to long-running work");
  assert.ok(saveIndex < learningCallIndex, "save should happen before learning mode generation");
  assert.ok(saveIndex < workflowCallIndex, "save should happen before workflow generation");
  assert.ok(saveIndex < modelCallIndex, "save should happen before direct model generation");
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
  assert.match(reviseSource, /const storyboardValidationOptions = \{/);
  assert.match(reviseSource, /useStableSkillRules:\s*storyboardSkillContext\?\.enforceStableHardRules === true/);
  assert.match(reviseSource, /formatStoryboardRevisionIssues\(storyboardRevisionIssuesForPrompt\(parentNode,\s*storyboardValidationOptions\)\)/);
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
  assert.match(apiSource, /handleNotification\(BUSINESS_ROOT/);
  assert.match(correctionSource, /applyLearningCorrectionRequest\(BUSINESS_ROOT,\s*body/);
  assert.match(archiveSource, /recordArchiveLearningEvidence\(BUSINESS_ROOT/);
  assert.match(learningCycleSource, /"-Root",\s*BUSINESS_ROOT/);
});

test("learning library API exposes fixed D7 contract fields", () => {
  const apiSource = extractFunction("handleApi");

  assert.match(serverSource, /require\("\.\/lib\/learningLibrary"\)/);
  assert.match(serverSource, /require\("\.\/lib\/learningCorrection"\)/);
  assert.match(apiSource, /\/api\/learning-library/);
  assert.match(apiSource, /buildLearningLibrary\(BUSINESS_ROOT\)/);
  for (const field of ["records", "impactItems", "sampleItems", "evalItems", "skillItems", "accessIssues"]) {
    assert.match(learningLibrarySource, new RegExp(`${field}:`));
  }
  assert.doesNotMatch(apiSource, /\/api\/learning-rules\/status/);
  assert.doesNotMatch(serverSource, /updateCurrentRuleStatus/);
});

test("learning correction API writes referenced correction events without blind rule edits", () => {
  const apiSource = extractFunction("handleApi");
  const correctionSource = extractFunction("handleLearningCorrection");

  assert.match(apiSource, /\/api\/learning-corrections/);
  assert.match(apiSource, /handleLearningCorrection\(body\)/);
  assert.match(serverSource, /applyLearningCorrectionRequest/);
  assert.match(correctionSource, /applyLearningCorrectionRequest\(BUSINESS_ROOT,\s*body/);
  assert.match(correctionSource, /appendLearningEvent/);
  assert.match(correctionSource, /buildLearningLibrary/);
});

test("autonomous conversation learning saves passive candidates without direct skill writes", () => {
  const helperSource = extractFunction("applyAutonomousConversationLearning");

  assert.match(serverSource, /extractExplicitRuleLearningInput/);
  assert.doesNotMatch(helperSource, /learnExplicitRule/);
  assert.match(helperSource, /appendLearningEvent/);
  assert.doesNotMatch(helperSource, /writeSkillLearningReference/);
  assert.doesNotMatch(helperSource, /writeDirectSkillLearning/);
  assert.doesNotMatch(helperSource, /writeSkillCreatorUpdatedSkill/);
  assert.doesNotMatch(serverSource, /function writeSkillLearningReference/);
  assert.doesNotMatch(serverSource, /学习沉淀要求\.md/);
  assert.match(helperSource, /landingType:\s*"skill-draft"/);
  assert.match(helperSource, /landingType:\s*"skill-draft"/);
  assert.match(helperSource, /assistantMessage\.learningEvent/);
  assert.doesNotMatch(helperSource, /assistantMessage\.skillReferencePath/);
});

test("explicit skill learning routes to the target formal skill through skill creator", () => {
  const chatSource = extractFunction("chatWithAssistant");
  const learningSource = extractFunction("handleLearningCompose");

  assert.match(chatSource, /findLocalSkillRoute\("skill-creator"\)/);
  assert.doesNotMatch(chatSource, /routeLocalSkill\("样例 学习 入库 技能学习"\)/);
  assert.match(learningSource, /inferTargetSkillIdForLearning/);
  assert.match(learningSource, /readTargetSkillMarkdown/);
  assert.match(learningSource, /buildSkillCreatorApplyUserPrompt/);
  assert.match(learningSource, /writeSkillCreatorUpdatedSkill/);
  assert.doesNotMatch(learningSource, /New-SkillCreatorTask|skill-creator 任务/);
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
