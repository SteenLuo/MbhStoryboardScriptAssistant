import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./styles.css";

const flowNodeTypes = { legacy: memo(LegacyCanvasNode) };

function LegacyCanvasNode({ data, selected }) {
  const hostRef = useRef(null);
  const bridge = data.bridge;
  const nodeId = data.nodeId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !bridge) return undefined;
    return bridge.mountNode(nodeId, host);
  }, [bridge, nodeId, data.revision]);

  return <>
    <NodeResizer
      minWidth={220}
      minHeight={120}
      isVisible={selected && !bridge.isReadOnly()}
      onResizeEnd={(_event, params) => bridge.commitNodeSize(nodeId, params.width, params.height)}
    />
    <Handle id="left" type="target" position={Position.Left} className="mbh-flow-handle" />
    <div ref={hostRef} className="mbh-flow-node-host" data-node-id={nodeId} />
    <Handle id="right" type="source" position={Position.Right} className="mbh-flow-handle" />
  </>;
}

function canvasNodeToFlowNode(node, bridge) {
  const isImage = node.type === "image";
  const isVideo = node.type === "video";
  return {
    id: node.id,
    type: "legacy",
    position: { x: Number(node.x || 0), y: Number(node.y || 0) },
    width: isImage || isVideo ? 620 : Number(node.width || 320),
    height: isImage ? 590 : isVideo ? 600 : Number(node.height || 220),
    draggable: !bridge.isReadOnly(),
    selectable: true,
    // App-level editing rerenders the node host. Carry the original canvas
    // selection back into React Flow so resize handles and node actions do not
    // disappear when a double-click enters Markdown editing.
    selected: bridge.isNodeSelected(node.id),
    data: {
      bridge,
      nodeId: node.id,
      revision: bridge.nodeRevision(node.id),
    },
  };
}

function canvasEdgeToFlowEdge(edge, bridge) {
  return {
    id: edge.id,
    source: edge.from,
    target: edge.to,
    sourceHandle: edge.fromSide || "right",
    targetHandle: edge.toSide || "left",
    label: edge.label || "",
    // Preserve the original canvas' soft cubic connection language. The
    // orthogonal smoothstep route reads like a CAD diagram and obscures dense
    // story relationships when multiple edges leave the same node.
    type: "bezier",
    animated: false,
    selectable: true,
    data: { bridge },
  };
}

