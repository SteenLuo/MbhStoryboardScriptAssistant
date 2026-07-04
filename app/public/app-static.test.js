const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = appSource.indexOf("\nfunction ", start + marker.length);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

function extractStyleBlock(selector) {
  const marker = `${selector} {`;
  const start = stylesSource.indexOf(marker);
  assert.notEqual(start, -1, `${selector} should exist`);
  const end = stylesSource.indexOf("\n}", start);
  assert.notEqual(end, -1, `${selector} should have a closing brace`);
  return stylesSource.slice(start, end + 2);
}

test("newCanvas creates from app state instead of browser prompt", () => {
  const newCanvasSource = extractFunction("newCanvas");

  assert.equal(
    newCanvasSource.includes("window.prompt"),
    false,
    "newCanvas should not depend on browser-native prompts",
  );
});

test("storyboard generation shows and clears node busy feedback", () => {
  const generateAllSource = extractFunction("generateAllStoryboardsFromNode");
  const generateConfirmedSource = extractFunction("generateConfirmedStoryboards");

  assert.match(appSource, /canvasBusy/);
  assert.match(appSource, /function setCanvasBusy/);
  assert.match(generateAllSource, /setCanvasBusy\(nodeId/);
  assert.match(generateAllSource, /finally\s*{[\s\S]*setCanvasBusy\(null/);
  assert.match(generateConfirmedSource, /setCanvasBusy\(sourceNodeId/);
  assert.match(generateConfirmedSource, /finally\s*{[\s\S]*setCanvasBusy\(null/);
  assert.match(appSource, /canvas-node-busy/);
  assert.match(stylesSource, /@keyframes canvasBusySpin/);
});

test("canvas long-running requests expose visible busy feedback", () => {
  const generateScriptSource = extractFunction("generateScriptFromNode");
  const planStoryboardsSource = extractFunction("planStoryboardsFromNode");
  const archiveSource = extractFunction("archiveCurrentCanvas");

  assert.match(generateScriptSource, /setCanvasBusy\(nodeId,\s*"剧本生成中"/);
  assert.match(generateScriptSource, /finally\s*{[\s\S]*clearCanvasBusy\(nodeId\)/);
  assert.match(planStoryboardsSource, /setCanvasBusy\(nodeId,\s*"分集识别中"/);
  assert.match(planStoryboardsSource, /finally\s*{[\s\S]*clearCanvasBusy\(nodeId\)/);
  assert.match(archiveSource, /setCanvasActionBusy\("archiveCurrentCanvas",\s*"归档检查中"/);
  assert.match(archiveSource, /finally\s*{[\s\S]*clearCanvasActionBusy\("archiveCurrentCanvas"\)/);
  assert.match(appSource, /function setCanvasActionBusy/);
  assert.match(stylesSource, /\.is-action-busy/);
});

test("canvas revision nodes are created from plus menu and submitted once", () => {
  const submitRevisionSource = extractFunction("submitCanvasRevisionChat");

  assert.match(appSource, /function isCanvasRevisionNode/);
  assert.match(appSource, /function createRevisionCanvasNode/);
  assert.match(appSource, /function renderCanvasRevisionChat/);
  assert.match(appSource, /function updateCanvasSelectionModeClass/);
  assert.match(appSource, /async function submitCanvasRevisionChat/);
  assert.match(appSource, /create-revision/);
  assert.match(appSource, /\/api\/canvas\/revise-node/);
  assert.match(appSource, /chatLocked/);
  assert.match(appSource, /parentNodeId/);
  assert.match(appSource, /canvas-node-revision-chat/);
  assert.match(appSource, /item\.appendChild\(renderCanvasRevisionChat\(node\)\)/);
  assert.match(appSource, /canvas-multi-selecting/);
  assert.match(appSource, /function clearCanvasBusy/);
  assert.match(submitRevisionSource, /setCanvasBusy\(nodeId/);
  assert.match(submitRevisionSource, /finally\s*{[\s\S]*clearCanvasBusy\(nodeId\)/);
  assert.match(stylesSource, /\.canvas-node-revision-chat/);
  assert.match(stylesSource, /\.canvas-shell\.canvas-multi-selecting \.canvas-node-revision-chat/);
  assert.match(stylesSource, /\.canvas-node-revision-badge/);
});

test("canvas node titles are checked for uniqueness before rename", () => {
  const commitTitleSource = extractFunction("commitCanvasNodeTitleEdit");

  assert.match(appSource, /function hasCanvasNodeTitleConflict/);
  assert.match(appSource, /function uniqueCanvasNodeTitle/);
  assert.match(commitTitleSource, /hasCanvasNodeTitleConflict/);
});

test("canvas merged version workflow has selection, grouping, and history UI", () => {
  const endPointerSource = extractFunction("endCanvasPointer");
  const renderCanvasSource = extractFunction("renderCanvas");

  assert.match(appSource, /selectedCanvasNodeIds/);
  assert.match(appSource, /function startCanvasSelection/);
  assert.match(appSource, /function groupSelectedCanvasNodes/);
  assert.match(appSource, /function createMergedCanvasNode/);
  assert.match(appSource, /function renderCanvasMergedHistoryModal/);
  assert.match(appSource, /function setMergedPrimaryVersion/);
  assert.match(appSource, /function canvasMergedVersionRailSegments/);
  assert.match(appSource, /uniqueCanvasNodeTitleOutside/);
  assert.equal(appSource.includes("renderCanvasMergedStack"), false);
  assert.match(appSource, /canvas-node-merge-badge/);
  assert.match(appSource, /canvas-node-version-rail/);
  assert.match(appSource, /canvasSelectionBox/);
  assert.match(stylesSource, /\.canvas-selection-box/);
  assert.match(stylesSource, /\.canvas-group-bar \{[\s\S]*left: 50%;[\s\S]*bottom: 76px;[\s\S]*transform: translateX\(-50%\)/);
  assert.doesNotMatch(stylesSource, /\.canvas-group-bar \{[\s\S]*left: 222px/);
  assert.match(stylesSource, /\.canvas-group-bar span \{[\s\S]*display: inline-flex;[\s\S]*align-items: center;[\s\S]*min-height: 30px;[\s\S]*line-height: 1/);
  assert.match(stylesSource, /\.canvas-group-bar label \{[\s\S]*margin: 0;[\s\S]*white-space: nowrap/);
  assert.match(stylesSource, /\.canvas-group-bar select \{[\s\S]*min-width: 148px/);
  assert.match(stylesSource, /\.canvas-status \{[\s\S]*right: 24px;[\s\S]*width: max-content;[\s\S]*max-width: min\(420px, calc\(100% - 48px\)\)/);
  assert.doesNotMatch(stylesSource, /\.canvas-status \{[\s\S]*left: 286px/);
  assert.doesNotMatch(renderCanvasSource, /canvasStatus\(`节点/);
  assert.match(endPointerSource, /canGroup\.ok[\s\S]*canvasStatus\("", \{ force: true \}\)/);
  assert.match(endPointerSource, /canvasStatus\(canGroup\.reason\)/);
  assert.doesNotMatch(appSource, /可指定唯一版本后合并/);
  assert.match(stylesSource, /\.canvas-node-merge-badge/);
  assert.match(stylesSource, /\.canvas-node-version-rail/);
  assert.match(stylesSource, /\.canvas-node-version-rail span\.active/);
  assert.equal(stylesSource.includes(".canvas-node.merged::before"), false);
  assert.equal(stylesSource.includes(".canvas-node.merged::after"), false);
  assert.match(stylesSource, /\.canvas-merge-history-modal/);
  assert.match(stylesSource, /\.canvas-merge-history-list::-webkit-scrollbar-thumb/);
  assert.match(stylesSource, /\.canvas-merge-version-grid p::-webkit-scrollbar-thumb/);
  assert.equal(stylesSource.includes("canvas-node-merged-stack"), false);
});

test("center selected canvas node zooms to a readable focused view", () => {
  const centerSource = extractFunction("centerCanvasOnNode");

  assert.match(appSource, /const canvasZoomMax = 8/);
  assert.match(appSource, /function canvasReadableZoomForBounds/);
  assert.match(appSource, /function canvasExpandedZoomForBounds/);
  assert.match(appSource, /function focusCanvasNodeToViewport/);
  assert.match(appSource, /canvasFocusReadableZoom/);
  assert.match(appSource, /canvasFocusMinReadableZoom/);
  assert.match(appSource, /canvasNodeFocusPadding/);
  assert.match(appSource, /const canvasNodeFocusMaxZoom = 2/);
  assert.match(appSource, /const canvasNodeFocusWidthRatio = 0\.48/);
  assert.match(appSource, /const canvasNodeFocusHeightRatio = 0\.42/);
  assert.match(centerSource, /canvasReadableZoomForBounds/);
  assert.match(centerSource, /animateCanvasViewportTo/);
  assert.match(centerSource, /canvasCenteredScrollForBounds/);
  assert.match(appSource, /canvasExpandedZoomForBounds[\s\S]*proportionalZoom[\s\S]*Math\.min\(canvasNodeFocusMaxZoom, canvasZoomMax\)/);
});

test("canvas edit history exposes undo redo controls shortcuts and multi-delete", () => {
  const saveSource = extractFunction("saveCurrentCanvas");
  const undoSource = extractFunction("undoCanvasEdit");
  const redoSource = extractFunction("redoCanvasEdit");
  const contextMenuSource = extractFunction("openCanvasContextMenu");
  const deleteSelectedSource = extractFunction("deleteSelectedCanvasNodes");

  assert.match(indexSource, /id="undoCanvasEdit"/);
  assert.match(indexSource, /id="redoCanvasEdit"/);
  assert.match(indexSource, /撤销 Ctrl\+Z/);
  assert.match(indexSource, /重做 Ctrl\+Y/);
  assert.match(appSource, /canvasUndoStack/);
  assert.match(appSource, /canvasRedoStack/);
  assert.match(appSource, /canvasHistoryBaseSnapshot/);
  assert.match(appSource, /const canvasHistoryLimit = 80/);
  assert.match(appSource, /function resetCanvasHistory/);
  assert.match(appSource, /function rememberCanvasHistoryBeforeSave/);
  assert.match(appSource, /function applyCanvasHistorySnapshot/);
  assert.match(appSource, /function updateCanvasHistoryControls/);
  assert.match(saveSource, /rememberCanvasHistoryBeforeSave\(\)/);
  assert.match(saveSource, /options\.skipHistory/);
  assert.match(undoSource, /state\.canvasUndoStack\.pop\(\)/);
  assert.match(undoSource, /state\.canvasRedoStack\.push\(canvasHistorySnapshot\(\)\)/);
  assert.match(redoSource, /state\.canvasRedoStack\.pop\(\)/);
  assert.match(redoSource, /state\.canvasUndoStack\.push\(canvasHistorySnapshot\(\)\)/);
  assert.match(appSource, /isCanvasHistoryShortcutTarget\(event\.target\)/);
  assert.match(appSource, /key === "z"[\s\S]*undoCanvasEdit\(\)/);
  assert.match(appSource, /key === "y"[\s\S]*redoCanvasEdit\(\)/);
  assert.match(contextMenuSource, /selectedIds\.size > 1 && selectedIds\.has\(nodeId\)/);
  assert.match(contextMenuSource, /删除选中节点/);
  assert.match(appSource, /delete-selected/);
  assert.match(deleteSelectedSource, /requestCanvasDeleteConfirm/);
  assert.match(deleteSelectedSource, /ids\.has\(edge\.from\) \|\| ids\.has\(edge\.to\)/);
  assert.match(deleteSelectedSource, /await saveCurrentCanvas\(\)/);
  assert.match(stylesSource, /\.canvas-view-tools-divider/);
});

test("cat notification queue renders actionable persistent prompts", () => {
  assert.match(appSource, /notifications/);
  assert.match(appSource, /function loadNotifications/);
  assert.match(appSource, /function renderCatNotification/);
  assert.match(appSource, /function handleCatNotification/);
  assert.match(appSource, /\/api\/notifications/);
  assert.match(appSource, /\/api\/notifications\/handle/);
  assert.match(stylesSource, /\.cat-notification/);
  assert.match(stylesSource, /\.cat-notification-actions/);
  assert.match(stylesSource, /\.cat-notification-count/);
});

test("learning library is reachable from sidebar and renders readonly tabs", () => {
  assert.match(indexSource, /openLearningLibrary/);
  assert.match(indexSource, /id="learningPage"/);
  assert.match(indexSource, /id="closeLearningPage"/);
  assert.doesNotMatch(indexSource, /settingsTabLearning/);
  assert.doesNotMatch(indexSource, /settingsPanelLearning/);
  assert.doesNotMatch(indexSource, /M0-M6|刷新学习闭环|completenessList|refreshLearning/);
  assert.doesNotMatch(indexSource, /learningOverview|learningAppliedCount|learningFailedCount/);
  assert.match(indexSource, /learningRecordsTabCount/);
  assert.match(indexSource, /learningRulesTabCount/);
  assert.match(indexSource, /learningSkillsTabCount/);
  assert.match(indexSource, /learningRecordHelp/);
  assert.match(indexSource, /学习记录说明/);
  assert.match(indexSource, /data-learning-library-tab="records"[\s\S]*learningRecordHelp[\s\S]*学习记录状态[\s\S]*处理中[\s\S]*已生效[\s\S]*已被覆盖[\s\S]*失败[\s\S]*<\/button>/);
  assert.match(indexSource, /learningSkillHelp/);
  assert.match(indexSource, /技能库说明/);
  assert.match(indexSource, /对话可以先影响当前规则层/);
  assert.match(indexSource, /不会直接编辑技能文件/);
  assert.match(indexSource, /data-learning-library-tab="skills"[\s\S]*learningSkillHelp[\s\S]*<\/button>/);
  assert.doesNotMatch(indexSource, /<\/div>\s*<div class="learning-help-wrap">[\s\S]*learningSkillHelp/);
  assert.match(indexSource, /learningFailureJump/);
  assert.match(indexSource, /learning-guide/);
  assert.match(indexSource, /手动学习/);
  assert.match(indexSource, /自动学习/);
  assert.match(indexSource, /以后分镜台词超过20字就拆镜/);
  assert.match(indexSource, /同一要求在同一对话里被再次强调/);
  assert.match(indexSource, /同一镜号台词超过20字要拆镜头/);
  assert.match(indexSource, /不会凭空猜/);
  assert.match(indexSource, /默认剧本评审先看人物动机/);
  assert.match(indexSource, /以后分镜不能连续三个同景别镜头/);
  assert.match(indexSource, /不触发：只要求本轮修改、闲聊、一次性反馈/);
  assert.match(indexSource, /落实到规则/);
  assert.match(indexSource, /技能命中后叠加规则/);
  assert.match(indexSource, /不会单独调用“当前规则”/);
  assert.match(indexSource, /先命中一个本地技能/);
  assert.match(indexSource, /同能力范围的当前规则追加到该技能上下文/);
  assert.match(indexSource, /未命中对应技能的规则不会独立生效/);
  assert.doesNotMatch(indexSource, /class="learning-status-guide"/);
  assert.match(indexSource, /学习记录状态/);
  assert.match(indexSource, /处理中/);
  assert.doesNotMatch(indexSource, /<b>已记录<\/b>/);
  assert.match(indexSource, /已生效/);
  assert.match(indexSource, /已被覆盖/);
  assert.match(indexSource, /失败/);
  assert.match(indexSource, /current-ruleset|当前规则层/);
  assert.match(indexSource, /SKILL\.md/);
  assert.match(indexSource, /learningLibraryRecords/);
  assert.match(indexSource, /learningLibraryRules/);
  assert.match(indexSource, /learningLibrarySkills/);
  assert.match(appSource, /learningLibrary/);
  assert.match(appSource, /function openLearningPage/);
  assert.match(appSource, /function closeLearningPage/);
  assert.match(appSource, /openNotificationTarget[\s\S]*openLearningPage/);
  assert.match(appSource, /function loadLearningPanel/);
  assert.match(appSource, /function renderLearningLibrary/);
  assert.match(appSource, /function renderLearningTabCounts/);
  assert.match(appSource, /function jumpToNextLearningFailure/);
  assert.match(appSource, /function setCurrentRuleStatus/);
  assert.match(appSource, /function formatCurrentRuleStatus/);
  assert.match(appSource, /\/api\/learning-rules\/status/);
  assert.match(appSource, /data-rule-status-action/);
  assert.match(appSource, /active: "已启用"/);
  assert.match(appSource, /disabled: "已停用"/);
  assert.match(appSource, /rule\.status === "active" \? "disabled" : "active"/);
  assert.match(appSource, /viewedLearningFailureIds/);
  assert.match(appSource, /function renderSkillLibraryItem/);
  assert.match(indexSource, /<span>学习记录<\/span>/);
  assert.match(indexSource, /<span>技能库<\/span>/);
  assert.doesNotMatch(appSource, /"已记录":\s*"已记录"/);
  assert.match(appSource, /learning-skill-detail/);
  assert.match(appSource, /skill\.instructions/);
  assert.match(appSource, /\/api\/learning-library/);
  assert.doesNotMatch(appSource, /\/api\/product-completeness|refreshLearningCycle/);
  assert.match(appSource, /data-learning-library-tab/);
  assert.match(stylesSource, /\.learning-page/);
  assert.match(stylesSource, /\.learning-page-panel/);
  assert.doesNotMatch(stylesSource, /\.learning-overview/);
  assert.match(stylesSource, /\.learning-guide/);
  assert.match(stylesSource, /\.learning-guide-grid/);
  assert.doesNotMatch(stylesSource, /\.learning-status-guide/);
  assert.match(stylesSource, /\.learning-library/);
  assert.match(stylesSource, /\.learning-library-tabs/);
  assert.match(stylesSource, /\.learning-help-button/);
  assert.match(stylesSource, /\.learning-help-popover/);
  const learningTabsRowStyles = extractStyleBlock(".learning-library-tabs-row");
  const learningHelpWrapStyles = extractStyleBlock(".learning-help-wrap");
  const learningHelpPopoverStyles = extractStyleBlock(".learning-help-popover");
  assert.match(learningTabsRowStyles, /position: relative/);
  assert.match(learningHelpWrapStyles, /position: static/);
  assert.match(learningHelpPopoverStyles, /left: 0/);
  assert.match(learningHelpPopoverStyles, /z-index: 20/);
  assert.match(learningHelpPopoverStyles, /text-align: left/);
  assert.match(learningHelpPopoverStyles, /white-space: normal/);
  assert.match(stylesSource, /\.learning-library-tabs button\[data-learning-library-tab="skills"\] \.learning-help-popover \{[\s\S]*right: 0;[\s\S]*left: auto/);
  assert.match(stylesSource, /\.learning-failure-jump/);
  assert.match(stylesSource, /\.learning-library-item\.focus/);
  assert.match(stylesSource, /\.learning-rule-actions/);
  assert.match(stylesSource, /\.learning-library-item\.status-disabled/);
  assert.match(stylesSource, /\.learning-skill-detail/);
  assert.match(stylesSource, /\.sidebar-icon-stack/);
});

test("learning record renderer uses D2 display fields before raw legacy fields", () => {
  const renderRecordSource = extractFunction("renderLearningRecordItem");
  const keySource = extractFunction("learningRecordKey");
  const failedSource = extractFunction("isFailedLearningRecord");

  assert.match(renderRecordSource, /record\.learnedText/);
  assert.match(renderRecordSource, /record\.displayStatus\s*\|\|\s*record\.status/);
  assert.match(renderRecordSource, /record\.sourceText/);
  assert.match(renderRecordSource, /record\.usedWhereText/);
  assert.match(renderRecordSource, /record\.generationImpactText/);
  assert.match(renderRecordSource, /record\.generationProof\?\.claimText/);
  assert.match(renderRecordSource, /record\.advanced\?\.error\?\.message/);
  assert.match(renderRecordSource, /record\.advanced\?\.coveredByEventId/);
  assert.match(keySource, /record\?\.recordId/);
  assert.match(failedSource, /record\?\.displayStatus\s*\|\|\s*record\?\.status/);
  assert.doesNotMatch(renderRecordSource, /record\.summary \|\| record\.rawTrigger \|\| record\.topicKey/);
  assert.doesNotMatch(renderRecordSource, /formatLearningSource\(record\.sourceType\)/);
  assert.doesNotMatch(renderRecordSource, /formatLearningTokenUsage\(record\.tokenUsage\)/);
});

test("chat no longer renders legacy long-memory confirmation cards", () => {
  assert.doesNotMatch(appSource, /function renderLearningSuggestion/);
  assert.doesNotMatch(appSource, /function confirmLearningSuggestion/);
  assert.doesNotMatch(appSource, /\/api\/learning-confirm/);
  assert.doesNotMatch(appSource, /可长期记住|已记住：|未记住：/);
  assert.doesNotMatch(stylesSource, /\.learning-suggestion/);
});

test("chat composer supports scrolling long pasted text", () => {
  const composerTextareaStyles = extractStyleBlock(".composer textarea");

  assert.match(composerTextareaStyles, /max-height: 36vh/);
  assert.match(composerTextareaStyles, /overflow-y: auto/);
  assert.doesNotMatch(composerTextareaStyles, /overflow:\s*hidden/);
  assert.match(composerTextareaStyles, /scrollbar-color:/);
  assert.match(stylesSource, /\.composer textarea::-webkit-scrollbar-thumb/);
});

test("chat composer no longer exposes script level toggles", () => {
  assert.doesNotMatch(indexSource, /data-script-grade|B级本|A级本|script-grade\.js/);
  assert.doesNotMatch(appSource, /scriptGrade|setScriptGrade|MbhScriptGrade|formatScriptGrade|normalizeScriptGrade/);
  assert.doesNotMatch(stylesSource, /grade-toggle|grade-btn|message-grade/);
});

test("chat composer replaces generation buttons with explicit skill learning mode", () => {
  const sendSource = extractFunction("sendMessage");

  assert.match(indexSource, /data-compose-mode="script-hard-issue-review"[\s\S]*剧本评审/);
  assert.match(indexSource, /data-compose-mode="script-manju-adaptation-analysis"[\s\S]*漫剧适配/);
  assert.match(indexSource, /data-compose-mode="learning"[\s\S]*技能学习/);
  assert.doesNotMatch(indexSource, /data-compose-mode="script"/);
  assert.doesNotMatch(indexSource, /data-compose-mode="storyboard"/);
  assert.match(appSource, /const chatSkillComposeModes = new Set/);
  assert.match(appSource, /function selectedChatSkillRouteId/);
  assert.match(sendSource, /const learningMode = state\.composeMode === "learning"/);
  assert.match(sendSource, /const forcedSkillRouteId = selectedChatSkillRouteId\(\)/);
  assert.match(sendSource, /intent: learningMode \? "learning" : forcedSkillRouteId \? "script_analysis" : ""/);
  assert.match(sendSource, /learningMode,/);
  assert.match(sendSource, /skillRouteId: forcedSkillRouteId/);
  assert.match(sendSource, /workflowIntent: learningMode \|\| forcedSkillRouteId \? "" : state\.composeMode \|\| ""/);
  assert.match(sendSource, /正在保存到本地学习资料库/);
  assert.match(sendSource, /正在调用\$\{composeModeLabel\(state\.composeMode\)\}技能/);
});

test("the no-project group is fixed and cannot be renamed", () => {
  const renderListSource = extractFunction("renderConversationList");
  const startRenameSource = extractFunction("startProjectRename");
  const commitRenameSource = extractFunction("commitProjectRename");

  assert.match(renderListSource, /group\.id !== "no-project"[\s\S]*project-rename/);
  assert.match(startRenameSource, /if \(projectId === "no-project"\) return/);
  assert.match(commitRenameSource, /if \(group\?\.id === "no-project"\) return/);
});

test("trash modal separates chat and canvas recovery by active mode", () => {
  const openTrashSource = extractFunction("openTrash");
  const renderTrashSource = extractFunction("renderTrashPanel");

  assert.match(appSource, /trashMode/);
  assert.match(appSource, /function currentTrashMode/);
  assert.match(appSource, /function renderConversationTrashItems/);
  assert.match(appSource, /function renderCanvasTrashItems/);
  assert.match(openTrashSource, /state\.trashMode = currentTrashMode\(\)/);
  assert.match(renderTrashSource, /const mode = state\.trashMode \|\| currentTrashMode\(\)/);
  assert.match(renderTrashSource, /mode === "canvas"[\s\S]*renderCanvasTrashItems/);
  assert.match(renderTrashSource, /renderConversationTrashItems/);
  assert.match(renderTrashSource, /trashTitle/);
  assert.match(indexSource, /id="trashTitle"/);
});

test("canvas archive markdown and storyboard issue controls are wired", () => {
  const archiveViewSource = extractFunction("openArchiveView");
  const archivePageSource = extractFunction("renderCanvasArchivePage");
  const headerStateSource = extractFunction("renderCanvasHeaderState");
  const nodeMenuSource = extractFunction("openCanvasContextMenu");
  const boardMenuSource = extractFunction("openCanvasBoardContextMenu");

  assert.match(indexSource, /archiveCurrentCanvas/);
  assert.match(indexSource, /deleteCurrentCanvas/);
  assert.match(indexSource, /canvasArchivePage/);
  assert.match(indexSource, /canvasArchiveList/);
  assert.match(indexSource, /canvasArchiveBlockedModal/);
  assert.match(indexSource, /canvasNodeMarkdownToolbar/);
  assert.match(indexSource, /storyboardIssueModal/);
  assert.match(indexSource, /id="autoFixStoryboardIssues"/);
  assert.match(indexSource, /id="acknowledgeStoryboardIssues"/);
  assert.match(indexSource, /id="adoptStoryboardIssues"/);
  assert.match(appSource, /function archiveCurrentCanvas/);
  assert.match(appSource, /function runCanvasArchiveCheck/);
  assert.match(appSource, /function formatCanvasArchiveIssueSummary/);
  assert.match(appSource, /function openCanvasArchiveBlockedModal/);
  assert.match(appSource, /function closeCanvasArchiveBlockedModal/);
  assert.match(appSource, /canvasArchiveIssueMessages/);
  assert.match(appSource, /function openCanvasArchivePage/);
  assert.match(appSource, /function renderCanvasArchivePage/);
  assert.match(appSource, /function duplicateArchivedCanvas/);
  assert.match(appSource, /function renderCanvasHeaderState/);
  assert.match(archivePageSource, /canvas-archive-title-button/);
  assert.match(archivePageSource, /viewArchivedCanvas\(item\.id\)/);
  assert.match(archivePageSource, /item\.edgeCount/);
  assert.match(appSource, /async function loadCanvas\(id\)[\s\S]*renderCanvasHeaderState/);
  assert.match(headerStateSource, /只读归档画布/);
  assert.match(headerStateSource, /button\.hidden = canvasIsArchived\(canvas\)/);
  assert.match(nodeMenuSource, /if \(!canvasIsArchived\(\)\)/);
  assert.match(boardMenuSource, /归档画布为只读，不能新增节点/);
  assert.match(archiveViewSource, /openCanvasArchivePage/);
  assert.doesNotMatch(archiveViewSource, /openWorkbench/);
  assert.match(appSource, /function openCanvasItemContextMenu/);
  assert.match(appSource, /function applyMarkdownFormat/);
  assert.match(appSource, /function openStoryboardIssueDetail/);
  assert.match(appSource, /const storyboardIssueAutoFixPrompt = \[/);
  assert.match(appSource, /请逐条处理问题清单中已经识别出的全部分镜问题/);
  assert.match(appSource, /不能只做换行、排版或解释/);
  assert.match(appSource, /function autoFixStoryboardIssues/);
  assert.match(appSource, /createRevisionCanvasNode\(sourceNodeId, \{[\s\S]*initialPrompt: storyboardIssueAutoFixPrompt/);
  assert.match(appSource, /submitCanvasRevisionChat\(revisionNode\.id, storyboardIssueAutoFixPrompt\)/);
  assert.match(appSource, /function resolveStoryboardIssues/);
  assert.match(appSource, /function storyboardContentFingerprint/);
  assert.match(appSource, /validationResolution/);
  assert.match(appSource, /function applyCanvasArchiveValidation/);
  assert.match(appSource, /function renderStoryboardIssueText/);
  assert.match(appSource, /storyboard-issue-line-number/);
  assert.match(appSource, /storyboard-issue-line-highlight/);
  assert.match(appSource, /\/api\/canvas\/archive/);
  assert.match(appSource, /\/api\/canvas\/archive-check/);
  assert.match(appSource, /\/api\/canvas\/delete/);
  assert.match(appSource, /\/api\/canvas\/restore/);
  assert.match(appSource, /function restoreCanvasFromTrash/);
  assert.match(appSource, /archive-canvas/);
  assert.match(appSource, /formatCanvasArchiveIssueSummary\(data\.archiveCheck\)/);
  assert.match(appSource, /openCanvasArchiveBlockedModal\(data\.archiveCheck/);
  assert.match(appSource, /canvasStatusLockUntil: 0/);
  assert.match(appSource, /function canvasStatus\(text, options = \{\}\)/);
  assert.match(appSource, /const now = Date\.now\(\)/);
  assert.match(appSource, /now < state\.canvasStatusLockUntil/);
  assert.match(appSource, /const summary = formatCanvasArchiveIssueSummary\(data\.archiveCheck\)/);
  assert.match(appSource, /markCanvasArchiveIssues\(data\.archiveCheck\)[\s\S]*canvasStatus\(summary, \{ lockMs: 6000 \}\)[\s\S]*openCanvasArchiveBlockedModal\(data\.archiveCheck/);
  assert.match(appSource, /applyCanvasArchiveValidation\(data\.archiveCheck\)/);
  assert.match(appSource, /\$\("acknowledgeStoryboardIssues"\)\.addEventListener\("click", \(\) => resolveStoryboardIssues\("acknowledge"\)\)/);
  assert.match(appSource, /\$\("adoptStoryboardIssues"\)\.addEventListener\("click", \(\) => resolveStoryboardIssues\("adopt"\)\)/);
  assert.match(appSource, /\$\("autoFixStoryboardIssues"\)\.addEventListener\("click", autoFixStoryboardIssues\)/);
  assert.match(appSource, /catch \(error\)[\s\S]*canvasStatus\(message, \{ lockMs: 6000 \}\)[\s\S]*openCanvasArchiveBlockedModal\(\{\}, \{ message/);
  assert.match(appSource, /if \(action === "archive-canvas"\)[\s\S]*archiveCurrentCanvas\(canvasId\)/);
  assert.match(stylesSource, /\.canvas-archive-page/);
  assert.match(stylesSource, /\.canvas-archive-list/);
  assert.match(stylesSource, /\.canvas-archive-title-button/);
  assert.match(stylesSource, /\.canvas-archive-blocked-modal/);
  assert.match(stylesSource, /@keyframes archiveBlockedPulse/);
  assert.match(stylesSource, /\.canvas-status\.show/);
  assert.match(stylesSource, /\.canvas-node-issue-badge/);
  assert.match(stylesSource, /\.storyboard-issue-line-number/);
  assert.match(stylesSource, /\.storyboard-issue-line-highlight/);
  assert.match(stylesSource, /\.storyboard-issue-actions/);
  assert.match(stylesSource, /\.storyboard-issue-actions \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(stylesSource, /\.markdown-toolbar/);
  assert.match(stylesSource, /\.storyboard-issue-modal/);
  assert.match(stylesSource, /\.context-menu,\s*[\r\n]+\.canvas-context-menu/);
  assert.match(stylesSource, /\.context-menu\.open,\s*[\r\n]+\.canvas-context-menu\.open/);
  assert.match(stylesSource, /\.context-menu button,\s*[\r\n]+\.canvas-context-menu button/);
  assert.doesNotMatch(stylesSource, /\.canvas-context-menu \{[\s\S]*background: color-mix\(in srgb, var\(--panel\) 94%, #fff\)/);
});

test("canvas node body edits inline and exposes fullscreen from markdown toolbar", () => {
  const renderNodeSource = extractFunction("renderCanvasNode");
  const closeNodeModalSource = extractFunction("closeCanvasNodeModal");

  assert.match(appSource, /editingCanvasBodyNodeId/);
  assert.match(appSource, /function startCanvasNodeBodyEdit/);
  assert.match(appSource, /function renderCanvasInlineMarkdownToolbar/);
  assert.match(appSource, /function markdownToolbarBackgroundButton/);
  assert.match(appSource, /function canvasNodeBackgroundColor/);
  assert.match(appSource, /function markdownToolbarIcon/);
  assert.match(appSource, /function markdownToolbarSeparator/);
  assert.match(appSource, /data-node-background-color/);
  assert.match(appSource, /function openCanvasNodeFullscreenEditor/);
  assert.match(appSource, /function setMarkdownEditorValue/);
  assert.match(appSource, /function markdownEditorValue/);
  assert.match(appSource, /function applyMarkdownEditorFormat/);
  assert.match(appSource, /function applyCanvasNodeBackground/);
  assert.match(appSource, /function readableTextColorForBackground/);
  assert.match(appSource, /function colorContrastRatio/);
  assert.match(appSource, /function scheduleActiveCanvasNodeAutosave/);
  assert.match(appSource, /function flushActiveCanvasNodeAutosave/);
  assert.match(renderNodeSource, /const editingBody/);
  assert.match(renderNodeSource, /document\.createElement\("div"\)/);
  assert.match(renderNodeSource, /body\.contentEditable = editingBody \? "true" : "false"/);
  assert.doesNotMatch(renderNodeSource, /document\.createElement\("textarea"\)/);
  assert.doesNotMatch(renderNodeSource, /body\.readOnly = !editingBody/);
  assert.match(renderNodeSource, /body\.addEventListener\("pointerdown"[\s\S]*selectCanvasNode\(node\.id\)[\s\S]*startCanvasNodeDrag/);
  assert.match(renderNodeSource, /body\.addEventListener\("dblclick"[\s\S]*focusCanvasNodeToViewport\(node\.id\)/);
  assert.match(renderNodeSource, /body\.addEventListener\("dblclick"[\s\S]*startCanvasNodeBodyEdit\(node\.id\)/);
  assert.match(appSource, /renderMarkdownToolbarContent/);
  assert.match(appSource, /markdownToolbarButton\("", \{ action: "paragraph", icon: "paragraph"/);
  assert.match(appSource, /markdownToolbarButton\("", \{ prefix: "- ", icon: "unorderedList"/);
  assert.match(appSource, /markdownToolbarButton\("", \{ action: "ordered-list", icon: "orderedList"/);
  assert.match(appSource, /markdownToolbarButton\("", \{ action: "horizontal-rule", icon: "horizontalRule"/);
  assert.match(appSource, /markdownToolbarButton\("", \{ action: "copy", icon: "copy"/);
  assert.match(appSource, /markdownToolbarButton\("", \{ action: "fullscreen", icon: "fullscreen"/);
  assert.match(appSource, /markdown-toolbar-bg-group\$\{currentBackground \? " has-color" : ""\}/);
  assert.match(appSource, /--toolbar-bg-current/);
  assert.match(appSource, /toolbar-bg-icon/);
  assert.match(appSource, /#ff6b6b/);
  assert.match(appSource, /#ff9f22/);
  assert.match(appSource, /#ffcf24/);
  assert.match(appSource, /#2bd36a/);
  assert.match(appSource, /#18d0d0/);
  assert.match(appSource, /#1aa7e8/);
  assert.match(appSource, /#c5a3ff/);
  assert.match(appSource, /#ff7cff/);
  assert.match(appSource, /#8a8a8a/);
  assert.doesNotMatch(appSource, /markdownToolbarButton\("•"/);
  assert.doesNotMatch(appSource, /markdownToolbarButton\("1\."/);
  assert.doesNotMatch(appSource, /markdownToolbarButton\("复制"/);
  assert.doesNotMatch(appSource, /markdownToolbarButton\("全屏"/);
  assert.doesNotMatch(appSource, /markdownToolbarButton\(">",/);
  assert.match(appSource, /if \(action === "fullscreen"\)[\s\S]*openCanvasNodeFullscreenEditor/);
  assert.match(appSource, /if \(action === "copy"\)[\s\S]*copyText\(markdownEditorValue\(editor\)/);
  assert.match(appSource, /button\.dataset\.nodeBackgroundColor !== undefined[\s\S]*applyCanvasNodeBackground/);
  assert.match(appSource, /item\.style\.setProperty\("--canvas-node-readable-ink", readableTextColorForBackground\(nodeBackgroundColor\)\)/);
  assert.match(appSource, /applyMarkdownEditorFormat\(editor/);
  assert.doesNotMatch(appSource, /markdownToolbarButton\("完成"/);
  assert.doesNotMatch(appSource, /action === "done"/);
  assert.doesNotMatch(indexSource, /<textarea id="canvasNodeContent"/);
  assert.match(indexSource, /id="canvasNodeContent"[\s\S]*contenteditable="true"/);
  assert.doesNotMatch(indexSource, /id="saveCanvasNode"/);
  assert.doesNotMatch(appSource, /saveCanvasNode"\)\.addEventListener/);
  assert.match(appSource, /\$\("canvasNodeTitle"\)\.addEventListener\("input", scheduleActiveCanvasNodeAutosave\)/);
  assert.match(appSource, /\$\("canvasNodeContent"\)\.addEventListener\("input", scheduleActiveCanvasNodeAutosave\)/);
  assert.match(closeNodeModalSource, /flushActiveCanvasNodeAutosave/);
  assert.match(appSource, /if \(nodeId === state\.activeCanvasNodeId\) await flushActiveCanvasNodeAutosave\(\)/);
  assert.match(stylesSource, /\.canvas-node-inline-markdown-toolbar/);
  assert.match(stylesSource, /\.markdown-floating-toolbar/);
  assert.match(stylesSource, /\.markdown-toolbar-separator/);
  assert.match(stylesSource, /\.markdown-toolbar-button svg/);
  assert.match(stylesSource, /\.markdown-bg-palette/);
  assert.match(stylesSource, /\.markdown-bg-swatch/);
  assert.match(stylesSource, /\.markdown-toolbar-bg-group/);
  assert.match(stylesSource, /\.toolbar-bg-icon-ring/);
  assert.match(stylesSource, /\.toolbar-bg-icon-slash/);
  assert.match(stylesSource, /\.markdown-toolbar-bg-group\.has-color \.toolbar-bg-icon-ring/);
  assert.match(stylesSource, /\.markdown-toolbar-bg-group\.has-color \.toolbar-bg-icon-slash/);
  assert.match(stylesSource, /grid-template-columns: repeat\(5, 30px\)/);
  assert.match(stylesSource, /border: 2px solid #ff5c74/);
  assert.match(stylesSource, /\.markdown-toolbar-bg-group\.open \.markdown-bg-palette/);
  assert.doesNotMatch(stylesSource, /\.markdown-toolbar-bg-group:hover \.markdown-bg-palette/);
  assert.doesNotMatch(stylesSource, /\.markdown-toolbar-bg-group:focus-within \.markdown-bg-palette/);
  assert.match(stylesSource, /\.canvas-node-inline-markdown-toolbar \{[\s\S]*left: 50%;[\s\S]*transform: translateX\(-50%\)/);
  assert.match(stylesSource, /\.canvas-node-inline-markdown-toolbar::after \{[\s\S]*left: 50%;[\s\S]*transform: translateX\(-50%\) rotate\(45deg\)/);
  assert.match(stylesSource, /--canvas-node-custom-bg/);
  assert.match(stylesSource, /--canvas-node-readable-ink: var\(--ink\)/);
  assert.match(stylesSource, /\.canvas-node-body \{[\s\S]*color: var\(--canvas-node-readable-ink\)/);
  assert.match(stylesSource, /\.canvas-node-body\.markdown-body[\s\S]*color: var\(--canvas-node-readable-ink\)/);
  assert.match(stylesSource, /\.canvas-node\.editing-body/);
  assert.match(stylesSource, /\.canvas-node-content[\s\S]*scrollbar-color: var\(--canvas-node-scrollbar-thumb\) var\(--canvas-node-scrollbar-track\)/);
  assert.match(stylesSource, /\.canvas-node-content::-webkit-scrollbar-thumb/);
});
