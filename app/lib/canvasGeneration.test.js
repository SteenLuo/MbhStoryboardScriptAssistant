const assert = require("assert");
const test = require("node:test");

const {
  generationStateIsBehind,
  preserveActiveStoryboardGenerationChanges,
  reconcileInterruptedStoryboardGenerations,
  storyboardGenerationKey,
  updateStoryboardGenerationState,
} = require("./canvasGeneration");

test("generationStateIsBehind detects a delayed client snapshot", () => {
  assert.strictEqual(generationStateIsBehind(
    { requestId: "request-1", status: "completed", completedEpisodes: 3 },
    { requestId: "request-1", status: "generating", completedEpisodes: 1 },
  ), true);
  assert.strictEqual(generationStateIsBehind(
    { requestId: "request-1", status: "completed", completedEpisodes: 3 },
    { requestId: "request-1", status: "completed", completedEpisodes: 3 },
  ), false);
});

function baseCanvas() {
  return {
    id: "canvas-1",
    title: "并行画布",
    nodes: [{ id: "script-1", type: "script", title: "剧本", content: "第1集" }],
    edges: [],
  };
}

test("updateStoryboardGenerationState persists progress on the source script node", () => {
  const canvas = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-1",
    status: "generating",
    completedEpisodes: 1,
    totalEpisodes: 3,
  });

  assert.strictEqual(canvas.nodes[0].content, "第1集");
  assert.deepStrictEqual(canvas.nodes[0].meta.storyboardGeneration, {
    requestId: "request-1",
    status: "generating",
    completedEpisodes: 1,
    totalEpisodes: 3,
  });
});

test("active storyboard generation survives a stale full-canvas client save", () => {
  const latest = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-1",
    status: "generating",
    completedEpisodes: 1,
    totalEpisodes: 2,
  });
  latest.nodes.push({
    id: "storyboard-1",
    type: "storyboard",
    title: "第1集 分镜",
    content: "已完成分镜",
    meta: { storyboardGenerationRequestId: "request-1" },
  });
  latest.edges.push({ id: "edge-1", from: "script-1", to: "storyboard-1", label: "生成分镜" });
  const staleIncoming = baseCanvas();
  staleIncoming.nodes.push({ id: "script-2", type: "script", title: "剧本 2", content: "第2集" });

  const merged = preserveActiveStoryboardGenerationChanges(latest, staleIncoming, [{
    canvasId: "canvas-1",
    sourceNodeId: "script-1",
    requestId: "request-1",
  }]);

  assert.deepStrictEqual(merged.nodes.map((node) => node.id), ["script-1", "script-2", "storyboard-1"]);
  assert.strictEqual(merged.edges.some((edge) => edge.id === "edge-1"), true);
  assert.strictEqual(merged.nodes[0].meta.storyboardGeneration.completedEpisodes, 1);
});

test("completed storyboard generation survives a delayed pre-generation client save", () => {
  const latest = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-1",
    status: "completed",
    completedEpisodes: 1,
    totalEpisodes: 1,
  });
  latest.nodes.push({
    id: "storyboard-1",
    type: "storyboard",
    title: "第1集 分镜",
    content: "已完成分镜",
    meta: { storyboardGenerationRequestId: "request-1" },
  });
  latest.edges.push({ id: "edge-1", from: "script-1", to: "storyboard-1", label: "生成分镜" });

  const merged = preserveActiveStoryboardGenerationChanges(latest, baseCanvas(), new Map());

  assert.strictEqual(merged.nodes.some((node) => node.id === "storyboard-1"), true);
  assert.strictEqual(merged.edges.some((edge) => edge.id === "edge-1"), true);
  assert.strictEqual(merged.nodes[0].meta.storyboardGeneration.status, "completed");
});

test("an up-to-date client may intentionally delete a completed generated node", () => {
  const latest = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-1",
    status: "completed",
    completedEpisodes: 1,
    totalEpisodes: 1,
  });
  latest.nodes.push({
    id: "storyboard-1",
    type: "storyboard",
    title: "第1集 分镜",
    content: "已完成分镜",
    meta: { storyboardGenerationRequestId: "request-1" },
  });
  const incoming = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-1",
    status: "completed",
    completedEpisodes: 1,
    totalEpisodes: 1,
  });

  const merged = preserveActiveStoryboardGenerationChanges(latest, incoming, new Map());

  assert.deepStrictEqual(merged.nodes.map((node) => node.id), ["script-1"]);
});

test("deleting the source node does not resurrect it during active generation", () => {
  const latest = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-1",
    status: "generating",
  });
  const incoming = { ...baseCanvas(), nodes: [], edges: [] };

  const merged = preserveActiveStoryboardGenerationChanges(latest, incoming, [{
    canvasId: "canvas-1",
    sourceNodeId: "script-1",
    requestId: "request-1",
  }]);

  assert.deepStrictEqual(merged.nodes, []);
});

test("interrupted persisted generation is changed to failed instead of staying stuck", () => {
  const running = updateStoryboardGenerationState(baseCanvas(), "script-1", {
    requestId: "request-old",
    status: "generating",
    serverInstanceId: "server-old",
  });
  const reconciled = reconcileInterruptedStoryboardGenerations(
    running,
    new Map(),
    "server-new",
    () => "2026-08-03T10:00:00.000Z",
  );

  assert.strictEqual(reconciled.changed, true);
  assert.strictEqual(reconciled.canvas.nodes[0].meta.storyboardGeneration.status, "failed");
  assert.match(reconciled.canvas.nodes[0].meta.storyboardGeneration.error, /任务已中断/);
});

test("storyboardGenerationKey scopes duplicate protection to one source node", () => {
  assert.strictEqual(storyboardGenerationKey("canvas-1", "script-1"), "canvas-1:script-1");
  assert.notStrictEqual(
    storyboardGenerationKey("canvas-1", "script-1"),
    storyboardGenerationKey("canvas-1", "script-2"),
  );
});
