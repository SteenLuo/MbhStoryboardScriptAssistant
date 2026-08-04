const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assetPack,
  importAssetPack,
  mediaModelCatalog,
  normalizeMediaNodeConfig,
  updateMediaSettings,
} = require("./mediaStudio");
const { normalizeCanvas } = require("./canvasState");

test("image configuration keeps multi-angle and nine-grid only where the selected model supports them", () => {
  const config = normalizeMediaNodeConfig("image", {
    model: "gpt-image-2",
    mode: "nine-grid",
    ratio: "3:4",
    resolution: "4K",
    count: 4,
    providerId: "image-provider-a",
    referenceAssetIds: ["asset-a", "asset-b"],
  });
  assert.equal(config.mode, "nine-grid");
  assert.equal(config.resolution, "4K");
  assert.equal(config.count, 4);
  assert.equal(config.providerId, "image-provider-a");
  assert.deepEqual(config.referenceAssetIds, ["asset-a", "asset-b"]);
});

test("video configuration adapts resolution and duration to the selected model", () => {
  const config = normalizeMediaNodeConfig("video", {
    model: "minimax-h3",
    mode: "reference-to-video",
    resolution: "2K",
    duration: 15,
  });
  assert.equal(config.mode, "reference-to-video");
  assert.equal(config.resolution, "2K");
  assert.equal(config.duration, 15);
  assert.equal(config.count, 1);
  assert.ok(mediaModelCatalog().video.some((model) => model.id === "doubao-seedance-2-0"));
});

test("asset packs retain nested elements but import creates an independent asset record", () => {
  const pack = assetPack({ id: "global-hero", title: "男主角", kind: "person", scope: "global", elements: [{ id: "front", title: "正面三视图", source: "data:image/png;base64,AA==" }] });
  const imported = importAssetPack(pack, { scope: "project", canvasId: "canvas-a" });
  assert.notEqual(imported.id, "global-hero");
  assert.equal(imported.scope, "project");
  assert.equal(imported.canvasId, "canvas-a");
  assert.equal(imported.elements[0].title, "正面三视图");
});

test("a node keeps the asset element snapshot that existed when the reference was saved", () => {
  const config = normalizeMediaNodeConfig("video", {
    model: "doubao-seedance-2-0",
    mode: "reference-to-video",
    referenceAssetIds: ["hero"],
    referenceSnapshot: [{ assetId: "hero", assetTitle: "男主角", elementId: "hero-view-a", title: "三视图", mediaType: "image", source: "data:image/png;base64,AA==" }],
  });
  assert.equal(config.referenceSnapshot.length, 1);
  assert.equal(config.referenceSnapshot[0].source, "data:image/png;base64,AA==");
  assert.equal(config.lastTask, null);
});

test("canvas persistence retains media outputs and the submitted task snapshot", () => {
  const canvas = normalizeCanvas({ id: "canvas-media", nodes: [{ id: "video-node", type: "video", meta: { media: { model: "minimax-h3", referenceSnapshot: [{ assetId: "hero", elementId: "hero-a", source: "data:image/png;base64,AA==" }], outputUrls: ["https://example.test/result.mp4"], lastTask: { taskId: "task-1", providerId: "apimart", status: "processing", referenceSnapshot: [{ assetId: "hero", elementId: "hero-a", source: "data:image/png;base64,AA==" }] } } } }] });
  const media = canvas.nodes[0].meta.media;
  assert.equal(media.outputUrls[0], "https://example.test/result.mp4");
  assert.equal(media.lastTask.taskId, "task-1");
  assert.equal(media.lastTask.referenceSnapshot[0].elementId, "hero-a");
});

test("blank replacement keys preserve existing APIMart and individual provider keys", () => {
  const settings = updateMediaSettings({ apimart: { baseUrl: "https://api.apimart.ai/v1", apiKey: "unified-key" }, imageProviders: [{ id: "img-a", label: "图片", baseUrl: "https://image.example", apiKey: "image-key" }] }, { apimart: { baseUrl: "https://api.apimart.ai/v1", apiKey: "" }, imageProviders: [{ id: "img-a", label: "图片", baseUrl: "https://image.example", apiKey: "" }] });
  assert.equal(settings.apimart.apiKey, "unified-key");
  assert.equal(settings.imageProviders[0].apiKey, "image-key");
});
