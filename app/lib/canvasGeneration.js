function storyboardGenerationKey(canvasId, sourceNodeId) {
  return `${String(canvasId || "")}:${String(sourceNodeId || "")}`;
}

function storyboardGenerationState(node) {
  const value = node?.meta?.storyboardGeneration;
  return value && typeof value === "object" ? value : null;
}

function updateStoryboardGenerationState(canvas, sourceNodeId, patch = {}) {
  let found = false;
  const nodes = (canvas?.nodes || []).map((node) => {
    if (node.id !== sourceNodeId) return node;
    found = true;
    const current = storyboardGenerationState(node) || {};
    return {
      ...node,
      meta: {
        ...(node.meta || {}),
        storyboardGeneration: {
          ...current,
          ...patch,
        },
      },
    };
  });
  if (!found) {
    const error = new Error("来源剧本节点已不存在，无法更新分镜生成状态");
    error.code = "CANVAS_SOURCE_NODE_MISSING";
    throw error;
  }
  return { ...canvas, nodes };
}

function activeTaskValues(activeTasks) {
  if (!activeTasks) return [];
  if (activeTasks instanceof Map) return Array.from(activeTasks.values());
  return Array.isArray(activeTasks) ? activeTasks : [];
}

function generationStateIsBehind(latestState, incomingState) {
  if (!latestState?.requestId) return false;
  if (!incomingState?.requestId) return true;
  if (incomingState.requestId !== latestState.requestId) return true;

  const latestCompleted = Number(latestState.completedEpisodes || 0);
  const incomingCompleted = Number(incomingState.completedEpisodes || 0);
  if (incomingCompleted < latestCompleted) return true;

  const terminalStatuses = new Set(["completed", "failed"]);
  return terminalStatuses.has(latestState.status) && incomingState.status === "generating";
}

function preserveActiveStoryboardGenerationChanges(latestCanvas, incomingCanvas, activeTasks) {
  let next = {
    ...incomingCanvas,
    nodes: [...(incomingCanvas?.nodes || [])],
    edges: [...(incomingCanvas?.edges || [])],
  };
  const canvasId = String(incomingCanvas?.id || latestCanvas?.id || "");

  const activeBySource = new Map(activeTaskValues(activeTasks)
    .filter((task) => String(task?.canvasId || "") === canvasId)
    .map((task) => [String(task?.sourceNodeId || ""), task]));

  for (const latestSource of latestCanvas?.nodes || []) {
    const latestState = storyboardGenerationState(latestSource);
    const task = activeBySource.get(latestSource.id);
    const requestId = String(task?.requestId || latestState?.requestId || "");
    if (!requestId) continue;

    const incomingSourceIndex = next.nodes.findIndex((node) => node.id === latestSource.id);
    if (!latestSource || incomingSourceIndex < 0) continue;

    const incomingSource = next.nodes[incomingSourceIndex];
    const incomingState = storyboardGenerationState(incomingSource);
    const activeRequestMatches = task?.requestId === requestId;
    if (!activeRequestMatches && !generationStateIsBehind(latestState, incomingState)) continue;

    next.nodes[incomingSourceIndex] = {
      ...incomingSource,
      meta: {
        ...(incomingSource.meta || {}),
        storyboardGeneration: latestState,
      },
    };

    const protectedNodes = (latestCanvas?.nodes || []).filter(
      (node) => String(node?.meta?.storyboardGenerationRequestId || "") === requestId,
    );
    const protectedIds = new Set(protectedNodes.map((node) => node.id));
    for (const protectedNode of protectedNodes) {
      const index = next.nodes.findIndex((node) => node.id === protectedNode.id);
      if (index >= 0) next.nodes[index] = protectedNode;
      else next.nodes.push(protectedNode);
    }
    for (const edge of latestCanvas?.edges || []) {
      if (!protectedIds.has(edge.from) && !protectedIds.has(edge.to)) continue;
      const index = next.edges.findIndex((item) => item.id === edge.id);
      if (index >= 0) next.edges[index] = edge;
      else next.edges.push(edge);
    }
  }

  return next;
}

function reconcileInterruptedStoryboardGenerations(canvas, activeTasks, serverInstanceId, now = () => new Date().toISOString()) {
  let changed = false;
  const activeByKey = new Map(activeTaskValues(activeTasks).map((task) => [
    storyboardGenerationKey(task.canvasId, task.sourceNodeId),
    task,
  ]));
  const nodes = (canvas?.nodes || []).map((node) => {
    const current = storyboardGenerationState(node);
    if (current?.status !== "generating") return node;
    const active = activeByKey.get(storyboardGenerationKey(canvas?.id, node.id));
    if (active?.requestId === current.requestId && current.serverInstanceId === serverInstanceId) return node;
    changed = true;
    const failedAt = now();
    return {
      ...node,
      meta: {
        ...(node.meta || {}),
        storyboardGeneration: {
          ...current,
          status: "failed",
          error: "服务重启或生成任务已中断，请重新生成。",
          failedAt,
          updatedAt: failedAt,
        },
      },
    };
  });
  return { canvas: changed ? { ...canvas, nodes } : canvas, changed };
}

module.exports = {
  generationStateIsBehind,
  preserveActiveStoryboardGenerationChanges,
  reconcileInterruptedStoryboardGenerations,
  storyboardGenerationKey,
  storyboardGenerationState,
  updateStoryboardGenerationState,
};
