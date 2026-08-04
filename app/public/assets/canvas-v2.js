(() => {
  const app = () => window.MbhCanvasApp;
  const $ = (id) => document.getElementById(id);
  const mediaTypes = new Set(["image", "video", "audio"]);
  let catalog = null;
  let assets = [];
  let activeTab = "nodes";

  function esc(value) {
    return app()?.escapeHtml?.(String(value ?? "")) || String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function canvas() { return app()?.state.currentCanvas; }
  function currentNodes() { return canvas()?.nodes || []; }
  function mediaNode(id) { return currentNodes().find((node) => node.id === id && mediaTypes.has(node.type)); }

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
    left.innerHTML = `<div class="v2-left-head"><button type="button" class="v2-project-back" data-v2-back-home title="返回项目">‹</button><div><strong id="v2CanvasTitle">画布</strong><span id="v2CanvasMeta">0 个元素</span></div></div><div class="v2-tabs"><button type="button" data-v2-tab="nodes" class="active">画布元素</button><button type="button" data-v2-tab="assets">资产</button></div><div id="v2LeftContent" class="v2-left-content"></div><button id="canvasV2ToggleLeft" type="button" class="v2-left-collapse" title="收起画布侧栏">‹</button>`;
    const dock = document.createElement("div");
    dock.id = "canvasV2Dock";
    dock.className = "canvas-v2-dock";
    dock.innerHTML = `<div class="v2-add-wrap"><button type="button" data-v2-toggle-add>＋ 添加</button><div id="v2AddPalette" class="v2-add-palette" hidden></div></div><span></span><button type="button" data-v2-open-assets>▦ 资产库</button><button type="button" data-v2-media-settings title="图片和视频 API 配置">⚙ 模型 API</button>`;
    const inspector = document.createElement("aside");
    inspector.id = "canvasMediaInspector";
    inspector.className = "canvas-media-inspector";
    inspector.hidden = true;
    const assetEditor = document.createElement("aside");
    assetEditor.id = "canvasAssetEditor";
    assetEditor.className = "canvas-media-inspector canvas-asset-editor";
    assetEditor.hidden = true;
    shell.append(home, left, dock, inspector, assetEditor);
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
    $("canvasProjectHome").hidden = false;
    $("canvasV2Left").hidden = true;
    $("canvasV2Dock").hidden = true;
    $("canvasMediaInspector").hidden = true;
    renderProjects();
  }

  function openWorkspace() {
    ensureChrome();
    $("canvasProjectHome").hidden = true;
    $("canvasV2Left").hidden = false;
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
    renderLeft();
    renderAddPalette();
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
    target.innerHTML = nodes.length ? `<div class="v2-node-list">${nodes.map((node) => `<button type="button" data-v2-focus-node="${esc(node.id)}"><span class="v2-node-dot ${esc(node.type)}"></span><span><strong>${esc(node.title || "未命名元素")}</strong><small>${esc(node.type === "label" ? "备注" : ({ novel: "小说", script: "剧本", storyboard: "分镜脚本", image: "图片", video: "视频", audio: "音频" }[node.type] || "元素"))}</small></span><i>⌖</i></button>`).join("")}</div>` : `<div class="v2-empty"><b>画布还是空的</b><span>从底部“添加”放入文本、图片、视频或音频元素。</span></div>`;
  }

  function renderAssets() {
    const list = $("v2AssetList");
    if (!list) return;
    if (!assets.length) { list.innerHTML = `<div class="v2-empty"><b>尚未建立资产</b><span>人物、物品、场景都可保存多张参考图、声音或细节图。</span></div>`; return; }
    list.innerHTML = assets.map((asset) => `<article class="v2-asset-card"><div><span class="asset-kind ${esc(asset.kind)}">${({ person: "人物", item: "物品", scene: "场景" })[asset.kind] || "资产"}</span><span class="asset-scope">${asset.scope === "global" ? "全局" : "项目"}</span></div><strong>${esc(asset.title)}</strong><small>${asset.elements.length} 个元素</small><div class="v2-asset-actions"><button type="button" data-v2-edit-asset="${esc(asset.id)}">编辑</button><button type="button" data-v2-export-asset="${esc(asset.id)}">导出</button>${asset.scope === "project" ? `<button type="button" data-v2-promote-asset="${esc(asset.id)}">提升全局</button>` : ""}</div></article>`).join("");
  }

  function renderAddPalette() {
    const palette = $("v2AddPalette");
    if (!palette) return;
    const entries = [["novel", "小说"], ["script", "剧本"], ["storyboard", "分镜脚本"], ["label", "备注"], ["image", "图片生成"], ["video", "视频生成"], ["audio", "音频"]];
    palette.innerHTML = entries.map(([type, label]) => `<button type="button" data-v2-add-node="${type}"><b>${type === "image" ? "▧" : type === "video" ? "▷" : type === "audio" ? "♪" : "＋"}</b><span>${label}</span></button>`).join("");
  }

  function modelFor(node, id) { return (catalog?.models?.[node.type] || []).find((model) => model.id === id) || catalog?.models?.[node.type]?.[0]; }
  function selectOptions(values, selected, formatter = (x) => x) { return (values || []).map((value) => { const raw = typeof value === "object" ? value.id : value; return `<option value="${esc(raw)}"${String(raw) === String(selected) ? " selected" : ""}>${esc(formatter(value))}</option>`; }).join(""); }

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
    panel.innerHTML = `<header><div><span>${typeLabel}节点</span><h2>${esc(node.title || "未命名节点")}</h2></div><button type="button" data-v2-close-inspector>×</button></header><div class="media-inspector-body"><label>API 接入<select data-media-field="providerId">${selectOptions(providers, config.providerId || "apimart", (item) => item.label)}</select></label><label>模型<select data-media-field="model">${selectOptions(catalog.models[node.type], config.model, (item) => item.label)}</select></label><label>生成方式<select data-media-field="mode">${selectOptions(model.modes, config.mode, (item) => ({ "text-to-image": "文生图", "image-to-image": "参考图生图", "multi-angle": "多角度", "nine-grid": "九宫格", "text-to-video": "文生视频", "reference-to-video": "全能参考图生视频", "first-last-frame": "首尾帧视频", "text-to-speech": "文本转语音" })[item] || item)}</select></label><label>提示词<textarea data-media-field="prompt" placeholder="描述你要生成的内容">${esc(config.prompt || "")}</textarea></label>${model.ratios ? `<label>比例<select data-media-field="ratio">${selectOptions(model.ratios, config.ratio)}</select></label>` : ""}${model.resolutions ? `<label>清晰度<select data-media-field="resolution">${selectOptions(model.resolutions, config.resolution)}</select></label>` : ""}${model.counts ? `<label>生成数量<select data-media-field="count">${selectOptions(model.counts, config.count, (item) => `${item} 张`)}</select></label>` : ""}${model.durations ? `<label>视频时长<select data-media-field="duration">${selectOptions(model.durations, config.duration, (item) => `${item} 秒`)}</select></label>` : ""}<fieldset><legend>引用资产（最多 ${model.maxReferences || 0} 个）</legend>${assets.length ? assets.map((asset) => `<label class="asset-check"><input type="checkbox" data-media-asset="${esc(asset.id)}" ${config.referenceAssetIds?.includes(asset.id) ? "checked" : ""}/><span>${esc(asset.title)} <small>${asset.elements.length} 个元素</small></span></label>`).join("") : `<p class="v2-muted">还没有可引用资产。请先在资产库中创建。</p>`}</fieldset><p class="media-capability-note">当前模型支持：${esc((model.modes || []).join(" / "))}${model.supportsAudioReference ? "；支持声音参考" : ""}</p><div class="media-inspector-actions"><button type="button" data-v2-save-media class="v2-primary">保存节点配置</button><button type="button" data-v2-run-media>开始生成</button></div><p id="v2MediaRunState" class="v2-muted"></p></div>`;
  }

  async function saveMediaInspector({ run = false } = {}) {
    const panel = $("canvasMediaInspector"); const node = mediaNode(panel?.dataset.nodeId);
    if (!node) return;
    const value = Object.fromEntries([...panel.querySelectorAll("[data-media-field]")].map((field) => [field.dataset.mediaField, field.value]));
    value.referenceAssetIds = [...panel.querySelectorAll("[data-media-asset]:checked")].map((field) => field.dataset.mediaAsset);
    node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), ...value } };
    node.content = value.prompt;
    await app().saveCurrentCanvas();
    app().renderCanvas(); renderWorkspace();
    if (!run) { $("v2MediaRunState").textContent = "节点配置已保存。"; return; }
    const result = await app().api("/api/media/tasks", { method: "POST", body: JSON.stringify({ canvasId: canvas().id, nodeId: node.id }) });
    $("v2MediaRunState").textContent = result.message || "任务已提交。";
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
    const target = event.target.closest("button, [data-v2-tab]"); if (!target) return;
    if (target.matches("[data-v2-new-project]")) { await app().newCanvas(); return; }
    if (target.matches("[data-v2-open-project]")) { await app().loadCanvas(target.dataset.v2OpenProject); openWorkspace(); return; }
    if (target.matches("[data-v2-back-home]")) { showHome(); return; }
    if (target.matches("[data-v2-tab]")) { activeTab = target.dataset.v2Tab; document.querySelectorAll("[data-v2-tab]").forEach((button) => button.classList.toggle("active", button === target)); renderLeft(); return; }
    if (target.matches("[data-v2-focus-node]")) { app().focusCanvasNodeToViewport(target.dataset.v2FocusNode); return; }
    if (target.matches("[data-v2-toggle-add]")) { const palette = $("v2AddPalette"); palette.hidden = !palette.hidden; return; }
    if (target.matches("[data-v2-add-node]")) { $("v2AddPalette").hidden = true; await app().addNodeToCanvas(target.dataset.v2AddNode); renderWorkspace(); if (mediaTypes.has(target.dataset.v2AddNode)) { const last = currentNodes().at(-1); openMediaInspector(last?.id); } return; }
    if (target.matches("[data-v2-open-assets]")) { activeTab = "assets"; $("canvasV2Left").hidden = false; renderLeft(); return; }
    if (target.matches("[data-v2-media-settings]")) { app().openSettings("media"); return; }
    if (target.matches("#canvasV2ToggleLeft")) { $("canvasV2Left").classList.toggle("collapsed"); return; }
    if (target.matches("[data-v2-close-inspector]")) { $("canvasMediaInspector").hidden = true; return; }
    if (target.matches("[data-v2-close-asset-editor]")) { $("canvasAssetEditor").hidden = true; return; }
    if (target.matches("[data-v2-save-media]")) { await saveMediaInspector(); return; }
    if (target.matches("[data-v2-run-media]")) { await saveMediaInspector({ run: true }); return; }
    if (target.matches("[data-v2-create-asset]")) { await editAsset(); return; }
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
      if (node) { node.meta = { ...(node.meta || {}), media: { ...(node.meta?.media || {}), model: event.target.value } }; await app().saveCurrentCanvas(); }
      openMediaInspector($("canvasMediaInspector").dataset.nodeId);
    }
  });

  window.MbhCanvasV2 = { showHome, openWorkspace, onCanvasLoaded: openWorkspace, openMediaInspector };
  if (app()?.state.appMode === "canvas") window.setTimeout(showHome, 0);
})();
