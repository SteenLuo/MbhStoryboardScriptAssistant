const ASSET_KINDS = ["person", "item", "scene"];
const ASSET_SCOPES = ["global", "project"];
const MEDIA_NODE_TYPES = ["image", "video", "audio"];

const MEDIA_MODELS = {
  image: [
    {
      id: "seedream-5.0-pro",
      label: "Seedream 5.0 Pro",
      endpoint: "/images/generations",
      modes: ["text-to-image", "image-to-image", "multi-angle", "nine-grid"],
      ratios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      resolutions: ["1K", "2K"],
      counts: [1],
      maxReferences: 10,
    },
    {
      id: "gpt-image-2",
      label: "GPT Image 2",
      endpoint: "/images/generations",
      modes: ["text-to-image", "image-to-image", "multi-angle", "nine-grid"],
      ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
      resolutions: ["1K", "2K", "4K"],
      counts: [1, 2, 3, 4],
      maxReferences: 15,
    },
    {
      id: "qwen-image-2.0",
      label: "Qwen Image 2.0",
      endpoint: "/images/generations",
      modes: ["text-to-image", "image-to-image", "multi-angle", "nine-grid"],
      ratios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      resolutions: ["1K", "2K"],
      counts: [1, 2, 3, 4, 5, 6],
      maxReferences: 6,
    },
  ],
  video: [
    {
      id: "doubao-seedance-2-0",
      label: "豆包 Seedance 2.0",
      endpoint: "/videos/generations",
      modes: ["text-to-video", "reference-to-video", "first-last-frame"],
      ratios: ["adaptive", "1:1", "9:16", "16:9", "21:9"],
      resolutions: ["720P", "1080P"],
      durations: [4, 5, 8, 10, 12],
      maxReferences: 8,
      supportsAudioReference: true,
    },
    {
      id: "minimax-h3",
      label: "MiniMax H3",
      endpoint: "/videos/generations",
      modes: ["text-to-video", "reference-to-video", "first-last-frame"],
      ratios: ["1:1", "9:16", "16:9"],
      resolutions: ["768P", "2K"],
      durations: [4, 6, 8, 10, 12, 15],
      maxReferences: 8,
      supportsAudioReference: true,
    },
    {
      id: "kling-v3-omni",
      label: "Kling v3 Omni",
      endpoint: "/videos/generations",
      modes: ["text-to-video", "reference-to-video", "first-last-frame"],
      ratios: ["1:1", "9:16", "16:9"],
      resolutions: ["720P", "1080P", "4K"],
      durations: [3, 5, 8, 10, 15],
      maxReferences: 8,
      supportsAudioReference: true,
    },
    {
      id: "vidu-q3",
      label: "Vidu Q3",
      endpoint: "/videos/generations",
      modes: ["reference-to-video"],
      ratios: ["1:1", "9:16", "16:9"],
      resolutions: ["540P", "720P", "1080P"],
      durations: [1, 2, 3, 4, 5, 8, 12, 16],
      maxReferences: 7,
      supportsAudioReference: false,
    },
  ],
  audio: [
    {
      id: "tts-1",
      label: "TTS",
      endpoint: "/audio/speech",
      modes: ["text-to-speech"],
      voices: ["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "shimmer"],
    },
  ],
};

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanAssetKind(value) {
  return ASSET_KINDS.includes(value) ? value : "person";
}

function cleanAssetScope(value) {
  return ASSET_SCOPES.includes(value) ? value : "project";
}

function cleanNodeType(value) {
  return MEDIA_NODE_TYPES.includes(value) ? value : "image";
}

function cleanDataUrl(value) {
  const input = String(value || "").trim();
  return input.startsWith("data:") || /^https?:\/\//i.test(input) ? input : "";
}

function normalizeAssetElement(element = {}, index = 0) {
  return {
    id: String(element.id || randomId("asset-element")),
    title: String(element.title || `元素 ${index + 1}`).trim() || `元素 ${index + 1}`,
    role: String(element.role || "reference").trim() || "reference",
    mediaType: String(element.mediaType || "image").trim() || "image",
    source: cleanDataUrl(element.source || element.dataUrl || element.url),
    createdAt: String(element.createdAt || nowIso()),
    meta: element.meta && typeof element.meta === "object" ? element.meta : {},
  };
}

function normalizeAsset(asset = {}) {
  const scope = cleanAssetScope(asset.scope);
  const canvasId = scope === "project" ? String(asset.canvasId || "") : "";
  return {
    id: String(asset.id || randomId("asset")),
    title: String(asset.title || "未命名资产").trim() || "未命名资产",
    kind: cleanAssetKind(asset.kind),
    scope,
    canvasId,
    description: String(asset.description || ""),
    tags: Array.isArray(asset.tags) ? asset.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12) : [],
    elements: (Array.isArray(asset.elements) ? asset.elements : []).map(normalizeAssetElement),
    createdAt: String(asset.createdAt || nowIso()),
    updatedAt: String(asset.updatedAt || asset.createdAt || nowIso()),
  };
}

function normalizeAssets(value = {}) {
  const assets = Array.isArray(value) ? value : value.assets;
  return (Array.isArray(assets) ? assets : []).map(normalizeAsset);
}

function assetPack(asset) {
  const normalized = normalizeAsset(asset);
  return {
    format: "mbh-asset-pack",
    version: 1,
    exportedAt: nowIso(),
    asset: normalized,
  };
}

