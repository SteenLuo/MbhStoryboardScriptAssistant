const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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

function evaluateAppFunctions(names) {
  const sandbox = {};
  const source = `${names.map(extractFunction).join("\n")}\n${names.map((name) => `globalThis.${name} = ${name};`).join("\n")}`;
  vm.runInNewContext(source, sandbox);
  return sandbox;
}

function evaluateLearningRecordRenderer() {
  const sandbox = {
    document: {
      createElement(tagName) {
        return {
          tagName,
          className: "",
          dataset: {},
          innerHTML: "",
          classList: {
            toggle() {},
          },
        };
      },
    },
    state: {
      viewedLearningFailureIds: new Set(),
    },
  };
  const names = [
    "escapeHtml",
    "safeClassName",
    "normalizeLearningDisplayStatus",
    "formatLearningStatus",
    "learningRecordLine",
    "hasChineseText",
    "isInternalLearningCode",
    "isShortEnglishLearningFailureValue",
    "isTechnicalLearningFailureValue",
    "readableLearningFailureStage",
    "readableLearningFailureValue",
    "renderLearningFailureSummary",
    "renderLearningAdvancedDetails",
    "learningAdvancedPayload",
    "learningRecordKeyHash",
    "learningRecordKey",
    "isFailedLearningRecord",
    "renderLearningRecordItem",
  ];
  const source = `${names.map(extractFunction).join("\n")}\nglobalThis.renderLearningRecordItem = renderLearningRecordItem;`;
  vm.runInNewContext(source, sandbox);
  return sandbox.renderLearningRecordItem;
}

function evaluateSkillRenderer() {
  const sandbox = {
    document: {
      createElement(tagName) {
        return {
          tagName,
          className: "",
          dataset: {},
          innerHTML: "",
        };
      },
    },
  };
  const names = [
    "escapeHtml",
    "formatSkillCategory",
    "formatSkillDraftStatus",
    "formatSkillDraftConfirmationStatus",
    "renderSkillLibraryItem",
  ];
  const source = `${names.map(extractFunction).join("\n")}\nglobalThis.renderSkillLibraryItem = renderSkillLibraryItem;`;
  vm.runInNewContext(source, sandbox);
  return sandbox.renderSkillLibraryItem;
}

