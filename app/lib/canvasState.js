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

function normalizeNode(node = {}, index = 0) {
  const type = cleanType(node.type);
  const defaults = NODE_DEFAULTS[type];
  return {
    id: String(node.id || randomId("node")),
    type,
    title: String(node.title || defaults.title),
    content: String(node.content || ""),
    x: clampNumber(node.x, 120 + index * 40, -20000, 20000),
    y: clampNumber(node.y, 120 + index * 40, -20000, 20000),
    width: clampNumber(node.width, defaults.width, 220, 900),
    height: clampNumber(node.height, defaults.height, 120, 900),
    meta: node.meta && typeof node.meta === "object" ? node.meta : {},
  };
}

function normalizeCanvas(canvas = {}, now = nowIso) {
  let hasNovel = false;
  const nodes = (Array.isArray(canvas.nodes) ? canvas.nodes : [])
    .map(normalizeNode)
    .filter((node) => {
      if (node.type !== "novel") return true;
      if (hasNovel) return false;
      hasNovel = true;
      return true;
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(canvas.edges) ? canvas.edges : [])
    .filter((edge) => nodeIds.has(edge?.from) && nodeIds.has(edge?.to) && edge.from !== edge.to)
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
  if (nextNode.type === "novel" && normalized.nodes.some((item) => item.type === "novel")) {
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

function connectCanvasNodes(canvas, from, to, label = "", options = {}) {
  const normalized = normalizeCanvas(canvas);
  const ids = new Set(normalized.nodes.map((node) => node.id));
  if (!ids.has(from) || !ids.has(to) || from === to) return normalized;
  if (normalized.edges.some((edge) => edge.from === from && edge.to === to)) return normalized;
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
  moveCanvasNode,
  normalizeCanvas,
  normalizeNode,
  resizeCanvasNode,
  updateCanvasNodeContent,
};
