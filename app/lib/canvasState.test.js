const assert = require("assert");
const test = require("node:test");

const {
  CANVAS_NODE_TYPES,
  addCanvasNode,
  connectCanvasNodes,
  createCanvas,
  deleteCanvasNode,
  isMergedCanvasNode,
  normalizeCanvas,
  resizeCanvasNode,
  setCanvasMergedPrimaryVersion,
  updateCanvasNodeContent,
} = require("./canvasState");

test("createCanvas starts with a novel node and canvas metadata", () => {
  const canvas = createCanvas("Ten episode script", () => "2026-06-27T00:00:00.000Z", () => "abc123");

  assert.strictEqual(canvas.id, "canvas-abc123");
  assert.strictEqual(canvas.title, "Ten episode script");
  assert.strictEqual(canvas.nodes.length, 1);
  assert.strictEqual(canvas.nodes[0].type, "novel");
  assert.ok(CANVAS_NODE_TYPES.includes("label"));
});

test("canvas nodes can be added, connected, resized, edited, and deleted", () => {
  let canvas = createCanvas("Canvas test", () => "2026-06-27T00:00:00.000Z", () => "root01");
  canvas = addCanvasNode(canvas, { id: "script-1", type: "script", title: "Script", x: 400, y: 120 });
  canvas = addCanvasNode(canvas, { id: "mark-1", type: "label", title: "Label", x: 200, y: 240 });
  canvas = connectCanvasNodes(canvas, canvas.nodes[0].id, "script-1");
  canvas = connectCanvasNodes(canvas, "mark-1", "script-1");
  canvas = resizeCanvasNode(canvas, "script-1", { width: 420, height: 260 });
  canvas = updateCanvasNodeContent(canvas, "script-1", "Episode 1 script");

  assert.strictEqual(canvas.edges.length, 2);
  assert.strictEqual(canvas.edges[0].fromSide, "right");
  assert.strictEqual(canvas.edges[0].toSide, "left");
  assert.strictEqual(canvas.nodes.find((item) => item.id === "script-1").width, 420);
  assert.strictEqual(canvas.nodes.find((item) => item.id === "script-1").content, "Episode 1 script");

  canvas = deleteCanvasNode(canvas, "script-1");
  assert.strictEqual(canvas.nodes.some((item) => item.id === "script-1"), false);
  assert.strictEqual(canvas.edges.length, 0);
});

test("normalizeCanvas preserves saved canvas shape and repairs invalid fields", () => {
  const canvas = normalizeCanvas({
    id: "canvas-x",
    title: "",
    nodes: [
      { id: "n1", type: "unknown", x: "12", width: 10 },
      { id: "n2", type: "storyboard", height: 10 },
    ],
    edges: [{ id: "", from: "n1", to: "n2", fromSide: "left", toSide: "right" }, { from: "n1", to: "missing" }],
  });

  assert.ok(canvas.title);
  assert.strictEqual(canvas.nodes[0].type, "label");
  assert.ok(canvas.nodes[0].width >= 220);
  assert.strictEqual(canvas.edges.length, 1);
  assert.strictEqual(canvas.edges[0].from, "n1");
  assert.strictEqual(canvas.edges[0].fromSide, "left");
  assert.strictEqual(canvas.edges[0].toSide, "right");
});

test("normalizeCanvas preserves archive metadata for frozen canvases", () => {
  const canvas = normalizeCanvas({
    id: "canvas-archived",
    title: "Archived",
    archivedAt: "2026-07-01T10:00:00.000Z",
    archiveReadiness: { ok: true, issues: [] },
    nodes: [{ id: "n1", type: "novel", title: "Novel" }],
    edges: [],
  });

  assert.strictEqual(canvas.archivedAt, "2026-07-01T10:00:00.000Z");
  assert.deepStrictEqual(canvas.archiveReadiness, { ok: true, issues: [] });
});

test("normalizeCanvas preserves deletedAt for trashed canvases", () => {
  const canvas = normalizeCanvas({
    id: "canvas-deleted",
    title: "Deleted",
    deletedAt: "2026-07-01T11:00:00.000Z",
    nodes: [{ id: "n1", type: "novel", title: "Novel" }],
    edges: [],
  });

  assert.strictEqual(canvas.deletedAt, "2026-07-01T11:00:00.000Z");
});