function learningRecordDefaultHtml(item) {
  return item.innerHTML.split('<details class="learning-record-advanced">')[0];
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
  const learningPageSource = indexSource.slice(
    indexSource.indexOf('<aside id="learningPage"'),
    indexSource.indexOf('<aside id="canvasArchivePage"'),
  );
  const nonLearningPageSource = `${indexSource.slice(0, indexSource.indexOf('<aside id="learningPage"'))}${indexSource.slice(indexSource.indexOf('<aside id="canvasArchivePage"'))}`;

  assert.match(indexSource, /openLearningLibrary/);
  assert.match(indexSource, /id="learningPage"/);
  assert.match(indexSource, /id="closeLearningPage"/);
  assert.doesNotMatch(indexSource, /settingsTabLearning/);
  assert.doesNotMatch(indexSource, /settingsPanelLearning/);
  assert.doesNotMatch(indexSource, /M0-M6|刷新学习闭环|completenessList|refreshLearning/);
  assert.doesNotMatch(indexSource, /learningOverview|learningAppliedCount|learningFailedCount/);
  assert.match(indexSource, /learningRecordsTabCount/);
  assert.doesNotMatch(indexSource, /learningRulesTabCount/);
  assert.match(indexSource, /learningSkillsTabCount/);
  assert.match(indexSource, /learningRecordHelp/);
  assert.match(indexSource, /学习记录说明/);
  assert.match(learningPageSource, /系统会把技能学习、满意样例、纠错和归档证据记到这里。已保存不等于影响生成；生成只读取正式技能，不读取普通学习记录。学错了可以点“带引用去纠正”回到对话处理。/);
  assert.match(learningPageSource, /已保存/);
  assert.match(learningPageSource, /已影响生成/);
  assert.match(learningPageSource, /普通学习记录会先作为学习资料保存；只有写入正式技能后，下一次对应生成才会读取/);
  assert.doesNotMatch(learningPageSource, /沉淀规则/);
  assert.doesNotMatch(indexSource, /data-learning-library-tab="rules"/);
  assert.match(learningPageSource, /待确认/);
  assert.match(learningPageSource, /学错了怎么改/);
  assert.doesNotMatch(learningPageSource, /已生效/);
  assert.match(indexSource, /data-learning-library-tab-group="records"[\s\S]*data-learning-library-tab="records"[\s\S]*learningRecordHelp[\s\S]*学习记录状态[\s\S]*已保存[\s\S]*已影响生成[\s\S]*待确认[\s\S]*已被覆盖[\s\S]*失败[\s\S]*<\/div>/);
  assert.match(indexSource, /learningSkillHelp/);
  assert.match(indexSource, /技能库说明/);
  assert.match(indexSource, /当前可调用的正式技能/);
  assert.match(indexSource, /普通学习记录和技能草案不会自动影响生成/);
  assert.match(indexSource, /这里不做复杂规则编辑/);
  assert.match(indexSource, /data-learning-library-tab-group="skills"[\s\S]*data-learning-library-tab="skills"[\s\S]*learningSkillHelp[\s\S]*<\/div>/);
  assert.match(indexSource, /<\/button>\s*<span class="learning-help-wrap">[\s\S]*learningSkillHelp/);
  assert.match(indexSource, /learningFailureJump/);
  assert.match(indexSource, /learning-guide/);
  assert.match(indexSource, /新手说明/);
  assert.match(indexSource, /内部排查信息默认折叠/);
  assert.doesNotMatch(learningPageSource, /topicKey|L0\/L1\/L2|skill-index|token|失败堆栈/);
  assert.doesNotMatch(nonLearningPageSource, /学习记录状态|学错了怎么改|已影响生成|带引用去纠正/);
  assert.doesNotMatch(indexSource, /class="learning-status-guide"/);
  assert.match(indexSource, /学习记录状态/);
  assert.doesNotMatch(indexSource, /<b>已记录<\/b>/);
  assert.doesNotMatch(indexSource, /<b>已生效<\/b>/);
  assert.match(indexSource, /失败/);
  assert.match(indexSource, /learningLibraryRecords/);
  assert.doesNotMatch(indexSource, /learningLibraryRules/);
  assert.match(indexSource, /learningLibrarySkills/);
  assert.match(indexSource, /learningLibraryPanelSummary/);
  assert.match(appSource, /learningLibrary/);
  assert.match(appSource, /function openLearningPage/);
  assert.match(appSource, /function closeLearningPage/);
  assert.match(appSource, /openNotificationTarget[\s\S]*openLearningPage/);
  assert.match(appSource, /function loadLearningPanel/);
  assert.match(appSource, /function renderLearningLibrary/);
  assert.match(appSource, /function renderLearningPanelSummary/);
  assert.doesNotMatch(appSource, /!records\.length && !rules\.length/);
  assert.match(appSource, /function renderLearningTabCounts/);
  assert.match(appSource, /function jumpToNextLearningFailure/);
  assert.doesNotMatch(appSource, /function setCurrentRuleStatus/);
  assert.doesNotMatch(appSource, /function formatCurrentRuleStatus/);
  assert.doesNotMatch(appSource, /\/api\/learning-rules\/status/);
  assert.doesNotMatch(appSource, /data-rule-status-action/);
  assert.doesNotMatch(appSource, /rule\.status === "active" \? "disabled" : "active"/);
  assert.match(appSource, /viewedLearningFailureIds/);
  assert.match(appSource, /function renderSkillLibraryItem/);
  assert.match(appSource, /暂无技能草案，正式技能仍可用/);
  assert.match(appSource, /draftStatus/);
  assert.match(appSource, /humanConfirmationStatus/);
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
  assert.match(learningHelpWrapStyles, /position: relative/);
  assert.match(learningHelpPopoverStyles, /left: 0/);
  assert.match(learningHelpPopoverStyles, /z-index: 20/);
  assert.match(learningHelpPopoverStyles, /text-align: left/);
  assert.match(learningHelpPopoverStyles, /white-space: normal/);
  assert.match(stylesSource, /\[data-learning-library-tab-group="skills"\] \.learning-help-popover \{[\s\S]*right: 0;[\s\S]*left: auto/);
  assert.match(stylesSource, /\.learning-failure-jump/);
  assert.match(stylesSource, /\.learning-library-item\.focus/);
  assert.match(stylesSource, /\.learning-rule-actions/);
  assert.match(stylesSource, /\.learning-library-item\.status-disabled/);
  assert.match(stylesSource, /\.learning-skill-detail/);
  assert.match(stylesSource, /\.learning-record-advanced/);
  assert.match(stylesSource, /\.learning-record-failure/);
  assert.match(stylesSource, /\.sidebar-icon-stack/);
});

