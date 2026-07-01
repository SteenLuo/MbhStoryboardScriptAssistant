const CANVAS_NODE_TYPES = ["novel", "script", "storyboard", "label"];
const NODE_DEFAULTS = {
  novel: { title: "小说", width: 340, height: 220 },
  script: { title: "剧本", width: 360, height: 240 },
  storyboard: { title: "分镜脚本", width: 360, height: 260 },
  label: { title: "标识", width: 260, height: 140 },
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function cleanType(type) {
  return CANVAS_NODE_TYPES.includes(type) ? type : "label";
}

function cleanEdgeSide(side, fallback) {
  return side === "left" || side === "right" ? side : fallback;
}

function isRevisionCanvasNode(node) {
  return node?.meta?.variantKind === "revision";
}

function isMergedCanvasNode(node) {
  return node?.meta?.variantKind === "merged";
}

function revisionParentId(node) {
  return String(node?.meta?.parentNodeId || "");
}

function normalizeMergedVersion(version = {}, index = 0) {
  const id = String(version.id || version.versionId || `version-${index + 1}`);
  const content = String(version.content || version.chatResponse || "");
  return {
    id,
    nodeId: String(version.nodeId || ""),
    type: cleanType(version.type),
    title: String(version.title || `版本 ${index + 1}`),
    parentNodeId: String(version.parentNodeId || ""),
    parentTitleSnapshot: String(version.parentTitleSnapshot || ""),
    chatPrompt: String(version.chatPrompt || ""),
    chatResponse: String(version.chatResponse || content),
    content,
    createdAt: String(version.createdAt || ""),
    sourceKind: String(version.sourceKind || ""),
    isPrimary: Boolean(version.isPrimary),
  };
}

function normalizeNodeMeta(meta = {}) {
  if (!meta || typeof meta !== "object") return {};
  if (meta.variantKind !== "merged") return meta;

  const versions = (Array.isArray(meta.versions) ? meta.versions : [])
    .map(normalizeMergedVersion);
  const requestedPrimaryId = String(meta.primaryVersionId || "");
  const fallbackPrimaryId = versions.find((version) => version.isPrimary)?.id || versions[0]?.id || "";
  const primaryVersionId = versions.some((version) => version.id === requestedPrimaryId)
    ? requestedPrimaryId
    : fallbackPrimaryId;

  return {
    ...meta,
    variantKind: "merged",
    primaryVersionId,
    versionIds: versions.map((version) => version.id),
    versions: versions.map((version) => ({
      ...version,
      isPrimary: version.id === primaryVersionId,
    })),
  };
}

function normalizeNode(node = {}, index = 0) {
  const type = cleanType(node.type);
  const defaults = NODE_DEFAULTS[type];
  const normalized = {
    id: String(node.id || randomId("node")),
    type,
    title: String(node.title || defaults.title),
    content: String(node.content || ""),
    x: clampNumber(node.x, 120 + index * 40, -20000, 20000),
    y: clampNumber(node.y, 120 + index * 40, -20000, 20000),
    width: clampNumber(node.width, defaults.width, 220, 900),
    height: clampNumber(node.height, defaults.height, 120, 900),
    meta: normalizeNodeMeta(node.meta),
  };
  if (isMergedCanvasNode(normalized) && !normalized.content) {
    const primary = normalized.meta.versions.find((version) => version.id === normalized.meta.primaryVersionId);
    normalized.content = primary?.content || primary?.chatResponse || "";
  }
  return normalized;
}

function normalizeCanvas(canvas = {}, now = nowIso) {
  let hasNovel = false;
  const nodes = (Array.isArray(canvas.nodes) ? canvas.nodes : [])
    .map(normalizeNode)
    .filter((node) => {
      if (node.type !== "novel") return true;
      if (isRevisionCanvasNode(node)) return true;
      if (hasNovel) return false;
      hasNovel = true;
      return true;
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const revisionIncoming = new Set();
  const edges = (Array.isArray(canvas.edges) ? canvas.edges : [])
    .filter((edge) => {
      if (!nodeIds.has(edge?.from) || !nodeIds.has(edge?.to) || edge.from === edge.to) return false;
      const targetNode = nodeMap.get(edge.to);
      if (!isRevisionCanvasNode(targetNode)) return true;
      const parentId = revisionParentId(targetNode);
      if (parentId && edge.from !== parentId) return false;
      if (revisionIncoming.has(edge.to)) return false;
      revisionIncoming.add(edge.to);
      return true;
    })
    .map((edge, index) => ({
      id: String(edge.id || `edge-${edge.from}-${edge.to}-${index}`),
      from: edge.from,
      to: edge.to,
      label: String(edge.label || ""),
      fromSide: cleanEdgeSide(edge.fromSide, "right"),
      toSide: cleanEdgeSide(edge.toSide, "left"),
    }));
  return {
    id: String(canvas.id || randomId("canvas")),
    title: String(canvas.title || "").trim() || "未命名画布",
    createdAt: canvas.createdAt || now(),
    updatedAt: canvas.updatedAt || canvas.createdAt || now(),
    viewport: {
      x: clampNumber(canvas.viewport?.x, 0, -20000, 20000),
      y: clampNumber(canvas.viewport?.y, 0, -20000, 20000),
      scale: clampNumber(canvas.viewport?.scale, 1, 0.25, 2),
    },
    nodes,
    edges,
  };
}

function createCanvas(title = "新画布", now = nowIso, idSource = () => Math.random().toString(16).slice(2, 8)) {
  const id = `canvas-${idSource()}`;
  return normalizeCanvas({
    id,
    title: String(title || "").trim() || "新画布",
    createdAt: now(),
    updatedAt: now(),
    nodes: [{
      id: `node-${idSource()}`,
      type: "novel",
      title: "小说 / 原始材料",
      x: 120,
      y: 120,
      width: 360,
      height: 240,
    }],
    edges: [],
  }, now);
}

function touch(canvas) {
  return { ...canvas, updatedAt: nowIso() };
}

function addCanvasNode(canvas, node) {
  const normalized = normalizeCanvas(canvas);
  const nextNode = normalizeNode(node, normalized.nodes.length);
  if (
    nextNode.type === "novel" &&
    !isRevisionCanvasNode(nextNode) &&
    normalized.nodes.some((item) => item.type === "novel" && !isRevisionCanvasNode(item))
  ) {
    return normalized;
  }
  return touch({
    ...normalized,
    nodes: [...normalized.nodes, nextNode],
  });
}

function updateCanvasNodeContent(canvas, nodeId, content, patch = {}) {
  const normalized = normalizeCanvas(canvas);
  return touch({
    ...normalized,
    nodes: normalized.nodes.map((node) => node.id === nodeId
      ? normalizeNode({ ...node, ...patch, content }, 0)
      : node),
  });
}

function resizeCanvasNode(canvas, nodeId, size = {}) {
  const normalized = normalizeCanvas(canvas);
  return touch({
    ...normalized,
    nodes: normalized.nodes.map((node) => node.id === nodeId
      ? normalizeNode({ ...node, width: size.width, height: size.height }, 0)
      : node),
  });
}

function moveCanvasNode(canvas, nodeId, position = {}) {
  const normalized = normalizeCanvas(canvas);
  return touch({
    ...normalized,
    nodes: normalized.nodes.map((node) => node.id === nodeId
      ? normalizeNode({ ...node, x: position.x, y: position.y }, 0)
      : node),
  });
}

function deleteCanvasNode(canvas, nodeId) {
  const normalized = normalizeCanvas(canvas);
  return touch({
    ...normalized,
    nodes: normalized.nodes.filter((node) => node.id !== nodeId),
    edges: normalized.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
  });
}

function setCanvasMergedPrimaryVersion(canvas, nodeId, versionId) {
  const normalized = normalizeCanvas(canvas);
  return touch({
    ...normalized,
    nodes: normalized.nodes.map((node) => {
      if (node.id !== nodeId || !isMergedCanvasNode(node)) return node;
      const requestedVersionId = String(versionId || "");
      const versions = node.meta.versions || [];
      const primary = versions.find((version) => version.id === requestedVersionId);
      if (!primary) return node;
      return normalizeNode({
        ...node,
        title: primary.title || node.title,
        content: primary.content || primary.chatResponse || "",
        meta: {
          ...node.meta,
          primaryVersionId: primary.id,
          versions: versions.map((version) => ({
            ...version,
            isPrimary: version.id === primary.id,
          })),
        },
      }, 0);
    }),
  });
}

function connectCanvasNodes(canvas, from, to, label = "", options = {}) {
  const normalized = normalizeCanvas(canvas);
  const nodes = new Map(normalized.nodes.map((node) => [node.id, node]));
  if (!nodes.has(from) || !nodes.has(to) || from === to) return normalized;
  if (normalized.edges.some((edge) => edge.from === from && edge.to === to)) return normalized;
  const targetNode = nodes.get(to);
  if (isRevisionCanvasNode(targetNode)) {
    const parentId = revisionParentId(targetNode);
    if (parentId && from !== parentId) return normalized;
    if (normalized.edges.some((edge) => edge.to === to)) return normalized;
  }
  return touch({
    ...normalized,
    edges: [...normalized.edges, {
      id: `edge-${from}-${to}-${Date.now()}`,
      from,
      to,
      label,
      fromSide: cleanEdgeSide(options.fromSide, "right"),
      toSide: cleanEdgeSide(options.toSide, "left"),
    }],
  });
}

module.exports = {
  CANVAS_NODE_TYPES,
  NODE_DEFAULTS,
  addCanvasNode,
  connectCanvasNodes,
  createCanvas,
  deleteCanvasNode,
  isMergedCanvasNode,
  isRevisionCanvasNode,
  moveCanvasNode,
  normalizeCanvas,
  normalizeNode,
  resizeCanvasNode,
  setCanvasMergedPrimaryVersion,
  updateCanvasNodeContent,
};