test("normalizeCanvas keeps only one novel node", () => {
  const canvas = normalizeCanvas({
    id: "canvas-novel-limit",
    title: "Novel limit canvas",
    nodes: [
      { id: "novel-1", type: "novel", title: "Novel 1" },
      { id: "novel-2", type: "novel", title: "Novel 2" },
      { id: "script-1", type: "script", title: "Script" },
    ],
    edges: [
      { id: "kept", from: "novel-1", to: "script-1" },
      { id: "removed", from: "novel-2", to: "script-1" },
    ],
  });

  assert.deepStrictEqual(canvas.nodes.map((node) => node.id), ["novel-1", "script-1"]);
  assert.deepStrictEqual(canvas.edges.map((edge) => edge.id), ["kept"]);
});

test("addCanvasNode rejects a second novel node", () => {
  const canvas = createCanvas("Novel limit canvas", () => "2026-06-27T00:00:00.000Z", () => "root01");
  const next = addCanvasNode(canvas, { id: "novel-2", type: "novel", title: "Second novel" });

  assert.strictEqual(next.nodes.filter((node) => node.type === "novel").length, 1);
  assert.strictEqual(next.nodes.some((node) => node.id === "novel-2"), false);
});

test("revision novel nodes do not count as the single original novel node", () => {
  const canvas = createCanvas("Revision canvas", () => "2026-06-27T00:00:00.000Z", () => "root01");
  const next = addCanvasNode(canvas, {
    id: "novel-revision-1",
    type: "novel",
    title: "Novel revision",
    meta: {
      variantKind: "revision",
      parentNodeId: canvas.nodes[0].id,
    },
  });

  assert.strictEqual(next.nodes.filter((node) => node.type === "novel").length, 2);
  assert.strictEqual(next.nodes.some((node) => node.id === "novel-revision-1"), true);
});

test("revision nodes accept only one parent edge", () => {
  let canvas = createCanvas("Revision parent canvas", () => "2026-06-27T00:00:00.000Z", () => "root01");
  canvas = addCanvasNode(canvas, { id: "script-1", type: "script", title: "Script" });
  canvas = addCanvasNode(canvas, { id: "label-1", type: "label", title: "Label" });
  canvas = addCanvasNode(canvas, {
    id: "script-revision-1",
    type: "script",
    title: "Script revision",
    meta: {
      variantKind: "revision",
      parentNodeId: "script-1",
    },
  });

  canvas = connectCanvasNodes(canvas, "script-1", "script-revision-1", "revise");
  canvas = connectCanvasNodes(canvas, "label-1", "script-revision-1", "extra parent");

  assert.strictEqual(canvas.edges.filter((edge) => edge.to === "script-revision-1").length, 1);
  assert.strictEqual(canvas.edges.find((edge) => edge.to === "script-revision-1").from, "script-1");
});

test("merged nodes preserve grouped version history and a unique primary version", () => {
  const canvas = normalizeCanvas({
    id: "canvas-merge",
    title: "Merge canvas",
    nodes: [
      {
        id: "merged-1",
        type: "script",
        title: "剧本合并",
        content: "当前唯一版本",
        meta: {
          variantKind: "merged",
          primaryVersionId: "version-2",
          versionIds: ["version-1", "version-2"],
          versions: [
            {
              id: "version-1",
              nodeId: "script-1",
              title: "剧本",
              parentNodeId: "novel-1",
              parentTitleSnapshot: "小说",
              chatPrompt: "",
              chatResponse: "旧版",
              content: "旧版",
            },
            {
              id: "version-2",
              nodeId: "script-revision-1",
              title: "剧本 修改",
              parentNodeId: "script-1",
              parentTitleSnapshot: "剧本",
              chatPrompt: "加强冲突",
              chatResponse: "当前唯一版本",
              content: "当前唯一版本",
            },
          ],
        },
      },
    ],
  });

  const merged = canvas.nodes[0];
  assert.strictEqual(isMergedCanvasNode(merged), true);
  assert.strictEqual(merged.meta.primaryVersionId, "version-2");
  assert.strictEqual(merged.meta.versions.length, 2);

  const next = setCanvasMergedPrimaryVersion(canvas, "merged-1", "version-1");
  const nextNode = next.nodes[0];
  assert.strictEqual(nextNode.meta.primaryVersionId, "version-1");
  assert.strictEqual(nextNode.title, "剧本");
  assert.strictEqual(nextNode.content, "旧版");
  assert.strictEqual(nextNode.meta.versions.filter((item) => item.isPrimary).length, 1);
  assert.strictEqual(nextNode.meta.versions.find((item) => item.id === "version-1").isPrimary, true);
});