function importAssetPack(value, options = {}) {
  const source = value?.asset || value;
  const imported = normalizeAsset({
    ...source,
    id: options.keepId ? source?.id : randomId("asset"),
    scope: options.scope || source?.scope || "project",
    canvasId: options.canvasId || source?.canvasId || "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return imported;
}

function mediaModelCatalog() {
  return Object.fromEntries(Object.entries(MEDIA_MODELS).map(([type, models]) => [type, models.map((model) => ({ ...model }))]));
}

function findMediaModel(type, modelId) {
  const nodeType = cleanNodeType(type);
  return MEDIA_MODELS[nodeType].find((model) => model.id === modelId) || MEDIA_MODELS[nodeType][0];
}

function normalizeMediaNodeConfig(type, value = {}) {
  const nodeType = cleanNodeType(type);
  const model = findMediaModel(nodeType, value.model);
  const mode = model.modes.includes(value.mode) ? value.mode : model.modes[0];
  const ratio = model.ratios?.includes(value.ratio) ? value.ratio : model.ratios?.[0] || "";
  const resolution = model.resolutions?.includes(value.resolution) ? value.resolution : model.resolutions?.[0] || "";
  const duration = model.durations?.includes(Number(value.duration)) ? Number(value.duration) : model.durations?.[0] || 0;
  const count = model.counts?.includes(Number(value.count)) ? Number(value.count) : model.counts?.[0] || 1;
  return {
    type: nodeType,
    providerId: String(value.providerId || "apimart"),
    model: model.id,
    mode,
    prompt: String(value.prompt || ""),
    ratio,
    resolution,
    duration,
    count,
    referenceAssetIds: Array.isArray(value.referenceAssetIds) ? value.referenceAssetIds.map(String).filter(Boolean).slice(0, model.maxReferences || 0) : [],
    referenceElementIds: Array.isArray(value.referenceElementIds) ? value.referenceElementIds.map(String).filter(Boolean).slice(0, model.maxReferences || 0) : [],
    audioReferenceElementId: model.supportsAudioReference ? String(value.audioReferenceElementId || "") : "",
  };
}

function defaultMediaSettings() {
  return {
    apimart: {
      baseUrl: "https://api.apimart.ai/v1",
      apiKey: "",
    },
    imageProviders: [],
    videoProviders: [],
  };
}

function normalizeProvider(item = {}, index = 0) {
  return {
    id: String(item.id || `provider-${index + 1}`),
    label: String(item.label || `自定义 API ${index + 1}`).trim() || `自定义 API ${index + 1}`,
    baseUrl: String(item.baseUrl || "").trim().replace(/\/$/, ""),
    apiKey: String(item.apiKey || "").trim(),
    model: String(item.model || "").trim(),
  };
}

function normalizeMediaSettings(value = {}) {
  const defaults = defaultMediaSettings();
  return {
    apimart: {
      baseUrl: String(value.apimart?.baseUrl || defaults.apimart.baseUrl).trim().replace(/\/$/, "") || defaults.apimart.baseUrl,
      apiKey: String(value.apimart?.apiKey || "").trim(),
    },
    imageProviders: (Array.isArray(value.imageProviders) ? value.imageProviders : []).map(normalizeProvider),
    videoProviders: (Array.isArray(value.videoProviders) ? value.videoProviders : []).map(normalizeProvider),
  };
}

function publicMediaSettings(value = {}) {
  const settings = normalizeMediaSettings(value);
  const publicProvider = (provider) => ({ ...provider, hasApiKey: Boolean(provider.apiKey), apiKey: "" });
  return {
    apimart: { baseUrl: settings.apimart.baseUrl, hasApiKey: Boolean(settings.apimart.apiKey), apiKey: "" },
    imageProviders: settings.imageProviders.map(publicProvider),
    videoProviders: settings.videoProviders.map(publicProvider),
  };
}

function updateMediaSettings(existing = {}, body = {}) {
  const current = normalizeMediaSettings(existing);
  const next = normalizeMediaSettings({
    ...current,
    ...body,
    apimart: {
      ...current.apimart,
      ...(body.apimart || {}),
      apiKey: Object.prototype.hasOwnProperty.call(body.apimart || {}, "apiKey") && String(body.apimart.apiKey || "").trim()
        ? String(body.apimart.apiKey).trim()
        : current.apimart.apiKey,
    },
  });
  const preserveKeys = (nextList, oldList, inputList) => nextList.map((provider, index) => {
    const input = inputList?.[index] || {};
    const existingProvider = oldList.find((item) => item.id === provider.id);
    return {
      ...provider,
      apiKey: Object.prototype.hasOwnProperty.call(input, "apiKey") && String(input.apiKey || "").trim()
        ? String(input.apiKey).trim()
        : existingProvider?.apiKey || provider.apiKey,
    };
  });
  next.imageProviders = preserveKeys(next.imageProviders, current.imageProviders, body.imageProviders);
  next.videoProviders = preserveKeys(next.videoProviders, current.videoProviders, body.videoProviders);
  return next;
}

module.exports = {
  ASSET_KINDS,
  ASSET_SCOPES,
  MEDIA_MODELS,
  MEDIA_NODE_TYPES,
  assetPack,
  cleanNodeType,
  defaultMediaSettings,
  findMediaModel,
  importAssetPack,
  mediaModelCatalog,
  normalizeAsset,
  normalizeAssets,
  normalizeMediaNodeConfig,
  normalizeMediaSettings,
  publicMediaSettings,
  updateMediaSettings,
};