test("skill library renderer shows saved non-generation draft cards and draft empty state", () => {
  const renderSkillLibrarySource = extractFunction("renderLearningLibrary");
  const renderSkillItemSource = extractFunction("renderSkillLibraryItem");
  const renderSkillLibraryItem = evaluateSkillRenderer();
  const item = renderSkillLibraryItem({
    recordType: "skill-draft",
    recordId: "skill-draft:draft-a",
    name: "技能草案",
    skillId: "storyboard-generate",
    skillKind: "storyboard",
    draftStatus: "saved",
    humanConfirmationStatus: "pending",
    affectsGeneration: false,
    generationImpactText: "暂不影响生成；等待人工确认后才可能进入正式技能。",
    diffSummary: "Draft only: no official skill files or routes are changed.",
  });

  assert.match(renderSkillLibrarySource, /暂无技能草案，正式技能仍可用/);
  assert.match(renderSkillItemSource, /recordType === "skill-draft"/);
  assert.match(renderSkillItemSource, /draftStatus/);
  assert.match(renderSkillItemSource, /humanConfirmationStatus/);
  assert.match(item.innerHTML, /技能草案/);
  assert.match(item.innerHTML, /已保存/);
  assert.match(item.innerHTML, /暂不影响生成/);
  assert.match(item.innerHTML, /等待人工确认/);
  assert.match(item.innerHTML, /diff 摘要/);
});

