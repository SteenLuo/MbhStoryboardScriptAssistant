const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const clientSource = fs.readFileSync(path.join(root, "canvas-client", "main.jsx"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const clientStyles = fs.readFileSync(path.join(root, "canvas-client", "styles.css"), "utf8");
const canvasV2Styles = fs.readFileSync(path.join(__dirname, "assets", "canvas-v2.css"), "utf8");
const canvasV2Source = fs.readFileSync(path.join(__dirname, "assets", "canvas-v2.js"), "utf8");

test("React Flow canvas uses a local bundle with viewport culling", () => {
  assert.match(clientSource, /from "@xyflow\/react"/);
  assert.match(clientSource, /onlyRenderVisibleElements/);
  assert.match(clientSource, /viewportZoom < 0\.45 \? \[\] : edges/);
  assert.match(clientSource, /panOnDrag/);
  assert.match(clientSource, /panOnDrag=\{\[1, 2\]\}/);
  assert.match(clientSource, /selectionOnDrag/);
  assert.match(clientSource, /type: "bezier"/);
  assert.match(clientSource, /selectionKeyCode="Shift"/);
  assert.match(clientSource, /NodeResizer/);
  assert.match(clientSource, /onNodeDragStop/);
  assert.match(indexSource, /\/assets\/canvas-flow\.js/);
  assert.match(indexSource, /\/assets\/canvas-flow\.css/);
  assert.doesNotMatch(indexSource, /https?:\/\/.*(react|flow)/i);
  assert.match(clientStyles, /react-flow__node\.selected \.canvas-node-plus/);
  assert.doesNotMatch(clientStyles, /canvas-node-plus,[\s\S]*canvas-node-hover-bridge,[\s\S]*display: none/);
  assert.match(canvasV2Styles, /canvas-group-bar \{/);
  assert.doesNotMatch(canvasV2Styles, /canvas-top, body\.canvas-v2-mode #canvasGroupBar/);
  assert.match(canvasV2Styles, /body\.canvas-v2-mode \.sessions \{ display: block;/);
  assert.match(canvasV2Styles, /--v2-surface: #171717/);
  assert.match(canvasV2Styles, /sessions \.session-list/);
  assert.match(appSource, /window\.MbhCanvasApp = \{[\s\S]*setAppMode,/);
  assert.match(canvasV2Source, /\$\("canvasStage"\)\.hidden = true/);
  assert.match(canvasV2Source, /\$\("canvasStage"\)\.hidden = false/);
  assert.match(canvasV2Source, /querySelector\("\.canvas-view-tools"\)\.hidden = true/);
  assert.match(canvasV2Source, /querySelector\("\.canvas-view-tools"\)\.hidden = false/);
});

test("React Flow bridge persists a drag only after its stop event", () => {
  const start = clientSource.indexOf("const onNodeDragStart");
  const stop = clientSource.indexOf("const onNodeDragStop");
  assert.ok(start > -1);
  assert.ok(stop > start);
  const stopBody = clientSource.slice(stop, clientSource.indexOf("const onNodesChange", stop));
  assert.match(stopBody, /bridge\.commitNodePosition/);
  assert.match(appSource, /async commitNodePosition\(nodeId, position\)/);
  assert.match(appSource, /await saveCurrentCanvas\(\)/);
  assert.match(appSource, /function renderReactFlowCanvas\(\)/);
});

test("canvas performance probe stores bounded real interaction samples", () => {
  assert.match(clientSource, /function createFrameProbe\(report\)/);
  assert.match(clientSource, /requestAnimationFrame\(tick\)/);
  assert.match(clientSource, /p95FrameMs/);
  assert.match(clientSource, /maxFrameMs/);
  assert.match(appSource, /reportPerformance\(sample\)/);
  assert.match(appSource, /samples\.slice\(-20\)/);
});
