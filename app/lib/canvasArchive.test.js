const assert = require("node:assert/strict");
const test = require("node:test");

const { analyzeCanvasArchiveReadiness } = require("./canvasArchive");

function readyCanvas(extraNodes = []) {
  return {
    id: "canvas-1",
    title: "归档测试",
    nodes: [
      { id: "novel-1", type: "novel", title: "小说", content: "原文", meta: {} },
      { id: "script-1", type: "script", title: "剧本", content: "第1集\n内容一\n第2集\n内容二", meta: {} },
      { id: "storyboard-1", type: "storyboard", title: "第一集 分镜", content: "台词：好。", meta: { episodeNumber: 1 } },
      { id: "storyboard-2", type: "storyboard", title: "第二集 分镜", content: "台词：好。", meta: { episodeNumber: 2 } },
      ...extraNodes,
    ],
    edges: [],
  };
}

test("analyzeCanvasArchiveReadiness allows one novel one script and one storyboard per episode", () => {
  const result = analyzeCanvasArchiveReadiness(readyCanvas());

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.requiredEpisodes, [1, 2]);
  assert.strictEqual(result.issues.length, 0);
});

test("analyzeCanvasArchiveReadiness allows script-led canvases without a novel", () => {
  const canvas = readyCanvas().nodes.filter((node) => node.type !== "novel");
  const result = analyzeCanvasArchiveReadiness({ id: "canvas-1", title: "无小说归档", nodes: canvas, edges: [] });

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.requiredEpisodes, [1, 2]);
  assert.ok(!result.issues.some((issue) => issue.code === "missing-novel-version"));
});

test("analyzeCanvasArchiveReadiness blocks duplicate novel final versions when novels exist", () => {
  const result = analyzeCanvasArchiveReadiness(readyCanvas([
    { id: "novel-2", type: "novel", title: "小说 2", content: "另一个版本", meta: {} },
  ]));

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate-novel-version"));
});

test("analyzeCanvasArchiveReadiness blocks duplicate storyboard versions for the same episode", () => {
  const result = analyzeCanvasArchiveReadiness(readyCanvas([
    { id: "storyboard-duplicate", type: "storyboard", title: "第一集 重复分镜", content: "台词：好。", meta: { episodeNumber: 1 } },
  ]));

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate-storyboard-version" && issue.episodeNumber === 1));
});

test("analyzeCanvasArchiveReadiness blocks missing storyboard episodes", () => {
  const canvas = readyCanvas().nodes.filter((node) => node.id !== "storyboard-2");
  const result = analyzeCanvasArchiveReadiness({ id: "canvas-1", title: "缺集", nodes: canvas, edges: [] });

  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing-storyboard-version" && issue.episodeNumber === 2));
});