function CanvasSurface({ bridge }) {
  const { fitView, setViewport, getViewport, screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes] = useState(() => bridge.snapshot().nodes.map((node) => canvasNodeToFlowNode(node, bridge)));
  const [edges, setEdges] = useState(() => bridge.snapshot().edges.map((edge) => canvasEdgeToFlowEdge(edge, bridge)));
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [viewportZoom, setViewportZoom] = useState(1);
  const [interactionMode, setInteractionMode] = useState(() => bridge.snapshot().interactionMode || "select");
  const applyingExternalViewport = useRef(false);
  const frameProbe = useRef(null);
  const viewportGeometryRef = useRef(null);

  const safeViewportGeometry = useCallback(() => {
    const canvasRect = document.querySelector(".mbh-react-flow")?.getBoundingClientRect();
    if (!canvasRect) return null;
    const leftPanel = document.getElementById("canvasV2Left");
    const leftRect = leftPanel && !leftPanel.hidden && !leftPanel.classList.contains("collapsed")
      ? leftPanel.getBoundingClientRect()
      : null;
    const dock = document.getElementById("canvasV2Dock");
    const dockRect = dock && !dock.hidden ? dock.getBoundingClientRect() : null;
    const leftInset = leftRect ? Math.max(0, Math.min(canvasRect.width, leftRect.right - canvasRect.left)) : 0;
    const bottomInset = dockRect ? Math.max(0, Math.min(canvasRect.height, canvasRect.bottom - dockRect.top + 12)) : 0;
    return {
      width: canvasRect.width,
      height: canvasRect.height,
      centerX: leftInset + Math.max(0, canvasRect.width - leftInset) / 2,
      centerY: Math.max(0, canvasRect.height - bottomInset) / 2,
    };
  }, []);

  useEffect(() => {
    frameProbe.current = createFrameProbe((sample) => bridge.reportPerformance(sample));
    return () => frameProbe.current?.stop();
  }, [bridge]);

  useEffect(() => bridge.subscribe((next) => {
    setNodes(next.nodes.map((node) => canvasNodeToFlowNode(node, bridge)));
    setEdges(next.edges.map((edge) => canvasEdgeToFlowEdge(edge, bridge)));
    setInteractionMode(next.interactionMode || "select");
  }), [bridge]);

  useEffect(() => {
    const unsubscribe = bridge.subscribeViewport((viewport) => {
      if (!viewport) return;
      applyingExternalViewport.current = true;
      setViewport(viewport, { duration: 0 });
      requestAnimationFrame(() => { applyingExternalViewport.current = false; });
    });
    return unsubscribe;
  }, [bridge, setViewport]);

  const onNodeDragStart = useCallback(() => frameProbe.current?.start("node-drag"), []);
  const onNodeDragStop = useCallback((event, node) => {
    frameProbe.current?.stop();
    bridge.commitNodePosition(node.id, node.position);
  }, [bridge]);
  const onNodesChange = useCallback((changes) => setNodes((current) => {
    const next = applyNodeChanges(changes, current);
    if (changes.some((change) => change.type === "select")) {
      const selected = next.filter((node) => node.selected).map((node) => node.id);
      bridge.syncNodeSelection(selected);
    }
    return next;
  }), [bridge]);
  const onEdgesChange = useCallback((changes) => setEdges((current) => applyEdgeChanges(changes, current)), []);
  const onNodeClick = useCallback((event, node) => bridge.selectNode(node.id, event), [bridge]);
  const moveNodeToSafeCenter = useCallback((nodeId, requestedZoom) => {
    const target = nodes.find((node) => node.id === nodeId);
    const geometry = safeViewportGeometry();
    if (!target || !geometry) return;
    const width = Math.max(1, Number(target.measured?.width || target.width || 320));
    const height = Math.max(1, Number(target.measured?.height || target.height || 220));
    const zoom = Math.max(0.25, Math.min(2, requestedZoom(width, height, geometry)));
    const next = {
      x: geometry.centerX - (target.position.x + width / 2) * zoom,
      y: geometry.centerY - (target.position.y + height / 2) * zoom,
      zoom,
    };
    setViewport(next, { duration: 220 });
  }, [nodes, safeViewportGeometry, setViewport]);

  const focusNode = useCallback((nodeId) => {
    // Keep the 1.0 intent: a double-click makes the chosen card readable
    // instead of merely fitting the whole graph around it. Reserve the left
    // panel and bottom dock so the card is centered in the genuinely visible
    // area, not beneath an overlay.
    moveNodeToSafeCenter(nodeId, (width, height, geometry) => {
      const targetWidth = Math.max(240, geometry.width * 0.48 - 88);
      const targetHeight = Math.max(180, geometry.height * 0.42 - 88);
      return Math.min(targetWidth / width, targetHeight / height);
    });
  }, [moveNodeToSafeCenter]);

  const locateNode = useCallback((nodeId) => {
    // Sidebar navigation is a location action, not an aggressive zoom action.
    // On compact viewports cap it at 100% so neighboring cards do not look as
    // though the lower half of the canvas disappeared.
    moveNodeToSafeCenter(nodeId, () => Math.min(1, Math.max(0.65, getViewport().zoom)));
  }, [getViewport, moveNodeToSafeCenter]);
  const onNodeDoubleClick = useCallback((event, node) => {
    // The legacy card owns its title/body double-click semantics. This catches
    // the remaining card surface so every node still has a clear focus action.
    if (event.target.closest(".canvas-node-headline, .canvas-node-body, button, input, textarea")) return;
    focusNode(node.id);
  }, [focusNode]);
  const onPaneClick = useCallback(() => bridge.clearSelection(), [bridge]);
  const onPaneDoubleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    bridge.openQuickAdd({ x: event.clientX, y: event.clientY });
  }, [bridge]);
  const onEdgeClick = useCallback((_event, edge) => bridge.selectEdge(edge.id), [bridge]);
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    bridge.openEdgeMenu(edge.id, event);
  }, [bridge]);
  const onMoveEnd = useCallback((_event, viewport) => {
    frameProbe.current?.stop();
    setViewportZoom((current) => Math.abs(current - viewport.zoom) > 0.01 ? viewport.zoom : current);
    if (!applyingExternalViewport.current) bridge.commitViewport(viewport);
  }, [bridge]);

  useEffect(() => {
    bridge.setViewportActions({
      fit: () => fitView({ padding: 0.16, duration: 220, maxZoom: 1.4 }),
      focus: focusNode,
      locate: locateNode,
      zoomTo: (zoom) => {
        const current = getViewport();
        const next = { ...current, zoom: Math.max(0.25, Math.min(4, Number(zoom || current.zoom))) };
        setViewport(next, { duration: 0 });
        bridge.commitViewport(next);
      },
      toggleMiniMap: () => setShowMiniMap((visible) => !visible),
      current: () => getViewport(),
      project: (point) => screenToFlowPosition(point),
    });
  }, [bridge, fitView, focusNode, getViewport, locateNode, screenToFlowPosition, setViewport]);

  useEffect(() => {
    const root = document.querySelector(".mbh-react-flow");
    if (!root || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      const nextGeometry = safeViewportGeometry();
      const previousGeometry = viewportGeometryRef.current;
      viewportGeometryRef.current = nextGeometry;
      if (!nextGeometry || !previousGeometry) return;
      if (Math.abs(nextGeometry.width - previousGeometry.width) < 1 && Math.abs(nextGeometry.height - previousGeometry.height) < 1) return;
      const current = getViewport();
      const worldCenter = {
        x: (previousGeometry.centerX - current.x) / current.zoom,
        y: (previousGeometry.centerY - current.y) / current.zoom,
      };
      const next = {
        x: nextGeometry.centerX - worldCenter.x * current.zoom,
        y: nextGeometry.centerY - worldCenter.y * current.zoom,
        zoom: current.zoom,
      };
      applyingExternalViewport.current = true;
      setViewport(next, { duration: 0 });
      bridge.commitViewport(next);
      requestAnimationFrame(() => { applyingExternalViewport.current = false; });
    });
    viewportGeometryRef.current = safeViewportGeometry();
    observer.observe(root);
    return () => observer.disconnect();
  }, [bridge, getViewport, safeViewportGeometry, setViewport]);

  useEffect(() => {
    const root = document.querySelector(".mbh-react-flow");
    if (!root) return undefined;
    const handleModifiedWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const current = getViewport();
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const rootRect = root.getBoundingClientRect();
      const nextZoom = Math.max(0.25, Math.min(4, current.zoom * Math.exp(-event.deltaY * 0.0016)));
      const next = {
        x: event.clientX - rootRect.left - point.x * nextZoom,
        y: event.clientY - rootRect.top - point.y * nextZoom,
        zoom: nextZoom,
      };
      setViewport(next, { duration: 0 });
      bridge.commitViewport(next);
    };
    root.addEventListener("wheel", handleModifiedWheel, { capture: true, passive: false });
    return () => root.removeEventListener("wheel", handleModifiedWheel, { capture: true });
  }, [bridge, getViewport, screenToFlowPosition, setViewport]);

  useEffect(() => {
    const root = document.querySelector(".mbh-react-flow");
    if (!root) return undefined;
    const handleBlankDoubleClick = (event) => {
      if (event.target.closest?.(".react-flow__node, .react-flow__edge, button, input, textarea, select")) return;
      onPaneDoubleClick(event);
    };
    root.addEventListener("dblclick", handleBlankDoubleClick);
    return () => root.removeEventListener("dblclick", handleBlankDoubleClick);
  }, [onPaneDoubleClick]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={flowNodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onNodeDragStart={onNodeDragStart}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
      onMoveEnd={onMoveEnd}
      onMoveStart={() => frameProbe.current?.start("viewport-pan")}
      onConnect={(connection) => bridge.connect(connection)}
      fitView
      fitViewOptions={{ padding: 0.16, maxZoom: 1.4 }}
      minZoom={0.25}
      maxZoom={4}
      // Benchmark behavior: a plain wheel scrolls/pans the infinite canvas.
      // Zoom is deliberate via Ctrl/Cmd + wheel or a touchpad pinch.
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      panOnScroll
      panOnScrollMode="free"
      preventScrolling
      onlyRenderVisibleElements={viewportZoom >= 0.45}
      // The dock mirrors the benchmark's two modes: selection on the primary
      // button, or a hand tool that pans with the primary button.
      panOnDrag={interactionMode === "pan" ? [0, 1, 2] : [1, 2]}
      selectionOnDrag={interactionMode !== "pan"}
      selectionKeyCode="Shift"
      selectionMode="partial"
      nodesDraggable={!bridge.isReadOnly() && interactionMode !== "pan"}
      nodesConnectable={!bridge.isReadOnly()}
      elevateNodesOnSelect={false}
      elevateEdgesOnSelect={false}
      deleteKeyCode={null}
      multiSelectionKeyCode={["Control", "Meta"]}
      className={`mbh-react-flow mbh-react-flow--${interactionMode}`}
    >
      <Background gap={22} size={1} />
      {showMiniMap && <MiniMap pannable zoomable nodeStrokeWidth={2} />}
    </ReactFlow>
  );
}