test("learning record renderer keeps novice fields in the default card", () => {
  const renderRecordSource = extractFunction("renderLearningRecordItem");
  const normalizeDisplayStatusSource = extractFunction("normalizeLearningDisplayStatus");
  const advancedSource = extractFunction("renderLearningAdvancedDetails");
  const advancedPayloadSource = extractFunction("learningAdvancedPayload");
  const failureSource = extractFunction("renderLearningFailureSummary");
  const failureStageSource = extractFunction("readableLearningFailureStage");
  const failureValueSource = extractFunction("readableLearningFailureValue");
  const shortEnglishFailureSource = extractFunction("isShortEnglishLearningFailureValue");
  const keySource = extractFunction("learningRecordKey");
  const failedSource = extractFunction("isFailedLearningRecord");

  assert.match(renderRecordSource, /record\.learnedText/);
  assert.match(renderRecordSource, /normalizeLearningDisplayStatus\(record\.displayStatus\s*\|\|\s*record\.status,\s*"待确认"\)/);
  assert.doesNotMatch(renderRecordSource, /record\.displayStatus\s*\|\|\s*"待确认"/);
  assert.match(normalizeDisplayStatusSource, /"已生效"\s*:\s*"已保存"/);
  assert.match(normalizeDisplayStatusSource, /active\s*:\s*"已保存"/);
  assert.match(normalizeDisplayStatusSource, /queued\s*:\s*"待确认"/);
  assert.match(normalizeDisplayStatusSource, /failed_retrying\s*:\s*"待确认"/);
  assert.match(renderRecordSource, /record\.actionLabel/);
  assert.match(renderRecordSource, /record\.sourceText/);
  assert.match(renderRecordSource, /record\.usedWhereText/);
  assert.match(renderRecordSource, /record\.generationImpactText/);
  assert.match(renderRecordSource, /record\.generationProof\?\.claimText/);
  assert.match(renderRecordSource, /record\.nextStepText/);
  assert.match(renderRecordSource, /record\.correctionAction/);
  assert.match(renderRecordSource, /data-learning-correction/);
  assert.match(renderRecordSource, /data-learning-correction-action/);
  assert.match(renderRecordSource, /带引用去纠正/);
  assert.match(renderRecordSource, /override/);
  assert.match(renderRecordSource, /temporary/);
  assert.match(renderRecordSource, /disable/);
  assert.match(renderRecordSource, /narrow/);
  assert.match(renderRecordSource, /disabledReason/);
  assert.match(renderRecordSource, /disabled/);
  assert.match(renderRecordSource, /renderLearningFailureSummary\(record\)/);
  assert.match(renderRecordSource, /renderLearningAdvancedDetails\(record\)/);
  assert.match(advancedSource, /<summary>高级详情<\/summary>/);
  assert.match(advancedSource, /<details class="learning-record-advanced">/);
  assert.match(advancedPayloadSource, /record\.advanced/);
  assert.match(advancedPayloadSource, /record\.topicKey/);
  assert.match(advancedPayloadSource, /record\.tokenUsage/);
  assert.match(failureSource, /失败阶段/);
  assert.match(failureSource, /原因/);
  assert.match(failureSource, /是否影响生成/);
  assert.match(failureSource, /下一步/);
  assert.match(failureSource, /readableLearningFailureStage/);
  assert.match(failureSource, /record\.failureReason[\s\S]*record\.reason[\s\S]*record\.error\?\.userMessage[\s\S]*record\.advanced\?\.error\?\.userMessage[\s\S]*record\.error\?\.message[\s\S]*record\.advanced\?\.error\?\.message/);
  assert.doesNotMatch(failureSource, /internalReason/);
  assert.doesNotMatch(failureSource, /readableLearningFailureValue\([\s\S]*internalReason/);
  assert.match(failureStageSource, /write-learning-evidence/);
  assert.match(failureStageSource, /publish-current-ruleset/);
  assert.match(failureStageSource, /hard-rule-validation/);
  assert.match(failureStageSource, /learning-correction/);
  assert.match(failureStageSource, /sample-evaluation/);
  assert.match(failureStageSource, /学习流程处理/);
  assert.match(failureValueSource, /学习流程处理失败，详情可在高级详情中查看。/);
  assert.match(failureValueSource, /isTechnicalLearningFailureValue/);
  assert.match(failureValueSource, /Bearer/);
  assert.match(failureValueSource, /api\[_-\]\?key\|token\|secret/);
  assert.match(failureValueSource, /hasChineseText/);
  assert.match(failureValueSource, /isShortEnglishLearningFailureValue/);
  assert.match(shortEnglishFailureSource, /disk full/);
  assert.match(keySource, /record\?\.recordId/);
  assert.match(keySource, /learning-record-/);
  assert.match(keySource, /learningRecordKeyHash/);
  assert.match(failedSource, /record\?\.displayStatus\s*\|\|\s*record\?\.status/);
  assert.doesNotMatch(renderRecordSource, /record\.summary \|\| record\.rawTrigger \|\| record\.topicKey/);
  assert.doesNotMatch(renderRecordSource, /record\.advanced\?\.topicKey/);
  assert.doesNotMatch(renderRecordSource, /record\.tokenUsage/);
  assert.doesNotMatch(renderRecordSource, /stack/);
  assert.doesNotMatch(failureSource, /const stage = readableLearningFailureValue/);
  assert.doesNotMatch(failureSource, /record\.affectsGeneration/);
  assert.doesNotMatch(failureStageSource, /:\s*text/);
  assert.doesNotMatch(failureValueSource, /return sanitized \|\| fallback/);
  assert.doesNotMatch(keySource, /record\?\.summary/);
  assert.doesNotMatch(keySource, /record\?\.rawTrigger/);
  assert.doesNotMatch(keySource, /record\?\.advanced\?\.topicKey/);
  assert.doesNotMatch(failureSource, /record\.advanced\?\.error\?\.message,[\s\S]*未返回明确原因/);
  assert.doesNotMatch(failureSource, /learningRecordLine\("失败阶段",\s*record\.advanced\?\.error\?\.stage\)/);
  assert.doesNotMatch(renderRecordSource, /formatLearningSource\(record\.sourceType\)/);
  assert.doesNotMatch(renderRecordSource, /formatLearningTokenUsage\(record\.tokenUsage\)/);
  assert.doesNotMatch(appSource, /还没有沉淀学习记录。后续在对话、样例学习或画布归档中产生的结果会出现在这里。/);
  assert.match(appSource, /当前没有学习记录，也没有学习内容影响生成；当你说以后都这样、投喂样例或归档画布后，会出现在这里/);
});

test("learning visible status normalizes legacy active display text", () => {
  const { normalizeLearningDisplayStatus, formatLearningStatus } = evaluateAppFunctions([
    "normalizeLearningDisplayStatus",
    "formatLearningStatus",
  ]);

  assert.equal(normalizeLearningDisplayStatus("已生效"), "已保存");
  assert.equal(normalizeLearningDisplayStatus("active"), "已保存");
  assert.equal(normalizeLearningDisplayStatus("queued"), "待确认");
  assert.equal(normalizeLearningDisplayStatus("failed_retrying"), "待确认");
  assert.equal(normalizeLearningDisplayStatus("", "待确认"), "待确认");
  assert.equal(formatLearningStatus("已生效"), "已保存");
});

test("learning record renderer falls back to legacy status-only records", () => {
  const renderLearningRecordItem = evaluateLearningRecordRenderer();

  const item = renderLearningRecordItem({
    recordId: "legacy-status-only",
    status: "active",
    learnedText: "旧学习记录",
  });

  assert.match(item.innerHTML, /已保存/);
  assert.doesNotMatch(item.innerHTML, /待确认/);
});

test("learning record renderer surfaces readable advanced error messages in default failure summary", () => {
  const renderLearningRecordItem = evaluateLearningRecordRenderer();

  const item = renderLearningRecordItem({
    recordId: "advanced-readable-error",
    displayStatus: "失败",
    generationImpactText: "未影响生成",
    advanced: {
      error: {
        message: "学习沉淀冲突：topic-key 已存在，需要人工确认",
      },
    },
  });
  const defaultHtml = learningRecordDefaultHtml(item);

  assert.match(defaultHtml, /学习沉淀冲突/);
  assert.match(defaultHtml, /需要人工确认/);
  assert.doesNotMatch(defaultHtml, /topic-key/);
  assert.doesNotMatch(defaultHtml, /学习流程处理失败，详情可在高级详情中查看。/);
});

test("learning record renderer keeps short technical advanced error messages out of default summary", () => {
  const renderLearningRecordItem = evaluateLearningRecordRenderer();

  const item = renderLearningRecordItem({
    recordId: "advanced-technical-error",
    displayStatus: "失败",
    generationImpactText: "未影响生成",
    advanced: {
      error: {
        message: "disk full",
      },
    },
  });
  const defaultHtml = learningRecordDefaultHtml(item);

  assert.doesNotMatch(defaultHtml, /disk full/);
  assert.match(defaultHtml, /学习流程处理失败，详情可在高级详情中查看。/);
});

test("learning failure summaries sanitize mixed Chinese technical details", () => {
  const {
    readableLearningFailureStage,
    readableLearningFailureValue,
  } = evaluateAppFunctions([
    "hasChineseText",
    "isInternalLearningCode",
    "isShortEnglishLearningFailureValue",
    "isTechnicalLearningFailureValue",
    "readableLearningFailureStage",
    "readableLearningFailureValue",
  ]);

  assert.equal(readableLearningFailureStage("write-learning-evidence 写入失败", "未返回明确阶段"), "写入学习证据");
  assert.equal(
    readableLearningFailureValue("学习失败：disk full", "fallback", { hideTechnical: true }),
    "学习失败：技术细节",
  );
  assert.equal(
    readableLearningFailureValue("disk full", "fallback", { hideTechnical: true }),
    "学习流程处理失败，详情可在高级详情中查看。",
  );
  const conflictReason = readableLearningFailureValue(
    "学习沉淀冲突：topic-key 已存在，需要人工确认",
    "fallback",
    { hideTechnical: true },
  );
  assert.match(conflictReason, /学习沉淀冲突/);
  assert.match(conflictReason, /需要人工确认/);
  assert.doesNotMatch(conflictReason, /topic-key/);
});

test("learning correction button fills composer and sends pending correction payload", () => {
  const beginSource = extractFunction("beginLearningCorrection");
  const sendSource = extractFunction("sendMessage");
  const bindSource = extractFunction("bindEvents");
  const clearSource = extractFunction("clearPendingLearningCorrection");
  const setComposeSource = extractFunction("setComposeMode");
  const setAppModeSource = extractFunction("setAppMode");
  const loadConversationSource = extractFunction("loadConversation");

  assert.match(appSource, /pendingLearningCorrection:\s*null/);
  assert.match(beginSource, /correctionAction\.disabledReason/);
  assert.match(beginSource, /chatInput/);
  assert.match(beginSource, /defaultText/);
  assert.match(beginSource, /引用/);
  assert.match(beginSource, /pendingLearningCorrection/);
  assert.match(beginSource, /actionType/);
  assert.match(beginSource, /selectedAction/);
  assert.match(clearSource, /state\.pendingLearningCorrection = null/);
  assert.match(setComposeSource, /clearPendingLearningCorrection\(\)/);
  assert.match(setAppModeSource, /clearPendingLearningCorrection\(\)/);
  assert.match(loadConversationSource, /clearPendingLearningCorrection\(\)/);
  assert.match(sendSource, /state\.pendingLearningCorrection/);
  assert.match(sendSource, /\/api\/learning-corrections/);
  assert.match(sendSource, /payload:\s*pendingCorrection\.payload/);
  assert.match(sendSource, /action:\s*pendingCorrection\.action/);
  assert.match(sendSource, /message:\s*outgoingText/);
  assert.match(sendSource, /clearPendingLearningCorrection\(\)/);
  assert.match(sendSource, /state\.pendingLearningCorrection = pendingCorrection/);
  assert.match(sendSource, /input\.value = text/);
  assert.match(bindSource, /data-learning-correction/);
  assert.match(bindSource, /learningCorrectionAction/);
  assert.match(bindSource, /beginLearningCorrection/);
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
