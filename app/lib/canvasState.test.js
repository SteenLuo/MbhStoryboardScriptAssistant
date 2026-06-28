const assert = require("assert");
const test = require("node:test");

const {
  CANVAS_NODE_TYPES,
  addCanvasNode,
  connectCanvasNodes,
  createCanvas,
  deleteCanvasNode,
  normalizeCanvas,
  resizeCanvasNode,
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