function createFrameProbe(report) {
  let label = "";
  let raf = 0;
  let startedAt = 0;
  let lastAt = 0;
  let deltas = [];
  const tick = (now) => {
    if (!label) return;
    if (lastAt) deltas.push(now - lastAt);
    lastAt = now;
    raf = requestAnimationFrame(tick);
  };
  return {
    start(nextLabel) {
      if (label) return;
      label = nextLabel;
      startedAt = performance.now();
      lastAt = 0;
      deltas = [];
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (!label) return;
      if (raf) cancelAnimationFrame(raf);
      const sorted = [...deltas].sort((a, b) => a - b);
      const percentile = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
      report({
        label,
        frames: sorted.length,
        elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
        p95FrameMs: Math.round(percentile * 100) / 100,
        maxFrameMs: Math.round((sorted.at(-1) || 0) * 100) / 100,
      });
      label = "";
      raf = 0;
    },
  };
}

function createCanvasFlow(rootElement, bridge) {
  const root = createRoot(rootElement);
  root.render(
    <ReactFlowProvider>
      <CanvasSurface bridge={bridge} />
    </ReactFlowProvider>,
  );
  return {
    destroy() { root.unmount(); },
    fit() { bridge.fit(); },
  };
}

window.MbhCanvasFlow = { createCanvasFlow };
