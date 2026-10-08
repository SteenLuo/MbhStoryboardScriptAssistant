(() => {
  const app = () => window.MbhCanvasApp;
  const $ = (id) => document.getElementById(id);
  const mediaTypes = new Set(["image", "video", "audio"]);
  let catalog = null;
  let assets = [];
  let generatedHistory = [];
  let activeTab = "nodes";
  let activeAssetKind = "";
  let activeHistoryType = "image";
  let quickAddPosition = null;

  function icon(name, extra = "") {
    return `<i class="ph ph-${name}${extra ? ` ${extra}` : ""}" aria-hidden="true"></i>`;
  }

  const nodeIconNames = { novel: "text-align-left", script: "article", storyboard: "film-strip", label: "note", image: "image", video: "play", audio: "music-note" };
  const assetIconNames = { person: "user", item: "diamond", scene: "house-line" };

  function esc(value) {
    return app()?.escapeHtml?.(String(value ?? "")) || String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function canvas() { return app()?.state.currentCanvas; }
  function currentNodes() { return canvas()?.nodes || []; }
  function mediaNode(id) { return currentNodes().find((node) => node.id === id && mediaTypes.has(node.type)); }

  function setLeftCollapsed(collapsed) {
    $("canvasV2Left")?.classList.toggle("collapsed", collapsed);
    $("canvasV2UtilityDock").hidden = false;
    document.body.classList.toggle("canvas-v2-left-collapsed", collapsed);
  }

  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-v2-tab]").forEach((button) => button.classList.toggle("active", button.dataset.v2Tab === tab));
  }

  function ensureChrome() {
    const shell = $("canvasShell");
    if (!shell || $("canvasProjectHome")) return;
    const home = document.createElement("section");
    home.id = "canvasProjectHome";
    home.className = "canvas-project-home";
    home.innerHTML = `<header class="project-home-head"><div><span class="project-home-eyebrow">漫剧工作台</span><h1>我的画布项目</h1><p>先选一个项目，再进入不受对话布局打扰的无限画布。</p></div><button type="button" class="v2-primary" data-v2-new-project>＋ 开始创作</button></header><section><div class="project-grid-head"><h2>最近项目</h2><span id="v2ProjectCount"></span></div><div id="v2ProjectGrid" class="project-grid"></div></section>`;
    const left = document.createElement("aside");
    left.id = "canvasV2Left";
    left.className = "canvas-v2-left";
    left.innerHTML = `<div class="v2-left-head"><button type="button" class="v2-project-back" data-v2-back-home title="返回项目">${icon("caret-left")}</button><div><strong id="v2CanvasTitle">画布</strong><span id="v2CanvasMeta">0 个元素</span></div></div><div class="v2-tabs"><button type="button" data-v2-tab="nodes" class="active">画布</button><button type="button" data-v2-tab="assets">资产</button></div><div id="v2LeftContent" class="v2-left-content"></div><footer class="v2-left-footer"><button id="canvasV2ToggleLeft" type="button" class="v2-left-collapse" title="收起画布侧栏">${icon("sidebar-simple")}</button><span id="v2CanvasNodeCount">共 0 节点</span></footer>`;
    const utility = document.createElement("div");
    utility.id = "canvasV2UtilityDock";
    utility.className = "canvas-v2-utility-dock";
    utility.hidden = true;
    utility.innerHTML = `<button type="button" data-v2-expand-left title="展开左侧面板">${icon("sidebar-simple")}<span>资产管理</span></button>`;
    const dock = document.createElement("div");
    dock.id = "canvasV2Dock";
    dock.className = "canvas-v2-dock";
    dock.innerHTML = `<div class="v2-add-wrap"><button type="button" class="v2-dock-icon v2-dock-add" data-v2-toggle-add aria-label="添加" title="添加">${icon("plus")}</button><div id="v2AddPalette" class="v2-add-palette" hidden></div></div><div class="v2-interaction-wrap"><button type="button" class="v2-dock-icon" data-v2-toggle-interaction aria-label="移动选择" title="移动选择">${interactionIcon("select")}</button><div id="v2InteractionPalette" class="v2-interaction-palette" hidden></div></div><span></span><button type="button" class="v2-dock-icon" data-v2-open-assets-kind="person" aria-label="角色资产库" title="角色资产库">${icon("user")}</button><button type="button" class="v2-dock-icon" data-v2-open-assets-kind="item" aria-label="物品资产库" title="物品资产库">${icon("diamond")}</button><button type="button" class="v2-dock-icon" data-v2-open-assets-kind="scene" aria-label="场景资产库" title="场景资产库">${icon("house-line")}</button><button type="button" class="v2-dock-icon" data-v2-open-generated-history aria-label="生成历史" title="生成历史">${icon("clock-counter-clockwise")}</button><button type="button" class="v2-dock-icon" data-v2-shortcuts aria-label="快捷键" title="快捷键">${icon("keyboard")}</button><span></span><button type="button" class="v2-dock-icon" data-v2-media-settings aria-label="模型 API 配置" title="模型 API 配置">${icon("gear-six")}</button>`;
    const inspector = document.createElement("aside");
    inspector.id = "canvasMediaInspector";
    inspector.className = "canvas-media-inspector";
    inspector.hidden = true;
    const mediaTool = document.createElement("section");
    mediaTool.id = "canvasMediaTool";
    mediaTool.className = "canvas-media-tool";
    mediaTool.hidden = true;
    const mediaModelPicker = document.createElement("div");
    mediaModelPicker.id = "canvasMediaModelPicker";
    mediaModelPicker.className = "canvas-media-model-picker";
    mediaModelPicker.hidden = true;
    const assetEditor = document.createElement("aside");
    assetEditor.id = "canvasAssetEditor";
    assetEditor.className = "canvas-media-inspector canvas-asset-editor";
    assetEditor.hidden = true;
    const assetLibrary = document.createElement("section");
    assetLibrary.id = "canvasAssetLibrary";
    assetLibrary.className = "canvas-asset-library";
    assetLibrary.hidden = true;
    const historyLibrary = document.createElement("section");
    historyLibrary.id = "canvasGeneratedHistory";
    historyLibrary.className = "canvas-asset-library canvas-generated-history";
    historyLibrary.hidden = true;
    const shortcuts = document.createElement("section");
    shortcuts.id = "canvasV2Shortcuts";
    shortcuts.className = "canvas-asset-library canvas-v2-shortcuts";
    shortcuts.hidden = true;
    const quickAdd = document.createElement("div");
    quickAdd.id = "canvasV2QuickAdd";
    quickAdd.className = "v2-quick-add";
    quickAdd.hidden = true;
    const viewTools = document.querySelector(".canvas-view-tools");
    if (viewTools) utility.append(viewTools);
    shell.append(home, left, utility, dock, inspector, mediaTool, mediaModelPicker, assetEditor, assetLibrary, historyLibrary, shortcuts, quickAdd);
    shell.addEventListener("click", handleClick);
  }

  async function loadCatalog() {
    if (!catalog) catalog = await app().api("/api/media/models");
    return catalog;
  }

  async function loadAssets() {
    if (!canvas()) return [];
    const result = await app().api(`/api/assets?canvasId=${encodeURIComponent(canvas().id)}`);
    assets = result.assets || [];
    return assets;
  }

  function showHome() {
    ensureChrome();
    if (!document.body.classList.contains("canvas-v2-mode")) return;
    app()?.clearCanvasRoute?.();
    document.body.classList.remove("canvas-v2-workspace");
    document.body.classList.remove("canvas-v2-left-collapsed");
    $("canvasProjectHome").hidden = false;
    $("canvasStage").hidden = true;
    document.querySelector(".canvas-view-tools").hidden = true;
    $("canvasMiniMap").hidden = true;
    $("canvasV2Left").hidden = true;
    $("canvasV2UtilityDock").hidden = true;
    $("canvasV2Dock").hidden = true;
    $("canvasMediaInspector").hidden = true;
    $("canvasMediaTool").hidden = true;
    $("canvasAssetLibrary").hidden = true;
    $("canvasGeneratedHistory").hidden = true;
    renderProjects();
  }

  function openWorkspace() {
    ensureChrome();
    document.body.classList.add("canvas-v2-workspace");
    $("canvasProjectHome").hidden = true;
    $("canvasStage").hidden = false;
    document.querySelector(".canvas-view-tools").hidden = false;
    $("canvasV2Left").hidden = false;
    setLeftCollapsed(false);
    $("canvasV2Dock").hidden = false;
    renderWorkspace();
  }

  function renderProjects() {
    const list = app()?.state.canvases || [];
    const grid = $("v2ProjectGrid");
    if (!grid) return;
    $("v2ProjectCount").textContent = `${list.length} 个项目`;
    grid.innerHTML = `<button type="button" class="project-card project-card-new" data-v2-new-project><b>＋</b><span>开始创作</span><small>新建画布项目</small></button>${list.map((item) => `<button type="button" class="project-card" data-v2-open-project="${esc(item.id)}"><span class="project-card-preview">${Number(item.nodeCount || 0) ? "✦" : "＋"}</span><strong>${esc(item.title || "未命名项目")}</strong><small>${Number(item.nodeCount || 0)} 个元素 · ${item.archivedAt ? "已归档" : "可编辑"}</small></button>`).join("")}`;
  }

  function renderWorkspace() {
    const active = canvas();
    if (!active) return;
    $("v2CanvasTitle").textContent = active.title || "未命名项目";
    $("v2CanvasMeta").textContent = `${currentNodes().length} 个元素`;
    $("v2CanvasNodeCount").textContent = `共 ${currentNodes().length} 节点`;
    renderLeft();
    renderAddPalette();
    renderInteractionPalette();
  }

  function renderLeft() {
    const target = $("v2LeftContent");
    if (!target) return;
    if (activeTab === "assets") {
      target.innerHTML = `<div class="v2-asset-toolbar"><button type="button" class="v2-primary small" data-v2-create-asset>＋ 新建资产</button><button type="button" data-v2-import-asset>导入</button><input id="v2AssetImportFile" type="file" accept="application/json" hidden></div><div id="v2AssetList" class="v2-asset-list"><p class="v2-muted">正在读取资产…</p></div>`;
      loadAssets().then(renderAssets).catch((error) => { const list = $("v2AssetList"); if (list) list.innerHTML = `<p class="v2-error">${esc(error.message)}</p>`; });
      return;
    }
    const nodes = currentNodes();
    target.innerHTML = nodes.length ? `<div class="v2-node-toolbar"><span>画布元素</span><small>${nodes.length}</small></div><div class="v2-node-list">${nodes.map((node) => `<button type="button" data-v2-focus-node="${esc(node.id)}"><span class="v2-node-thumb ${esc(node.type)}">${icon(nodeIconNames[node.type] || "square")}</span><span><strong>${esc(node.title || "未命名元素")}</strong><small>${esc(node.type === "label" ? "备注" : ({ novel: "小说", script: "剧本", storyboard: "分镜脚本", image: "图片", video: "视频", audio: "音频" }[node.type] || "元素"))}</small></span><i class="ph ph-crosshair-simple v2-row-action" aria-hidden="true"></i></button>`).join("")}</div>` : `<div class="v2-empty"><b>画布还是空的</b><span>从底部“添加”放入文本、图片、视频或音频元素。</span></div>`;
  }

  function assetKindDefinitions() {
    return [{ id: "person", label: "角色", icon: "user", hint: "人物三视图、表情与声音参考" }, { id: "item", label: "物品", icon: "diamond", hint: "三视图、局部与材质细节" }, { id: "scene", label: "场景", icon: "house-line", hint: "俯视图、3D 效果与场景参考" }];
  }

  function renderAssets() {
    const list = $("v2AssetList");
    if (!list) return;
    const kinds = assetKindDefinitions();
    const card = (asset) => `<article class="v2-asset-card"><div><span class="asset-scope">${asset.scope === "global" ? "全局" : "项目"}</span></div><strong>${esc(asset.title)}</strong><small>${asset.elements.length} 个元素</small><div class="v2-asset-actions"><button type="button" data-v2-edit-asset="${esc(asset.id)}">编辑</button><button type="button" data-v2-export-asset="${esc(asset.id)}">导出</button>${asset.scope === "project" ? `<button type="button" data-v2-promote-asset="${esc(asset.id)}">提升全局</button>` : ""}</div></article>`;
    const visibleKinds = activeAssetKind ? kinds.filter((kind) => kind.id === activeAssetKind) : kinds;
    list.innerHTML = visibleKinds.map((kind) => {
      const entries = assets.filter((asset) => asset.kind === kind.id);
      return `<section class="v2-asset-group"><header><span>${icon(kind.icon)}</span><strong>${kind.label}</strong><small>${entries.length}</small></header>${entries.length ? entries.map(card).join("") : `<p class="v2-asset-empty">${kind.hint}</p>`}</section>`;
    }).join("");
  }

  function renderAddPalette() {
    const palette = $("v2AddPalette");
    if (!palette) return;
    const entries = [["novel", "小说"], ["script", "剧本"], ["storyboard", "分镜脚本"], ["label", "备注"], ["image", "图片"], ["video", "视频"], ["audio", "音频"]];
    palette.innerHTML = `<h4>添加节点</h4>${entries.map(([type, label]) => `<button type="button" data-v2-add-node="${type}"><b>${icon(nodeIconNames[type])}</b><span>${label}</span></button>`).join("")}<div class="v2-palette-divider"></div><h4>添加资源</h4><button type="button" data-v2-create-asset><b>${icon("plus-circle")}</b><span>新建资产</span></button><button type="button" data-v2-open-generated-history><b>${icon("clock-counter-clockwise")}</b><span>从生成历史选择</span></button>`;
  }

  function quickAddMarkup() {
    return `<h4>添加节点</h4>
      <button type="button" data-v2-add-node="label"><b>${icon("text-align-left")}</b><span>文本</span></button>
      <button type="button" data-v2-add-node="image"><b>${icon("image")}</b><span>图片</span></button>
      <button type="button" data-v2-add-node="video"><b>${icon("video")}</b><span>视频</span></button>
      <button type="button" class="v2-quick-muted" disabled><b>${icon("scissors")}</b><span>智能剪辑</span><small>Beta</small></button>
      <button type="button" class="v2-quick-muted" disabled><b>${icon("stack")}</b><span>导演台</span><small class="v2-tag-new">NEW</small></button>
      <button type="button" class="v2-quick-muted" disabled><b>${icon("timer")}</b><span>逐帧拉片</span><small class="v2-tag-model">SD 2.5</small></button>
      <button type="button" data-v2-add-node="audio"><b>${icon("waveform")}</b><span>音频</span></button>
      <button type="button" data-v2-quick-submenu="script"><b>${icon("article")}</b><span>脚本</span><i>${icon("caret-right")}</i></button>
      <button type="button" data-v2-quick-submenu="assets"><b>${icon("shapes")}</b><span>素材库</span><i>${icon("caret-right")}</i></button>
      <h4 class="v2-quick-resource-title">添加资源</h4>
      <button type="button" data-v2-create-asset><b>${icon("upload-simple")}</b><span>上传</span></button>
      <button type="button" data-v2-open-generated-history><b>${icon("clock-counter-clockwise")}</b><span>从生成历史选择</span></button>`;
  }

  function positionQuickAdd(clientPoint) {
    const menu = $("canvasV2QuickAdd");
    const shell = $("canvasShell");
    if (!menu || !shell) return;
    const shellRect = shell.getBoundingClientRect();
    const width = 196;
    const height = 482;
    menu.style.left = `${Math.max(12, Math.min(clientPoint.x - shellRect.left, shellRect.width - width - 12))}px`;
    menu.style.top = `${Math.max(12, Math.min(clientPoint.y - shellRect.top, shellRect.height - height - 12))}px`;
  }

  function openQuickAdd(clientPoint) {
    ensureChrome();
    const menu = $("canvasV2QuickAdd");
    if (!menu) return;
    quickAddPosition = app()?.canvasStagePoint?.(clientPoint.x, clientPoint.y) || null;
    menu.innerHTML = quickAddMarkup();
    menu.hidden = false;
    positionQuickAdd(clientPoint);
  }

  function closeQuickAdd() {
    const menu = $("canvasV2QuickAdd");
    if (menu) menu.hidden = true;
    quickAddPosition = null;
  }

  function interactionIcon(mode) {
    return icon(mode === "pan" ? "hand" : "cursor-click", "v2-interaction-icon");
  }

  function renderInteractionPalette() {
    const palette = $("v2InteractionPalette");
    if (!palette) return;
    const mode = app()?.state.canvasInteractionMode === "pan" ? "pan" : "select";
    palette.innerHTML = `<button type="button" data-v2-set-interaction="select" class="${mode === "select" ? "active" : ""}">${interactionIcon("select")}<b>移动</b><small>V</small></button><button type="button" data-v2-set-interaction="pan" class="${mode === "pan" ? "active" : ""}">${interactionIcon("pan")}<b>抓手工具</b><small>H</small></button>`;
    const trigger = document.querySelector("[data-v2-toggle-interaction]");
    if (trigger) { trigger.classList.toggle("active", mode === "pan"); trigger.title = mode === "pan" ? "抓手工具" : "移动"; trigger.setAttribute("aria-label", mode === "pan" ? "抓手工具" : "移动"); trigger.innerHTML = interactionIcon(mode); }
  }

  function toggleAdd() {
    ensureChrome();
    const palette = $("v2AddPalette");
    const trigger = document.querySelector("[data-v2-toggle-add]");
    if (!palette || !trigger) return;
    $("v2InteractionPalette").hidden = true;
    palette.hidden = !palette.hidden;
    trigger.classList.toggle("active", !palette.hidden);
    trigger.innerHTML = icon(palette.hidden ? "plus" : "x");
  }

  function openShortcuts() {
    ensureChrome();
    renderShortcuts();
    $("canvasV2Shortcuts").hidden = false;
  }

  function assetElementPreview(element) {
    if (element?.mediaType === "image" && element.source) return `<img src="${esc(element.source)}" alt="${esc(element.title || "资产预览")}" />`;
    return `<span class="v2-library-media-icon">${icon(element?.mediaType === "video" ? "play" : element?.mediaType === "audio" ? "music-note" : "image")}</span>`;
  }

  async function openAssetLibrary(kind) {
    ensureChrome();
    const panel = $("canvasAssetLibrary");
    panel.hidden = false;
    panel.dataset.kind = kind;
    await loadAssets();
    const items = assets.filter((asset) => asset.kind === kind);
    panel.dataset.assetId = items[0]?.id || "";
    renderAssetLibrary();
  }

  function renderAssetLibrary() {
    const panel = $("canvasAssetLibrary");
    if (!panel || panel.hidden) return;
    const kind = panel.dataset.kind || "person";
    const definition = assetKindDefinitions().find((item) => item.id === kind) || assetKindDefinitions()[0];
    const items = assets.filter((asset) => asset.kind === kind);
    const selected = items.find((asset) => asset.id === panel.dataset.assetId) || items[0];
    panel.dataset.assetId = selected?.id || "";
    if (!selected) {
      panel.innerHTML = `<div class="v2-library-modal"><header><h2>${definition.label}资产库</h2><button type="button" data-v2-close-asset-library aria-label="关闭">×</button></header><div class="v2-library-empty"><b>还没有${definition.label}资产</b><p>${definition.hint}</p><button type="button" data-v2-open-assets-manager>前往资产管理</button></div></div>`;
      return;
    }
    const previews = (selected.elements || []).slice(0, 4);
    panel.innerHTML = `<div class="v2-library-modal"><header><h2>${definition.label}资产库</h2><button type="button" data-v2-close-asset-library aria-label="关闭">×</button></header><section class="v2-library-feature"><div class="v2-library-feature-title"><strong>${esc(selected.title)}</strong><span>${esc(selected.scope === "global" ? "全局资产" : "项目资产")}</span></div><div class="v2-library-preview-grid">${previews.length ? previews.map((element) => `<figure>${assetElementPreview(element)}<figcaption>${esc(element.title || "参考元素")}</figcaption></figure>`).join("") : `<div class="v2-library-preview-empty">暂无可预览元素</div>`}</div><p>${esc(selected.description || definition.hint)}</p><button type="button" class="v2-library-apply" data-v2-apply-library-asset="${esc(selected.id)}">＋ 应用至画布</button></section><section class="v2-library-list"><div><strong>${definition.label}选择</strong><small>${items.length} 个资产</small></div><div class="v2-library-cards">${items.map((asset) => { const cover = (asset.elements || []).find((element) => element.mediaType === "image" && element.source) || asset.elements?.[0]; return `<button type="button" class="${asset.id === selected.id ? "active" : ""}" data-v2-select-library-asset="${esc(asset.id)}">${cover ? assetElementPreview(cover) : `<span class="v2-library-media-icon">${definition.icon}</span>`}<span>${esc(asset.title)}</span></button>`; }).join("")}</div></section></div>`;
  }

  function generatedHistoryPreview(item) {
    if (item.mediaType === "image") return `<img src="${esc(item.source)}" alt="${esc(item.nodeTitle || "生成图片")}" />`;
    if (item.mediaType === "video") return `<video src="${esc(item.source)}" muted preload="metadata"></video>`;
    return `<span class="v2-library-media-icon">${icon(item.mediaType === "audio" ? "music-note" : "image")}</span>`;
  }

  async function openGeneratedHistory() {
    ensureChrome();
    const panel = $("canvasGeneratedHistory");
    panel.hidden = false;
    const result = await app().api("/api/media/history");
    generatedHistory = result.items || [];
    panel.dataset.historyId = generatedHistory[0]?.id || "";
    renderGeneratedHistory();
  }

  function renderGeneratedHistory() {
    const panel = $("canvasGeneratedHistory");
    if (!panel || panel.hidden) return;
    const counts = { image: 0, video: 0, audio: 0 };
    generatedHistory.forEach((item) => { if (counts[item.mediaType] !== undefined) counts[item.mediaType] += 1; });
    const typedHistory = generatedHistory.filter((item) => item.mediaType === activeHistoryType);
    const selected = typedHistory.find((item) => item.id === panel.dataset.historyId) || typedHistory[0];
    panel.dataset.historyId = selected?.id || "";
    if (!selected) {
      panel.innerHTML = `<div class="v2-library-modal v2-history-modal"><header><h2>历史素材</h2><button type="button" data-v2-close-generated-history aria-label="关闭">${icon("x")}</button></header><nav class="v2-history-tabs">${[["image","图片"],["video","视频"],["audio","音频"]].map(([type,label]) => `<button type="button" class="${type === activeHistoryType ? "active" : ""}" data-v2-history-type="${type}">${label}<span>${counts[type]}</span></button>`).join("")}</nav><div class="v2-history-toolbar"><span>按生成时间排序</span><button type="button">${icon("check-square")} 批量管理</button></div><div class="v2-library-empty"><span class="v2-empty-icon">${icon(activeHistoryType === "video" ? "video" : activeHistoryType === "audio" ? "music-note" : "image")}</span><b>还没有${({image:"图片",video:"视频",audio:"音频"})[activeHistoryType]}素材</b><p>生成完成后的内容会按日期归档，可预览并重新添加到当前画布。</p></div></div>`;
      return;
    }
    const typeLabel = { image: "图片", video: "视频", audio: "音频" }[selected.mediaType] || "媒体";
    panel.innerHTML = `<div class="v2-library-modal v2-history-modal"><header><h2>历史素材</h2><button type="button" data-v2-close-generated-history aria-label="关闭">${icon("x")}</button></header><nav class="v2-history-tabs">${[["image","图片"],["video","视频"],["audio","音频"]].map(([type,label]) => `<button type="button" class="${type === activeHistoryType ? "active" : ""}" data-v2-history-type="${type}">${label}<span>${counts[type]}</span></button>`).join("")}</nav><div class="v2-history-toolbar"><span>最近生成</span><button type="button">${icon("check-square")} 批量管理</button></div><section class="v2-library-feature"><div class="v2-library-feature-title"><strong>${esc(selected.nodeTitle || `历史${typeLabel}`)}</strong><span>${typeLabel}</span></div><div class="v2-history-preview">${generatedHistoryPreview(selected)}</div><p>${esc(selected.prompt || `${selected.canvasTitle || "画布"}中的生成结果`)}</p><div class="v2-history-actions"><button type="button" title="预览">${icon("eye")}</button><button type="button" title="下载">${icon("download-simple")}</button><button type="button" class="v2-library-apply" data-v2-add-history="${esc(selected.id)}">${icon("plus")} 添加到画布</button></div></section><section class="v2-library-list"><div><strong>生成记录</strong><small>${typedHistory.length} 个结果</small></div><div class="v2-library-cards">${typedHistory.map((item) => `<button type="button" class="${item.id === selected.id ? "active" : ""}" data-v2-select-history="${esc(item.id)}">${generatedHistoryPreview(item)}<span>${esc(item.nodeTitle || "未命名结果")}</span></button>`).join("")}</div></section></div>`;
  }

  function renderShortcuts() {
    const panel = $("canvasV2Shortcuts");
    if (!panel) return;
    const groups = [
      ["选择与编辑", [["移动选择", "V"], ["抓手工具", "H"], ["多选节点", "Ctrl + 点击"], ["框选节点", "拖拽空白处"], ["复制", "Ctrl + C"], ["删除", "Delete"]]],
      ["画布与节点", [["定位节点", "双击 / 左侧点击"], ["编辑文本", "双击节点"], ["连接节点", "拖拽连接点"], ["添加节点", "A"], ["适配全部", "F"], ["快捷键", "?"]]],
      ["视图", [["放大", "+"], ["缩小", "−"], ["缩略图", "M"], ["定位选中", "Shift + F"]]],
      ["历史", [["撤销", "Ctrl + Z"], ["重做", "Ctrl + Y"]]],
    ];
    panel.innerHTML = `<div class="v2-shortcut-card"><header><div><h2>快捷键</h2><p>画布常用操作</p></div><button type="button" data-v2-close-shortcuts aria-label="关闭">${icon("x")}</button></header><div class="v2-shortcut-grid">${groups.map(([title, rows]) => `<section><h3>${title}</h3>${rows.map(([label,key]) => `<div><span>${label}</span><kbd>${key}</kbd></div>`).join("")}</section>`).join("")}</div></div>`;
  }

  function modelFor(node, id) { return (catalog?.models?.[node.type] || []).find((model) => model.id === id) || catalog?.models?.[node.type]?.[0]; }
  function selectOptions(values, selected, formatter = (x) => x) { return (values || []).map((value) => { const raw = typeof value === "object" ? value.id : value; return `<option value="${esc(raw)}"${String(raw) === String(selected) ? " selected" : ""}>${esc(formatter(value))}</option>`; }).join(""); }
  function snapshotReferences(assetIds, maxReferences) {
    const selected = new Set(assetIds || []);
    return assets.filter((asset) => selected.has(asset.id)).flatMap((asset) => (asset.elements || []).map((element) => ({ assetId: asset.id, assetTitle: asset.title, elementId: element.id, title: element.title, mediaType: element.mediaType, source: element.source }))).filter((element) => element.source).slice(0, maxReferences || 0);
  }

  async function openMediaInspector(id) {
    ensureChrome();
    const node = mediaNode(id);
    if (!node) return;
    const [, , providerSettings] = await Promise.all([loadCatalog(), loadAssets(), app().api("/api/media/settings")]);
    const config = node.meta?.media || {};
    const model = modelFor(node, config.model);
    const panel = $("canvasMediaInspector");
    const typeLabel = { image: "图片", video: "视频", audio: "音频" }[node.type];
    panel.hidden = false;
    panel.dataset.nodeId = node.id;
    const individual = node.type === "image" ? providerSettings.imageProviders : node.type === "video" ? providerSettings.videoProviders : [];
    const providers = [{ id: "apimart", label: `APIMart 统一 API${providerSettings.apimart?.hasApiKey ? "（已配置）" : "（待配置）"}` }, ...individual.map((item) => ({ id: item.id, label: `${item.label}${item.hasApiKey ? "（已配置）" : "（待配置）"}` }))];
    const task = config.lastTask;
    panel.innerHTML = `<header><div><span>${typeLabel}节点</span><h2>${esc(node.title || "未命名节点")}</h2></div><button type="button" data-v2-close-inspector>×</button></header><div class="media-inspector-body"><label>API 接入<select data-media-field="providerId">${selectOptions(providers, config.providerId || "apimart", (item) => item.label)}</select></label><label>模型<select data-media-field="model">${selectOptions(catalog.models[node.type], config.model, (item) => item.label)}</select></label><label>生成方式<select data-media-field="mode">${selectOptions(model.modes, config.mode, (item) => ({ "text-to-image": "文生图", "image-to-image": "参考图生图", "multi-angle": "多角度", "nine-grid": "九宫格", "text-to-video": "文生视频", "reference-to-video": "全能参考图生视频", "first-last-frame": "首尾帧视频", "text-to-speech": "文本转语音" })[item] || item)}</select></label><label>提示词<textarea data-media-field="prompt" placeholder="描述你要生成的内容">${esc(config.prompt || "")}</textarea></label>${model.ratios ? `<label>比例<select data-media-field="ratio">${selectOptions(model.ratios, config.ratio)}</select></label>` : ""}${model.resolutions ? `<label>清晰度<select data-media-field="resolution">${selectOptions(model.resolutions, config.resolution)}</select></label>` : ""}${model.counts ? `<label>生成数量<select data-media-field="count">${selectOptions(model.counts, config.count, (item) => `${item} 张`)}</select></label>` : ""}${model.durations ? `<label>视频时长<select data-media-field="duration">${selectOptions(model.durations, config.duration, (item) => `${item} 秒`)}</select></label>` : ""}<fieldset><legend>引用资产（最多 ${model.maxReferences || 0} 个）</legend>${assets.length ? assets.map((asset) => `<label class="asset-check"><input type="checkbox" data-media-asset="${esc(asset.id)}" ${config.referenceAssetIds?.includes(asset.id) ? "checked" : ""}/><span>${esc(asset.title)} <small>${asset.elements.length} 个元素</small></span></label>`).join("") : `<p class="v2-muted">还没有可引用资产。请先在资产库中创建。</p>`}</fieldset><p class="media-capability-note">当前模型支持：${esc((model.modes || []).join(" / "))}${model.supportsAudioReference ? "；支持声音参考" : ""}${config.referenceSnapshot?.length ? `；已冻结 ${config.referenceSnapshot.length} 个引用元素` : ""}</p>${task ? `<p class="media-task-state">最近任务：${esc(task.status || "submitted")} ${task.message ? `· ${esc(task.message)}` : ""}</p>` : ""}<div class="media-inspector-actions"><button type="button" data-v2-save-media class="v2-primary">保存节点配置</button><button type="button" data-v2-run-media>开始生成</button>${task?.taskId ? `<button type="button" data-v2-refresh-task>刷新任务</button>` : ""}</div><p id="v2MediaRunState" class="v2-muted"></p></div>`;
  }

  const imageModelPresentation = {
    "seedream-5.0-pro": { seconds: "20s", note: "交互式编辑、中文排版与多图一致性" },
    "gpt-image-2": { seconds: "50s", note: "高质量图片生成与编辑，语义理解强" },
    "qwen-image-2.0": { seconds: "30s", note: "中文文字排版与多图生成" },
  };

  async function openMediaModelPicker(id, anchor = null) {
    const node = mediaNode(id);
    if (!node) return;
    await loadCatalog();
    const models = catalog?.models?.[node.type] || [];
    const panel = $("canvasMediaModelPicker");
    const selected = node.meta?.media?.model || models[0]?.id || "";
    panel.dataset.nodeId = node.id;
    panel.innerHTML = models.map((model) => {
      const presentation = imageModelPresentation[model.id] || { seconds: "", note: (model.modes || []).join(" · ") };
      return `<button type="button" class="canvas-model-option${model.id === selected ? " selected" : ""}" data-v2-select-media-model="${esc(model.id)}"><span class="canvas-model-icon">${icon(node.type === "image" ? "sparkle" : "play")}</span><span class="canvas-model-copy"><b>${esc(model.label)}</b>${presentation.note ? `<small>${esc(presentation.note)}</small>` : ""}</span>${presentation.seconds ? `<em>${esc(presentation.seconds)}</em>` : ""}</button>`;
    }).join("");
    panel.hidden = false;
    const width = 370;
    const viewportPadding = 12;
    const left = Math.min(window.innerWidth - width - viewportPadding, Math.max(viewportPadding, Number(anchor?.left || (window.innerWidth - width) / 2)));
    panel.style.left = `${left}px`;
    panel.style.top = "auto";
    panel.style.bottom = "auto";
    const measuredHeight = Math.min(410, Math.max(120, panel.scrollHeight));
    const anchorTop = Number(anchor?.top || window.innerHeight / 2);
    if (anchorTop > measuredHeight + 24) panel.style.top = `${Math.max(viewportPadding, anchorTop - measuredHeight - 8)}px`;
    else panel.style.top = `${Math.min(window.innerHeight - measuredHeight - viewportPadding, Number(anchor?.bottom || anchorTop) + 8)}px`;
  }

  async function selectMediaModel(id, modelId) {
    const node = mediaNode(id);
    if (!node) return;
    await loadCatalog();
    const model = modelFor(node, modelId);
    if (!model) return;
    const current = node.meta?.media || {};
    const pickSupported = (values, currentValue) => (values || []).map(String).includes(String(currentValue)) ? currentValue : values?.[0];
    node.meta = { ...(node.meta || {}), media: {
      ...current,
      model: model.id,
      modelLabel: model.label,
      mode: pickSupported(model.modes, current.mode),
      ratio: pickSupported(model.ratios, current.ratio),
      resolution: pickSupported(model.resolutions, current.resolution),
      count: pickSupported(model.counts, current.count),
      duration: pickSupported(model.durations, current.duration),
    } };
    await app().saveCurrentCanvas();
    app().renderCanvas();
    renderWorkspace();
    $("canvasMediaModelPicker").hidden = true;
  }

  function mediaToolDefinitions(node) {
    return node.type === "image"
      ? {
          mark: ["标记", "在画布中框选并标记需要保留、调整或忽略的区域。"],
          style: ["风格", "从风格预设或项目资产中选择画面风格参考。"],
          focus: ["聚焦", "选择主体区域，生成时优先保持主体与构图。"],
        }
      : {
          effects: ["特效", "选择可用于当前视频节点的动态特效。"],
          characters: ["角色库", "从全局或项目角色资产中选择，引用时冻结为当前画布快照。"],
          camera: ["运镜", "选择推、拉、摇、移、环绕等镜头运动。"],
        };
  }

  async function openReferencePicker(id, kind = "") {
    const node = mediaNode(id);
    if (!node) return;
    await loadAssets();
    const panel = $("canvasMediaTool");
    const candidates = assets.filter((asset) => !kind || asset.kind === kind).flatMap((asset) => (asset.elements || []).filter((element) => element.source).map((element) => ({ ...element, assetId: asset.id, assetTitle: asset.title })));
    panel.hidden = false;
    panel.dataset.nodeId = id;
    panel.innerHTML = `<div class="canvas-reference-picker"><header><div><span>${kind === "person" ? "选择角色参考" : "从资产库添加参考"}</span><h2>${esc(node.title || "媒体节点")}</h2></div><button type="button" data-v2-close-media-tool aria-label="关闭">${icon("x")}</button></header><div class="canvas-reference-grid">${candidates.length ? candidates.map((item) => `<button type="button" data-v2-pick-reference="${esc(item.assetId)}" title="${esc(item.title || item.assetTitle)}">${item.mediaType === "image" ? `<img src="${esc(item.source)}" alt="" />` : `<span>${icon(item.mediaType === "video" ? "play" : "music-note")}</span>`}<b>${esc(item.title || item.assetTitle)}</b><small>${esc(item.assetTitle)}</small></button>`).join("") : `<div class="v2-library-empty"><span class="v2-empty-icon">${icon(kind === "person" ? "user" : "image")}</span><b>${kind === "person" ? "暂无角色资产" : "暂无可引用素材"}</b><p>先在角色、物品或场景资产库中添加参考元素。</p></div>`}</div><footer><button type="button" data-v2-close-media-tool>取消</button><button type="button" data-v2-open-assets-kind="${kind || "person"}" class="v2-primary">打开资产库</button></footer></div>`;
  }

  function openMediaTool(id, action) {
    const node = mediaNode(id);
    if (!node) return;
    if (action === "characters") { openReferencePicker(id, "person"); return; }
    const [title, description] = mediaToolDefinitions(node)[action] || ["节点工具", "配置当前媒体节点。"];
    const panel = $("canvasMediaTool");
    const choices = action === "camera" ? ["固定", "缓推", "拉远", "平移", "环绕"] : action === "effects" ? ["光影", "粒子", "转场", "速度", "氛围"] : action === "style" ? ["写实", "电影感", "动漫", "国风", "概念设计"] : action === "mark" ? ["保留区域", "重绘区域", "移除区域"] : action === "focus" ? ["人物主体", "前景", "背景", "构图中心"] : [];
    panel.hidden = false;
    panel.dataset.nodeId = id;
    panel.dataset.mediaAction = action;
    panel.innerHTML = `<div class="canvas-media-tool-card"><header><div><span>${esc(node.type === "image" ? "图片节点" : "视频节点")}</span><h2>${esc(title)}</h2></div><button type="button" data-v2-close-media-tool aria-label="关闭">${icon("x")}</button></header><p>${esc(description)}</p>${choices.length ? `<div class="canvas-tool-choices">${choices.map((choice) => `<button type="button" data-v2-media-tool-value="${esc(choice)}">${esc(choice)}</button>`).join("")}</div>` : `<div class="v2-library-empty"><span class="v2-empty-icon">${icon("crosshair-simple")}</span><b>从画布或资产库中选择</b><p>选择后会回到当前节点，不会切换离开画布。</p></div>`}<footer><button type="button" data-v2-close-media-tool>完成</button></footer></div>`;
  }

  async function applyMediaQuickMode(id, mode) {
    const node = mediaNode(id);
    if (!node) return;
    if (mode === "upscale") {
      await openReferencePicker(id, "image");
      return;
    }
    const mapped = mode === "long-video" ? "text-to-video" : mode;
    node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), mode: mapped, ...(mode === "long-video" ? { duration: 300 } : {}) } };
    await app().saveCurrentCanvas();
    app().renderCanvas();
    renderWorkspace();
    if (mapped === "image-to-image") await openReferencePicker(id, "image");
  }

  async function runMediaNode(id) {
    await openMediaInspector(id);
    await saveMediaInspector({ run: true });
  }

  async function saveMediaInspector({ run = false } = {}) {
    const panel = $("canvasMediaInspector"); const node = mediaNode(panel?.dataset.nodeId);
    if (!node) return;
    const value = Object.fromEntries([...panel.querySelectorAll("[data-media-field]")].map((field) => [field.dataset.mediaField, field.value]));
    value.referenceAssetIds = [...panel.querySelectorAll("[data-media-asset]:checked")].map((field) => field.dataset.mediaAsset);
    value.referenceSnapshot = snapshotReferences(value.referenceAssetIds, modelFor(node, value.model)?.maxReferences || 0);
    node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), ...value } };
    node.content = value.prompt;
    await app().saveCurrentCanvas();
    app().renderCanvas(); renderWorkspace();
    if (!run) { $("v2MediaRunState").textContent = "节点配置已保存。"; return; }
    const result = await app().api("/api/media/tasks", { method: "POST", body: JSON.stringify({ canvasId: canvas().id, nodeId: node.id }) });
    await app().loadCanvas(canvas().id);
    $("v2MediaRunState").textContent = result.message || "任务已提交。";
  }

  async function refreshMediaTask() {
    const node = mediaNode($("canvasMediaInspector")?.dataset.nodeId); if (!node) return;
    const result = await app().api("/api/media/tasks/status", { method: "POST", body: JSON.stringify({ canvasId: canvas().id, nodeId: node.id }) });
    await app().loadCanvas(canvas().id); await openMediaInspector(node.id);
    $("v2MediaRunState").textContent = result.message || "任务状态已刷新。";
  }

  function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); }); }

  async function editAsset(id = "") {
    await loadAssets(); const existing = assets.find((item) => item.id === id) || {};
    const panel = $("canvasAssetEditor"); panel.hidden = false; panel.dataset.assetId = existing.id || "";
    panel.innerHTML = `<header><div><span>${existing.id ? "编辑资产" : "新建资产"}</span><h2>${esc(existing.title || "未命名资产")}</h2></div><button type="button" data-v2-close-asset-editor>×</button></header><div class="media-inspector-body"><label>名称<input id="v2AssetTitle" value="${esc(existing.title || "")}" placeholder="如：男主角 / 客厅场景" /></label><label>类型<select id="v2AssetKind"><option value="person"${existing.kind === "person" ? " selected" : ""}>人物</option><option value="item"${existing.kind === "item" ? " selected" : ""}>物品</option><option value="scene"${existing.kind === "scene" ? " selected" : ""}>场景</option></select></label><label>范围<select id="v2AssetScope"><option value="project"${existing.scope !== "global" ? " selected" : ""}>项目资产（当前画布）</option><option value="global"${existing.scope === "global" ? " selected" : ""}>全局资产（可跨项目引用）</option></select></label><label>说明<textarea id="v2AssetDescription" placeholder="写下外观、用途或一致性要求">${esc(existing.description || "")}</textarea></label><label>新增元素<input id="v2AssetFiles" type="file" multiple accept="image/*,audio/*,video/*" /><small class="v2-muted">可一次加入三视图、表情图、声音参考、细节图或场景参考。</small></label><div class="v2-existing-elements">${(existing.elements || []).length ? existing.elements.map((element) => `<span>${esc(element.title)} · ${esc(element.mediaType)}</span>`).join("") : `<p class="v2-muted">尚未添加元素</p>`}</div><div class="media-inspector-actions"><button type="button" class="v2-primary" data-v2-save-asset>保存资产</button>${existing.id ? `<button type="button" data-v2-delete-asset>删除</button>` : ""}</div><p id="v2AssetState" class="v2-muted"></p></div>`;
  }

  async function saveAssetEditor() {
    const panel = $("canvasAssetEditor"); const existing = assets.find((item) => item.id === panel.dataset.assetId) || {};
    const files = [...($("v2AssetFiles")?.files || [])]; const state = $("v2AssetState"); state.textContent = "保存中…";
    const incoming = await Promise.all(files.map(async (file) => ({ title: file.name, role: "reference", mediaType: file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "image", source: await fileToDataUrl(file) })));
    await app().api("/api/assets", { method: "POST", body: JSON.stringify({ ...existing, title: $("v2AssetTitle").value, kind: $("v2AssetKind").value, scope: $("v2AssetScope").value, canvasId: $("v2AssetScope").value === "project" ? canvas().id : "", description: $("v2AssetDescription").value, elements: [...(existing.elements || []), ...incoming] }) });
    await loadAssets(); renderAssets(); panel.hidden = true;
  }

  function downloadJson(filename, value) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }

  async function importAsset(file) { const text = await file.text(); const pack = JSON.parse(text); await app().api("/api/assets/import", { method: "POST", body: JSON.stringify({ pack, canvasId: canvas().id, scope: "project" }) }); await loadAssets(); renderAssets(); }

  async function handleClick(event) {
    if ($("canvasV2QuickAdd") && !$("canvasV2QuickAdd").hidden && !event.target.closest("#canvasV2QuickAdd")) closeQuickAdd();
    const target = event.target.closest("button, [data-v2-tab]"); if (!target) return;
    if (target.matches("[data-v2-new-project]")) { await app().newCanvas(); return; }
    if (target.matches("[data-v2-open-project]")) { await app().loadCanvas(target.dataset.v2OpenProject); openWorkspace(); return; }
    if (target.matches("[data-v2-back-home]")) { showHome(); return; }
    if (target.matches("[data-v2-tab]")) { activeAssetKind = ""; setActiveTab(target.dataset.v2Tab); renderLeft(); return; }
    if (target.matches("[data-v2-focus-node]")) { app().centerCanvasOnNode(target.dataset.v2FocusNode); return; }
    if (target.matches("[data-v2-toggle-add]")) { toggleAdd(); return; }
    if (target.matches("[data-v2-toggle-interaction]")) { const palette = $("v2InteractionPalette"); $("v2AddPalette").hidden = true; palette.hidden = !palette.hidden; return; }
    if (target.matches("[data-v2-set-interaction]")) { app()?.setCanvasInteractionMode?.(target.dataset.v2SetInteraction); $("v2InteractionPalette").hidden = true; renderInteractionPalette(); return; }
    if (target.matches("[data-v2-add-node]")) { const position = target.closest("#canvasV2QuickAdd") ? quickAddPosition : null; $("v2AddPalette").hidden = true; closeQuickAdd(); const addTrigger = document.querySelector("[data-v2-toggle-add]"); if (addTrigger) { addTrigger.classList.remove("active"); addTrigger.innerHTML = icon("plus"); } await app().addNodeToCanvas(target.dataset.v2AddNode, position); renderWorkspace(); return; }
    if (target.matches('[data-v2-quick-submenu="script"]')) { closeQuickAdd(); toggleAdd(); return; }
    if (target.matches('[data-v2-quick-submenu="assets"]')) { closeQuickAdd(); await openAssetLibrary("person"); return; }
    if (target.matches("[data-v2-open-assets-kind]")) { await openAssetLibrary(target.dataset.v2OpenAssetsKind); return; }
    if (target.matches("[data-v2-open-assets-manager]")) {
      $("canvasAssetLibrary").hidden = true;
      $("canvasGeneratedHistory").hidden = true;
      activeAssetKind = "";
      setActiveTab("assets");
      $("canvasV2Left").hidden = false;
      setLeftCollapsed(false);
      renderLeft();
      return;
    }
    if (target.matches("[data-v2-open-generated-history]")) { $("v2AddPalette").hidden = true; const addTrigger = document.querySelector("[data-v2-toggle-add]"); if (addTrigger) { addTrigger.classList.remove("active"); addTrigger.innerHTML = icon("plus"); } await openGeneratedHistory(); return; }
    if (target.matches("[data-v2-history-type]")) { activeHistoryType = target.dataset.v2HistoryType; $("canvasGeneratedHistory").dataset.historyId = ""; renderGeneratedHistory(); return; }
    if (target.matches("[data-v2-shortcuts]")) { openShortcuts(); return; }
    if (target.matches("[data-v2-close-shortcuts]")) { $("canvasV2Shortcuts").hidden = true; return; }
    if (target.matches("[data-v2-expand-left]")) { setLeftCollapsed(false); renderLeft(); return; }
    if (target.matches("[data-v2-media-settings]")) { app().openSettings("media"); return; }
    if (target.matches("#canvasV2ToggleLeft")) { setLeftCollapsed(!$("canvasV2Left").classList.contains("collapsed")); return; }
    if (target.matches("[data-v2-close-inspector]")) { $("canvasMediaInspector").hidden = true; return; }
    if (target.matches("[data-v2-close-media-tool]")) { $("canvasMediaTool").hidden = true; return; }
    if (target.matches("[data-v2-select-media-model]")) { await selectMediaModel($("canvasMediaModelPicker").dataset.nodeId, target.dataset.v2SelectMediaModel); return; }
    if (target.matches("[data-v2-pick-reference]")) {
      const node = mediaNode($("canvasMediaTool").dataset.nodeId);
      if (!node) return;
      const assetId = target.dataset.v2PickReference;
      const ids = Array.from(new Set([...(node.meta?.media?.referenceAssetIds || []), assetId]));
      const maxReferences = modelFor(node, node.meta?.media?.model)?.maxReferences || 0;
      node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), referenceAssetIds: ids, referenceSnapshot: snapshotReferences(ids, maxReferences) } };
      await app().saveCurrentCanvas(); app().renderCanvas(); renderWorkspace(); $("canvasMediaTool").hidden = true; return;
    }
    if (target.matches("[data-v2-media-tool-value]")) {
      const panel = $("canvasMediaTool"); const node = mediaNode(panel.dataset.nodeId);
      if (!node) return;
      const action = panel.dataset.mediaAction; const value = target.dataset.v2MediaToolValue;
      node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), [action]: value } };
      await app().saveCurrentCanvas(); app().renderCanvas(); renderWorkspace(); panel.hidden = true; return;
    }
    if (target.matches("[data-v2-close-asset-editor]")) { $("canvasAssetEditor").hidden = true; return; }
    if (target.matches("[data-v2-close-asset-library]")) { $("canvasAssetLibrary").hidden = true; return; }
    if (target.matches("[data-v2-close-generated-history]")) { $("canvasGeneratedHistory").hidden = true; return; }
    if (target.matches("[data-v2-select-library-asset]")) { $("canvasAssetLibrary").dataset.assetId = target.dataset.v2SelectLibraryAsset; renderAssetLibrary(); return; }
    if (target.matches("[data-v2-apply-library-asset]")) { const selected = assets.find((asset) => asset.id === target.dataset.v2ApplyLibraryAsset); if (selected) { await app()?.addAssetToCanvas?.(selected); $("canvasAssetLibrary").hidden = true; renderWorkspace(); } return; }
    if (target.matches("[data-v2-select-history]")) { $("canvasGeneratedHistory").dataset.historyId = target.dataset.v2SelectHistory; renderGeneratedHistory(); return; }
    if (target.matches("[data-v2-add-history]")) { const selected = generatedHistory.find((item) => item.id === target.dataset.v2AddHistory); if (selected) { await app()?.addGeneratedMediaToCanvas?.(selected); $("canvasGeneratedHistory").hidden = true; renderWorkspace(); } return; }
    if (target.matches("[data-v2-save-media]")) { await saveMediaInspector(); return; }
    if (target.matches("[data-v2-run-media]")) { await saveMediaInspector({ run: true }); return; }
    if (target.matches("[data-v2-refresh-task]")) { await refreshMediaTask(); return; }
    if (target.matches("[data-v2-create-asset]")) { $("v2AddPalette").hidden = true; const addTrigger = document.querySelector("[data-v2-toggle-add]"); if (addTrigger) { addTrigger.classList.remove("active"); addTrigger.innerHTML = icon("plus"); } await editAsset(); return; }
    if (target.matches("[data-v2-edit-asset]")) { await editAsset(target.dataset.v2EditAsset); return; }
    if (target.matches("[data-v2-save-asset]")) { await saveAssetEditor(); return; }
    if (target.matches("[data-v2-delete-asset]")) { await app().api("/api/assets/delete", { method: "POST", body: JSON.stringify({ id: $("canvasAssetEditor").dataset.assetId }) }); await loadAssets(); renderAssets(); $("canvasAssetEditor").hidden = true; return; }
    if (target.matches("[data-v2-promote-asset]")) { await app().api("/api/assets/promote", { method: "POST", body: JSON.stringify({ id: target.dataset.v2PromoteAsset }) }); await loadAssets(); renderAssets(); return; }
    if (target.matches("[data-v2-export-asset]")) { const result = await app().api(`/api/assets/export?id=${encodeURIComponent(target.dataset.v2ExportAsset)}`); downloadJson("asset-pack.json", result.pack); return; }
    if (target.matches("[data-v2-import-asset]")) { $("v2AssetImportFile")?.click(); }
  }

  document.addEventListener("change", async (event) => {
    if (event.target.id === "v2AssetImportFile" && event.target.files?.[0]) { try { await importAsset(event.target.files[0]); } catch (error) { window.alert(`导入失败：${error.message}`); } event.target.value = ""; }
    if (event.target.matches?.('[data-media-field="model"]')) {
      const node = mediaNode($("canvasMediaInspector").dataset.nodeId);
      const model = node ? modelFor(node, event.target.value) : null;
      if (node) { node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), model: event.target.value, modelLabel: model?.label || event.target.value } }; await app().saveCurrentCanvas(); }
      openMediaInspector($("canvasMediaInspector").dataset.nodeId);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const picker = $("canvasMediaModelPicker");
    if (!picker || picker.hidden || event.target.closest("#canvasMediaModelPicker") || event.target.closest('[data-media-action="model"]')) return;
    picker.hidden = true;
  });

  window.MbhCanvasV2 = { showHome, openWorkspace, onCanvasLoaded: openWorkspace, openMediaInspector, openMediaModelPicker, openReferencePicker, openMediaTool, applyMediaQuickMode, runMediaNode, refresh: renderWorkspace, toggleAdd, openShortcuts, openQuickAdd };
  // On a direct project URL app.js restores the workspace after loading the
  // project list. Do not race that restoration by immediately clearing the
  // route and showing the picker.
  if (app()?.state.appMode === "canvas" && !new URLSearchParams(window.location.search).get("canvas")) {
    window.setTimeout(showHome, 0);
  }
})();
