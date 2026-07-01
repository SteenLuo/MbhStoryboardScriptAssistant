const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = appSource.indexOf("\nfunction ", start + marker.length);
  return appSource.slice(start, next === -1 ? appSource.length : next);
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

test("canvas revision nodes are created from plus menu and submitted once", () => {
  assert.match(appSource, /function isCanvasRevisionNode/);
  assert.match(appSource, /function createRevisionCanvasNode/);
  assert.match(appSource, /function renderCanvasRevisionChat/);
  assert.match(appSource, /async function submitCanvasRevisionChat/);
  assert.match(appSource, /create-revision/);
  assert.match(appSource, /\/api\/canvas\/revise-node/);
  assert.match(appSource, /chatLocked/);
  assert.match(appSource, /parentNodeId/);
  assert.match(appSource, /canvas-node-revision-chat/);
  assert.match(stylesSource, /\.canvas-node-revision-chat/);
  assert.match(stylesSource, /\.canvas-node-revision-badge/);
});

test("canvas node titles are checked for uniqueness before rename", () => {
  const commitTitleSource = extractFunction("commitCanvasNodeTitleEdit");

  assert.match(appSource, /function hasCanvasNodeTitleConflict/);
  assert.match(appSource, /function uniqueCanvasNodeTitle/);
  assert.match(commitTitleSource, /hasCanvasNodeTitleConflict/);
});

test("canvas merged version workflow has selection, grouping, and history UI", () => {
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

  assert.match(appSource, /function canvasReadableZoomForBounds/);
  assert.match(appSource, /canvasFocusReadableZoom/);
  assert.match(appSource, /canvasFocusMinReadableZoom/);
  assert.match(centerSource, /canvasReadableZoomForBounds/);
  assert.match(centerSource, /animateCanvasViewportTo/);
  assert.match(centerSource, /canvasCenteredScrollForBounds/);
});
