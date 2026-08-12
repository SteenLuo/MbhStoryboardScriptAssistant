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
  return {
    id: node.id,
    type: "legacy",
    position: { x: Number(node.x || 0), y: Number(node.y || 0) },
    width: Number(node.width || 320),
    height: Number(node.height || 220),
    draggable: !bridge.isReadOnly(),
    selectable: true,
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
  const { fitView, setCenter, setViewport, getViewport, screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes] = useState(() => bridge.snapshot().nodes.map((node) => canvasNodeToFlowNode(node, bridge)));
  const [edges, setEdges] = useState(() => bridge.snapshot().edges.map((edge) => canvasEdgeToFlowEdge(edge, bridge)));
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [viewportZoom, setViewportZoom] = useState(1);
  const [interactionMode, setInteractionMode] = useState(() => bridge.snapshot().interactionMode || "select");
  const applyingExternalViewport = useRef(false);
  const frameProbe = useRef(null);

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
  const focusNode = useCallback((nodeId) => {
    const target = nodes.find((node) => node.id === nodeId);
    const canvasRect = document.querySelector(".mbh-react-flow")?.getBoundingClientRect();
    if (!target || !canvasRect) return;
    const width = Math.max(1, Number(target.measured?.width || target.width || 320));
    const height = Math.max(1, Number(target.measured?.height || target.height || 220));
    // Keep the 1.0 intent: a double-click makes the chosen card readable
    // instead of merely fitting the whole graph around it.
    const targetWidth = Math.max(240, canvasRect.width * 0.48 - 88);
    const targetHeight = Math.max(180, canvasRect.height * 0.42 - 88);
    const zoom = Math.max(0.25, Math.min(2, targetWidth / width, targetHeight / height));
    setCenter(target.position.x + width / 2, target.position.y + height / 2, { zoom, duration: 220 });
  }, [nodes, setCenter]);
  const onNodeDoubleClick = useCallback((event, node) => {
    // The legacy card owns its title/body double-click semantics. This catches
    // the remaining card surface so every node still has a clear focus action.
    if (event.target.closest(".canvas-node-headline, .canvas-node-body, button, input, textarea")) return;
    focusNode(node.id);
  }, [focusNode]);
  const onPaneClick = useCallback(() => bridge.clearSelection(), [bridge]);
  const onEdgeClick = useCallback((event, edge) => bridge.selectEdge(edge.id, event), [bridge]);
  const onMoveEnd = useCallback((_event, viewport) => {
    frameProbe.current?.stop();
    setViewportZoom((current) => Math.abs(current - viewport.zoom) > 0.01 ? viewport.zoom : current);
    if (!applyingExternalViewport.current) bridge.commitViewport(viewport);
  }, [bridge]);

  useEffect(() => {
    bridge.setViewportActions({
      fit: () => fitView({ padding: 0.16, duration: 220, maxZoom: 1.4 }),
      focus: focusNode,
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
  }, [bridge, fitView, focusNode, getViewport, screenToFlowPosition, setViewport]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={viewportZoom < 0.45 ? [] : edges}
      nodeTypes={flowNodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onNodeDragStart={onNodeDragStart}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      onEdgeClick={onEdgeClick}
      onMoveEnd={onMoveEnd}
      onMoveStart={() => frameProbe.current?.start("viewport-pan")}
      onConnect={(connection) => bridge.connect(connection)}
      fitView
      fitViewOptions={{ padding: 0.16, maxZoom: 1.4 }}
      minZoom={0.25}
      maxZoom={4}
      onlyRenderVisibleElements
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
