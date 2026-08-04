const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assetPack,
  importAssetPack,
  mediaModelCatalog,
  normalizeMediaNodeConfig,
  updateMediaSettings,
} = require("./mediaStudio");

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

test("blank replacement keys preserve existing APIMart and individual provider keys", () => {
  const settings = updateMediaSettings({ apimart: { baseUrl: "https://api.apimart.ai/v1", apiKey: "unified-key" }, imageProviders: [{ id: "img-a", label: "图片", baseUrl: "https://image.example", apiKey: "image-key" }] }, { apimart: { baseUrl: "https://api.apimart.ai/v1", apiKey: "" }, imageProviders: [{ id: "img-a", label: "图片", baseUrl: "https://image.example", apiKey: "" }] });
  assert.equal(settings.apimart.apiKey, "unified-key");
  assert.equal(settings.imageProviders[0].apiKey, "image-key");
});
