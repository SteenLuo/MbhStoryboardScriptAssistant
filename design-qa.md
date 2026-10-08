# Canvas 2.0 benchmark design QA

Date: 2026-08-12
Viewport: 1211 x 920, desktop
Reference: LibTV canvas captures from the current in-app browser session
Prototype: `http://127.0.0.1:17877/?canvas=canvas-be255d`

## Same-state comparisons

- Default workspace: benchmark and prototype both use an edge-attached left panel, neutral dotted canvas, compact bottom-center dock, lower-left view actions, and soft curved edges.
- Add hover/open: prototype now uses a 32 px icon button, 50 px dock height, centered hover label, plus-to-close state, 196 px popover, compact 32 px rows, and 150-200 ms transitions.
- Node focus/edit: double-click smoothly focuses the node, preserves selection, exposes the existing top Markdown toolbar, resize frame, connection points, and legacy plus actions.
- Low zoom: nodes and edges remain visible below 45%; viewport culling only activates at readable zoom.
- History: modal now has image/video/audio tabs with counts, sorting/batch controls, a rich empty state, and preview/add/download actions when history exists.
- Shortcut panel: four benchmark-aligned groups cover selection, editing, canvas/node, view, and undo/redo actions.

## Issues fixed

- P0: canvas context vanished at low zoom — fixed.
- P0: edge click opened destructive actions immediately — fixed; click selects, context menu edits.
- P1: double-click lost selection/actions — verified fixed.
- P1: group-selection jumped directly into merge semantics — fixed with generic copy/delete/merge first layer.
- P1: dock/menu geometry, hover feedback, icon language, and timing diverged — fixed.
- P1: left rows were oversized and lacked hover affordance — fixed.
- P1: history and shortcut surfaces were incomplete — fixed.
- P2: video node lacked benchmark-style suggestion/reference/parameter surfaces — implemented.

## Remaining P3 follow-up

- Exact Chinese font metrics may differ slightly because the benchmark's private webfont is not part of this repository.
- Empty asset libraries correctly show no user media; populated-state fidelity depends on the imported asset thumbnails.

final result: passed

## 2026-08-12 media node parity pass

- Reference states: `.codex-audit/01-liblib-image-node.png`, `.codex-audit/02-liblib-video-node.png`
- Local states: `.codex-audit/03-local-image-node.png`, `.codex-audit/04-local-video-node.png`
- Image node now matches the benchmark hierarchy: separate preview, reference/mark/style/focus tools, prompt area, model/ratio-resolution-count controls, preset and generate action.
- Video node now matches the benchmark hierarchy: preview with starter actions, reference/effects/character/camera tools, prompt area, model/mode/ratio-resolution-duration-count controls and generate action.
- Reference selection opens an in-canvas picker instead of redirecting to the left asset-management tab.
- P0/P1/P2 remaining: none in the inspected empty-node and tool-open states.
- P3: exact vendor model names, paid capabilities, generated output rendering, and external API responses remain dependent on configured providers.

## 2026-08-12 compact viewport interaction pass

- Source: user-provided LibTV blank-canvas double-click screenshot at 475 x 655.
- Prototype: local canvas at 1251 x 958, blank double-click state.
- Passed: ordinary wheel pans without changing the 49% zoom value.
- Passed: native blank double-click zoom is disabled and opens the add menu at the pointer.
- Passed: menu grouping, 196px width, dark neutral surface, 16px radius, badges, nested-entry chevrons, hover states, and viewport-edge clamping match the source language.
- Passed: selecting a node entry carries the double-click world coordinate into node creation.
- Passed: the canvas stage now occupies the complete compact viewport instead of collapsing to zero height during first load.

final result: passed
