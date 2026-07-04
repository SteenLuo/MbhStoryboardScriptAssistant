const state = {
  conversations: [],
  currentId: "",
  messages: [],
  contextItem: null,
  theme: "light",
  overviewDrag: null,
  conversationCreatedAt: "",
  pendingAttachments: [],
  composeMode: "",
  currentRunName: "",
  appName: "猫主子漫剧剧本分镜小助手",
  workbenchRunName: "",
  runs: [],
  activeWorkbenchNode: null,
  archiveSelections: [],
  workbenchOpen: false,
  workbenchLoading: false,
  searchTimer: null,
  testedModelConfigSignature: "",
  appMode: "chat",
  trashMode: "chat",
  projects: [],
  projectGroups: [],
  currentProjectId: "no-project",
  collapsedProjectIds: new Set(),
  editingProjectId: "",
  sidebarCollapsed: false,
  sidebarWidth: 260,
  sidebarResize: null,
  canvases: [],
  canvasArchiveItems: [],
  currentCanvasId: "",
  currentCanvas: null,
  activeCanvasNodeId: "",
  selectedCanvasNodeId: "",
  selectedCanvasNodeIds: new Set(),
  selectedCanvasEdgeId: "",
  canvasGroupPrimaryNodeId: "",
  canvasZoom: 1,
  canvasViewportAnimation: null,
  canvasStatusLockUntil: 0,
  canvasMiniMapDrag: null,
  editingCanvasNodeId: "",
  editingCanvasBodyNodeId: "",
  canvasNodeAutosaveTimer: null,
  canvasDrag: null,
  suppressCanvasPlusClick: false,
  suppressCanvasStageClick: false,
  suppressCanvasTitleClick: false,
  pendingEpisodes: null,
  canvasBusy: {},
  canvasDeleteConfirm: null,
  canvasMergeHistoryNodeId: "",
  canvasUndoStack: [],
  canvasRedoStack: [],
  canvasHistoryBaseSnapshot: "",
  canvasHistoryApplying: false,
  notifications: [],
  activeNotificationIndex: 0,
  learningLibrary: null,
  learningLibraryTab: "records",
  pendingLearningCorrection: null,
  viewedLearningFailureIds: new Set(),
  learningFailureCursor: 0,
  storyboardIssueNodeId: "",
};

const $ = (id) => document.getElementById(id);
const themeStorageKey = "mbh-chat-theme";
const hiddenConversationsStorageKey = "mbh-hidden-conversations";
const collapsedProjectsStorageKey = "mbh-collapsed-projects";
const sidebarCollapsedStorageKey = "mbh-sidebar-collapsed";
const sidebarWidthStorageKey = "mbh-sidebar-width";
const chatSkillComposeModes = new Set(["script-hard-issue-review", "script-manju-adaptation-analysis"]);
const composeModeLabels = Object.freeze({
  learning: "技能学习",
  "script-hard-issue-review": "剧本评审",
  "script-manju-adaptation-analysis": "漫剧适配分析",
});
const sidebarMinWidth = 252;
const sidebarMaxWidth = 460;
const newProjectSelectValue = "__new_project__";
const canvasConnectHoldMs = 220;
const canvasConnectMovePx = 6;
const canvasNodeHoldMs = 260;
const canvasNodeMovePx = 5;
const canvasPanHoldMs = 220;
const canvasNodeAutosaveDelayMs = 360;
const canvasSurfaceMinWidth = 100000;
const canvasSurfaceMinHeight = 100000;
const canvasSurfacePadding = 1600;
const canvasOriginX = 50000;
const canvasOriginY = 50000;
const canvasZoomMin = 0.35;
const canvasZoomMax = 8;
const canvasZoomStep = 0.1;
const canvasFitAnimationMs = 280;
const canvasFocusReadableZoom = 1;
const canvasFocusMinReadableZoom = 0.72;
const canvasFocusPadding = 96;
const canvasNodeFocusPadding = 88;
const canvasNodeFocusMaxZoom = 2;
const canvasNodeFocusWidthRatio = 0.48;
const canvasNodeFocusHeightRatio = 0.42;
const canvasHistoryLimit = 80;
const markdownBackgroundSwatches = [
  { color: "", title: "默认背景" },
  { color: "#ff6b6b", title: "红色背景" },
  { color: "#ff9f22", title: "橙色背景" },
  { color: "#ffcf24", title: "黄色背景" },
  { color: "#2bd36a", title: "绿色背景" },
  { color: "#18d0d0", title: "青色背景" },
  { color: "#1aa7e8", title: "蓝色背景" },
  { color: "#c5a3ff", title: "紫色背景" },
  { color: "#ff7cff", title: "洋红背景" },
  { color: "#8a8a8a", title: "灰色背景" },
];
const canvasTypeLabels = {
  novel: "小说",
  script: "剧本",
  storyboard: "分镜脚本",
  label: "标识",
};
const canvasRevisionNodeTypes = new Set(["novel", "script", "storyboard"]);
const canvasMergeNodeTypes = new Set(["novel", "script", "storyboard"]);
const storyboardIssueAutoFixPrompt = [
  "请逐条处理问题清单中已经识别出的全部分镜问题。",
  "每个问题都必须被实际修复，不能只做换行、排版或解释。",
  "请根据问题类型修改对应镜头结构、字段、镜号或台词，并输出完整修改后的分镜全文。",
].join("\n");
const canvasTypeIconPaths = {
  novel: '<path d="M6 5.5c1.7-.9 3.6-.9 5.5 0v12c-1.9-.9-3.8-.9-5.5 0z"/><path d="M18 5.5c-1.7-.9-3.6-.9-5.5 0v12c1.9-.9 3.8-.9 5.5 0z"/><path d="M12 5.5v12"/>',
  script: '<path d="M7 4h9l3 3v13H7z"/><path d="M16 4v4h4"/><path d="M10 11h6"/><path d="M10 14h6"/><path d="M10 17h4"/>',
  storyboard: '<path d="M4 6h16v12H4z"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M4 10h16"/><path d="M4 14h16"/>',
  label: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H18v10.5L12.5 20 5 12.5z"/><circle cx="9" cy="8" r="1.2"/>',
};
const providerDefaults = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat"],
    keyName: "DeepSeek API Key",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.5", "gpt-5"],
    keyName: "OpenAI API Key",
  },
  apimart: {
    label: "APIMart",
    baseUrl: "https://api.apimart.ai/v1",
    models: ["gpt-5.5", "gpt-5", "gpt-5.1", "gpt-5-chat-latest", "gpt-5-mini"],
    keyName: "APIMart API Key",
  },
};
const catImages = {
  light: "/assets/cat-light-calico-cutout.png",
  dark: "/assets/cat-dark-shorthair-cutout.png",
  eye: "/assets/cat-eye-orange-cutout.png",
};
const catAnimationClasses = [
  "cat-anim-hop",
  "cat-anim-wiggle",
  "cat-anim-nod",
  "cat-anim-stretch",
  "cat-anim-peek",
];
const reminderRules = [
  { id: "lunch", hour: 12, minute: 0, text: "到饭点啦，记得吃饭～" },
  { id: "offwork", hour: 18, minute: 0, text: "到下班时间啦，收拾一下回家～" },
];
const legalHolidayDates = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-04-05",
  "2026-05-01",
  "2026-05-02",
  "2026-06-19",
  "2026-09-25",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
]);
const reminderTimers = [];
const textAttachmentExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "srt",
  "ass",
  "log",
  "xml",
  "html",
  "htm",
]);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error || text || "请求失败");
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMessages() {
  const box = $("messages");
  box.innerHTML = "";
  if (!state.messages.length) {
    appendMessage("assistant", "把小说、剧本、分镜或修改意见发给我。我会按 AI 漫剧流程判断该走小说转剧本、剧本评审、直接分镜、样例学习，还是质量回退。", false, "intro");
    renderConversationOverview();
    return;
  }
  state.messages.forEach((message, index) => {
    appendMessage(message.role, message.content, false, index, message.time, message.attachments, message.usage, message.skillRoute, message.chatIntent);
  });
  renderConversationOverview();
  syncOverviewPosition();
  box.scrollTop = box.scrollHeight;
}

function appendMessage(role, content, keep = true, messageIndex = null, time = null, attachments = [], usage = null, skillRoute = null, chatIntent = null) {
  const messageTime = normalizeMessageTime(time);
  if (keep) {
    const nextMessage = { role, content, time: messageTime, attachments };
    if (usage) nextMessage.usage = usage;
    if (skillRoute) nextMessage.skillRoute = skillRoute;
    if (chatIntent) nextMessage.chatIntent = chatIntent;
    state.messages.push(nextMessage);
    messageIndex = state.messages.length - 1;
  }
  const node = document.createElement("article");
  node.className = `message ${role}`;
  if (messageIndex !== null) {
    node.dataset.messageIndex = String(messageIndex);
  }
  if (role === "assistant") {
    node.appendChild(createCatAvatar());
  }
  const body = document.createElement("div");
  body.className = "message-body";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  renderMessageContent(bubble, role, content);
  body.appendChild(bubble);
  renderMessageAttachments(body, attachments);
  const meta = document.createElement("div");
  meta.className = "message-time";
  meta.title = formatMessageTime(messageTime, true);
  const timeNode = document.createElement("span");
  timeNode.textContent = formatMessageTime(messageTime);
  meta.appendChild(timeNode);
  const usageText = formatUsageText(usage);
  if (usageText) {
    const usageNode = document.createElement("span");
    usageNode.className = "message-usage";
    usageNode.textContent = usageText;
    usageNode.title = formatUsageTitle(usage);
    meta.appendChild(usageNode);
  }
  const intentText = formatChatIntent(chatIntent);
  if (intentText) {
    const intentNode = document.createElement("span");
    intentNode.className = "message-intent";
    intentNode.textContent = intentText;
    intentNode.title = formatChatIntentTitle(chatIntent);
    meta.appendChild(intentNode);
  }
  const skillText = formatSkillRoute(skillRoute);
  if (skillText) {
    const skillNode = document.createElement("span");
    skillNode.className = "message-skill";
    skillNode.textContent = skillText;
    skillNode.title = formatSkillRouteTitle(skillRoute);
    meta.appendChild(skillNode);
  }
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "message-copy";
  copy.textContent = "复制";
  copy.title = "复制这条消息";
  copy.addEventListener("click", async () => {
    const ok = await copyText(content || "");
    copy.textContent = ok ? "已复制" : "复制失败";
    window.setTimeout(() => {
      copy.textContent = "复制";
    }, 1200);
  });
  meta.appendChild(copy);
  body.appendChild(meta);
  node.appendChild(body);
  $("messages").appendChild(node);
  $("messages").scrollTop = $("messages").scrollHeight;
  return bubble;
}

async function copyText(text) {
  const value = String(text || "");
  if (!value) return false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to textarea copy for older browser contexts.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function renderMessageContent(bubble, role, content) {
  if (role === "assistant" && window.MbhMarkdown && typeof window.MbhMarkdown.renderMarkdown === "function") {
    bubble.classList.add("markdown-body");
    bubble.innerHTML = window.MbhMarkdown.renderMarkdown(content);
    return;
  }
  bubble.textContent = content;
}

function normalizeMessageTime(time) {
  if (time && !Number.isNaN(new Date(time).getTime())) return time;
  if (state.conversationCreatedAt && !Number.isNaN(new Date(state.conversationCreatedAt).getTime())) {
    return state.conversationCreatedAt;
  }
  return new Date().toISOString();
}

function formatMessageTime(time, withSeconds = false) {
  const date = new Date(normalizeMessageTime(time));
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return withSeconds
    ? `${year}年${month}月${day}日 ${hour}:${minute}:${second}`
    : `${year}年${month}月${day}日 ${hour}:${minute}`;
}

function formatUsageText(usage) {
  if (window.MbhUsage && typeof window.MbhUsage.formatTokenUsage === "function") {
    return window.MbhUsage.formatTokenUsage(usage);
  }
  return "";
}

function formatUsageTitle(usage) {
  if (!usage) return "";
  const prompt = Number(usage.prompt_tokens);
  const completion = Number(usage.completion_tokens);
  const total = Number(usage.total_tokens);
  const parts = [];
  if (Number.isFinite(total)) parts.push(`总计 ${total}`);
  if (Number.isFinite(prompt)) parts.push(`输入 ${prompt}`);
  if (Number.isFinite(completion)) parts.push(`输出 ${completion}`);
  return parts.join("，");
}

function formatSkillRoute(skillRoute) {
  if (!skillRoute) return "";
  return `skill ${skillRoute.name || skillRoute.id || ""}`.trim();
}

function formatSkillRouteTitle(skillRoute) {
  if (!skillRoute) return "";
  const files = Array.isArray(skillRoute.files) ? skillRoute.files.join("；") : "";
  return [skillRoute.path || skillRoute.id || "", files].filter(Boolean).join("｜");
}

function formatChatIntent(chatIntent) {
  if (!chatIntent) return "";
  const names = {
    chat: "闲聊",
    inspiration: "灵感",
    script: "剧本",
    script_analysis: "剧本分析",
    storyboard: "分镜",
    storyboard_analysis: "分镜分析",
    learning: "学习",
  };
  return `intent ${names[chatIntent.intent] || chatIntent.intent || "未知"}`;
}

function formatChatIntentTitle(chatIntent) {
  if (!chatIntent) return "";
  const mode = chatIntent.mode === "skill" ? "专业模式" : "轻量模式";
  return `${mode}${chatIntent.reason ? `｜${chatIntent.reason}` : ""}`;
}

function formatFileSize(size) {
  const value = Number(size || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function isTextAttachment(file) {
  return String(file.type || "").startsWith("text/") || textAttachmentExtensions.has(fileExtension(file.name));
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsText(file, "utf-8");
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

async function attachmentFromFile(file) {
  const image = String(file.type || "").startsWith("image/");
  const attachment = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    kind: image ? "image" : "file",
    extracted: false,
  };
  if (image) {
    attachment.dataUrl = await readFileAsDataUrl(file);
    return attachment;
  }
  if (isTextAttachment(file)) {
    attachment.text = await readFileAsText(file);
    attachment.extracted = true;
    return attachment;
  }
  attachment.dataUrl = await readFileAsDataUrl(file);
  return attachment;
}

async function addPendingFiles(files) {
  const nextFiles = Array.from(files || []);
  if (!nextFiles.length) return;
  for (const file of nextFiles) {
    try {
      state.pendingAttachments.push(await attachmentFromFile(file));
    } catch (error) {
      state.pendingAttachments.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        kind: "file",
        error: error.message,
      });
    }
  }
  renderPendingAttachments();
}

function renderPendingAttachments() {
  const list = $("attachmentList");
  if (!list) {
    updateSendState();
    return;
  }
  list.innerHTML = "";
  list.classList.toggle("empty", !state.pendingAttachments.length);
  for (const attachment of state.pendingAttachments) {
    const item = document.createElement("div");
    item.className = "pending-attachment";
    const name = document.createElement("span");
    name.textContent = attachment.name;
    const meta = document.createElement("small");
    meta.textContent = `${formatFileSize(attachment.size)}${attachment.extracted ? "｜已读取" : attachment.kind === "image" ? "｜图片" : "｜待处理"}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `移除附件 ${attachment.name}`);
    remove.addEventListener("click", () => {
      state.pendingAttachments = state.pendingAttachments.filter((item) => item.id !== attachment.id);
      renderPendingAttachments();
    });
    item.append(name, meta, remove);
    list.appendChild(item);
  }
  updateSendState();
}

function createCatAvatar() {
  const avatar = document.createElement("div");
  avatar.className = "cat-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.innerHTML = `<img class="cat-image" src="${currentCatImage()}" alt="" />`;
  return avatar;
}

function currentCatImage() {
  return catImages[state.theme] || catImages.light;
}

function renderMessageAttachments(container, attachments = []) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  if (!safeAttachments.length) return;
  const list = document.createElement("div");
  list.className = "message-attachments";
  for (const attachment of safeAttachments) {
    const item = document.createElement("div");
    item.className = `message-attachment ${attachment.kind === "image" ? "image" : "file"}`;
    if (attachment.kind === "image" && attachment.dataUrl) {
      const image = document.createElement("img");
      image.src = attachment.dataUrl;
      image.alt = attachment.name || "图片附件";
      item.appendChild(image);
    }
    const meta = document.createElement("div");
    meta.className = "attachment-meta";
    const name = document.createElement("div");
    name.className = "attachment-name";
    name.textContent = attachment.name || "未命名附件";
    const size = document.createElement("div");
    size.className = "attachment-size";
    size.textContent = `${formatFileSize(attachment.size)}${attachment.extracted ? "｜已读取正文" : ""}`;
    meta.append(name, size);
    item.appendChild(meta);
    list.appendChild(item);
  }
  container.appendChild(list);
}

function setComposeMode(mode) {
  state.composeMode = state.composeMode === mode ? "" : mode;
  document.querySelectorAll("[data-compose-mode]").forEach((button) => {
    const active = button.dataset.composeMode === state.composeMode;
    const modeLabel = composeModeLabel(button.dataset.composeMode);
    const label = button.textContent.trim() || modeLabel;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? `${label}，已选中，再次点击取消` : `${label}，点击选中`);
    const learningTitle = active
      ? "已启用技能学习，本条消息会保存到本地学习资料库"
      : "启用后，本条消息用于技能学习并沉淀到本地";
    button.title = button.dataset.composeMode === "learning"
      ? learningTitle
      : active
        ? `${modeLabel}已选中，再次点击取消`
        : `调用${modeLabel}技能`;
  });
  updateSendState();
}

function composeModeLabel(mode) {
  return composeModeLabels[mode] || "技能";
}

function selectedChatSkillRouteId() {
  return chatSkillComposeModes.has(state.composeMode) ? state.composeMode : "";
}

function buildOutgoingText(text) {
  if (window.MbhCompose && typeof window.MbhCompose.buildOutgoingText === "function") {
    return window.MbhCompose.buildOutgoingText(text, state.composeMode);
  }
  return String(text || "").trim();
}

function canSendCurrentCompose(text, attachments) {
  if (window.MbhCompose && typeof window.MbhCompose.canSendCompose === "function") {
    return window.MbhCompose.canSendCompose({ text, attachments, composeMode: state.composeMode });
  }
  return Boolean(String(text || "").trim()) || (Array.isArray(attachments) && attachments.length > 0);
}

function updateSendState() {
  const send = $("sendBtn");
  const input = $("chatInput");
  if (!send || !input) return;
  const canSend = canSendCurrentCompose(input.value, state.pendingAttachments);
  send.disabled = !canSend;
  send.setAttribute("aria-disabled", String(!canSend));
  send.title = canSend ? "发送" : "请输入文字或添加附件后再发送";
}

function autoGrowTextarea() {
  const input = $("chatInput");
  if (!input) return;
  input.style.height = "auto";
  const maxHeight = Math.floor(window.innerHeight * 0.36);
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
}

function renderConversationOverview() {
  const overview = $("conversationOverview");
  const box = $("messages");
  if (!overview || !box) return;
  overview.innerHTML = "";
  const messageNodes = Array.from(box.querySelectorAll(".message[data-message-index]"));
  const overviewMessages = messageNodes
    .map((node) => {
      const bubble = node.querySelector(".bubble");
      return {
        index: node.dataset.messageIndex,
        role: node.classList.contains("user") ? "user" : "assistant",
        content: bubble ? bubble.textContent : "",
        node,
      };
    })
    .filter((message) => message.content && message.content.trim());

  if (!overviewMessages.length) {
    overview.classList.add("empty");
    return;
  }

  overview.classList.remove("empty");
  const track = document.createElement("div");
  track.className = "overview-track";
  track.setAttribute("aria-hidden", "false");
  const viewport = document.createElement("div");
  viewport.className = "overview-viewport";
  viewport.setAttribute("aria-label", "拖动定位当前对话位置");
  viewport.setAttribute("role", "slider");
  track.appendChild(viewport);

  for (const message of overviewMessages) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `overview-dot ${message.role}`;
    button.dataset.targetIndex = String(message.index);
    button.dataset.preview = truncateText(message.content, 15);
    button.title = cleanPreviewText(message.content);
    button.style.top = `${overviewPositionPercent(box, message.node)}%`;
    button.setAttribute("aria-label", `跳到对话：${truncateText(message.content, 15)}`);
    const preview = document.createElement("span");
    preview.className = "overview-preview";
    preview.textContent = cleanPreviewText(message.content);
    preview.dataset.long = cleanPreviewText(message.content);
    button.appendChild(preview);
    button.addEventListener("click", () => scrollToMessage(message.index));
    track.appendChild(button);
  }
  overview.appendChild(track);
  updateOverviewRailBounds();
  syncOverviewPosition();
}

function overviewPositionPercent(box, targetOrIndex) {
  if (!box) return 0;
  const target =
    targetOrIndex instanceof HTMLElement
      ? targetOrIndex
      : box.querySelector(`[data-message-index="${targetOrIndex}"]`);
  if (!target) return 0;
  const contentHeight = Math.max(1, box.scrollHeight);
  const center = target.offsetTop + target.offsetHeight / 2;
  return clamp((center / contentHeight) * 100, 0, 100);
}

function truncateText(text, maxLength) {
  const clean = cleanPreviewText(text);
  if (clean.length <= maxLength) return clean || "空内容";
  return `${clean.slice(0, maxLength)}...`;
}

function cleanPreviewText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function scrollToMessage(index) {
  const box = $("messages");
  const target = box.querySelector(`[data-message-index="${index}"]`);
  if (!target) return;
  setActiveOverviewDot(String(index));
  box.scrollTo({
    top: Math.max(0, target.offsetTop - 24),
    behavior: "smooth",
  });
}

function syncOverviewPosition() {
  const box = $("messages");
  const overview = $("conversationOverview");
  if (!box || !overview) return;
  if (state.overviewDrag) {
    updateOverviewViewport(box, overview);
    updateOverviewActiveFromScroll(box, overview);
    return;
  }
  updateOverviewRailBounds();
  updateOverviewViewport(box, overview);
  updateOverviewActiveFromScroll(box, overview);
}

function updateOverviewRailBounds() {
  const box = $("messages");
  const overview = $("conversationOverview");
  if (!box || !overview) return;
  const boxRect = box.getBoundingClientRect();
  const overviewRect = overview.getBoundingClientRect();
  const top = Math.max(0, boxRect.top - overviewRect.top);
  const height = Math.max(80, boxRect.height);
  overview.style.setProperty("--overview-rail-top", `${top}px`);
  overview.style.setProperty("--overview-rail-height", `${height}px`);
}

function updateOverviewViewport(box, overview) {
  const marker = overview.querySelector(".overview-viewport");
  if (!marker) return;
  const contentHeight = Math.max(box.clientHeight, box.scrollHeight);
  const height = clamp((box.clientHeight / contentHeight) * 100, 8, 100);
  const top = clamp((box.scrollTop / contentHeight) * 100, 0, 100 - height);
  marker.style.top = `${top}%`;
  marker.style.height = `${height}%`;
  marker.setAttribute("aria-valuemin", "0");
  marker.setAttribute("aria-valuemax", String(Math.max(0, box.scrollHeight - box.clientHeight)));
  marker.setAttribute("aria-valuenow", String(Math.round(box.scrollTop)));
}

function initOverviewDragEvents() {
  const overview = $("conversationOverview");
  if (!overview) return;
  overview.addEventListener("pointerdown", startOverviewDrag);
  document.addEventListener("pointermove", moveOverviewDrag);
  document.addEventListener("pointerup", stopOverviewDrag);
  document.addEventListener("pointercancel", stopOverviewDrag);
}

function startOverviewDrag(event) {
  const overview = $("conversationOverview");
  const box = $("messages");
  const track = overview ? overview.querySelector(".overview-track") : null;
  const handle = overview ? overview.querySelector(".overview-viewport") : null;
  if (!overview || !box || !track || !handle) return;
  if (event.target.closest(".overview-dot")) return;
  if (!event.target.closest(".overview-track") && !event.target.closest(".overview-viewport")) return;

  event.preventDefault();
  const trackRect = track.getBoundingClientRect();
  const handleRect = handle.getBoundingClientRect();
  const maxScroll = Math.max(1, box.scrollHeight - box.clientHeight);
  const handleHeight = Math.max(24, handleRect.height);
  const maxTop = Math.max(1, trackRect.height - handleHeight);
  let startTop = Math.max(0, handleRect.top - trackRect.top);

  if (!event.target.closest(".overview-viewport")) {
    startTop = clamp(event.clientY - trackRect.top - handleHeight / 2, 0, maxTop);
    box.scrollTop = (startTop / maxTop) * maxScroll;
    syncOverviewPosition();
  }

  state.overviewDrag = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startTop,
    maxTop,
    maxScroll,
    pendingScrollTop: box.scrollTop,
    raf: 0,
  };
  overview.classList.add("dragging");
  if (overview.setPointerCapture) overview.setPointerCapture(event.pointerId);
}

function moveOverviewDrag(event) {
  if (!state.overviewDrag || state.overviewDrag.pointerId !== event.pointerId) return;
  const box = $("messages");
  const overview = $("conversationOverview");
  if (!box || !overview) return;
  const drag = state.overviewDrag;
  const nextTop = clamp(drag.startTop + event.clientY - drag.startY, 0, drag.maxTop);
  drag.pendingScrollTop = (nextTop / drag.maxTop) * drag.maxScroll;
  if (drag.raf) return;
  drag.raf = requestAnimationFrame(() => {
    if (!state.overviewDrag) return;
    box.scrollTop = state.overviewDrag.pendingScrollTop;
    updateOverviewViewport(box, overview);
    updateOverviewActiveFromScroll(box, overview);
    state.overviewDrag.raf = 0;
  });
}

function stopOverviewDrag(event) {
  if (!state.overviewDrag) return;
  const overview = $("conversationOverview");
  const box = $("messages");
  if (box && Number.isFinite(state.overviewDrag.pendingScrollTop)) {
    box.scrollTop = state.overviewDrag.pendingScrollTop;
  }
  if (state.overviewDrag.raf) {
    cancelAnimationFrame(state.overviewDrag.raf);
  }
  if (overview && overview.releasePointerCapture && event.pointerId === state.overviewDrag.pointerId) {
    try {
      overview.releasePointerCapture(event.pointerId);
    } catch {}
  }
  state.overviewDrag = null;
  if (overview) overview.classList.remove("dragging");
  syncOverviewPosition();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setActiveOverviewDot(activeIndex) {
  const overview = $("conversationOverview");
  if (!overview) return;
  const dots = Array.from(overview.querySelectorAll(".overview-dot"));
  for (const dot of dots) {
    dot.classList.toggle("active", dot.dataset.targetIndex === activeIndex);
  }
}

function updateOverviewActiveFromScroll(box, overview) {
  if (!box || !overview) return;
  const userNodes = Array.from(box.querySelectorAll(".message[data-message-index]"));
  const dots = Array.from(overview.querySelectorAll(".overview-dot"));
  if (!userNodes.length || !dots.length) return;

  if (box.scrollTop + box.clientHeight >= box.scrollHeight - 16) {
    setActiveOverviewDot(userNodes[userNodes.length - 1].dataset.messageIndex);
    return;
  }

  const marker = box.scrollTop + box.clientHeight * 0.38;
  let activeIndex = userNodes[0].dataset.messageIndex;
  for (const node of userNodes) {
    if (node.offsetTop <= marker) activeIndex = node.dataset.messageIndex;
  }
  setActiveOverviewDot(activeIndex);
}

function applyTheme(theme) {
  const allowedThemes = new Set(["light", "dark", "eye"]);
  state.theme = allowedThemes.has(theme) ? theme : "light";
  document.body.dataset.theme = state.theme;
  localStorage.setItem(themeStorageKey, state.theme);
  updateCatImages();
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === state.theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateCatImages() {
  document.querySelectorAll(".cat-image").forEach((image) => {
    image.src = currentCatImage();
  });
}

function loadTheme() {
  applyTheme(localStorage.getItem(themeStorageKey) || "light");
}

function initSidebarCat() {
  scheduleSidebarCatMotion();
  scheduleDailyReminders();
  const cat = $("sidebarCat");
  if (cat) cat.addEventListener("click", () => playSidebarCatAnimation());
  loadNotifications();

  window.__mbhCatTest = {
    playSidebarCatAnimation,
    showCatReminder,
    loadNotifications,
    renderCatNotification,
    isSingleRestWorkday,
    scheduleDailyReminders,
  };
}

function scheduleSidebarCatMotion() {
  const delay = 14000 + Math.floor(Math.random() * 14000);
  window.setTimeout(() => {
    playSidebarCatAnimation();
    scheduleSidebarCatMotion();
  }, delay);
}

function playSidebarCatAnimation(animationClass = "") {
  const cat = $("sidebarCat");
  if (!cat) return;
  const picked =
    animationClass ||
    catAnimationClasses[Math.floor(Math.random() * catAnimationClasses.length)];

  cat.classList.remove(...catAnimationClasses);
  void cat.offsetWidth;
  cat.classList.add(picked);
  window.setTimeout(() => cat.classList.remove(picked), 1500);
}

function scheduleDailyReminders() {
  while (reminderTimers.length) window.clearTimeout(reminderTimers.pop());
  for (const rule of reminderRules) {
    const nextDate = nextReminderDate(rule);
    const delay = Math.max(0, nextDate.getTime() - Date.now());
    const timer = window.setTimeout(() => {
      showScheduledReminder(rule, nextDate);
      scheduleDailyReminders();
    }, delay);
    reminderTimers.push(timer);
  }
}

function nextReminderDate(rule, from = new Date()) {
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  for (let offset = 0; offset < 400; offset += 1) {
    const candidate = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + offset,
      rule.hour,
      rule.minute,
      0,
      0,
    );
    if (candidate <= from) continue;
    if (isSingleRestWorkday(candidate)) return candidate;
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

function showScheduledReminder(rule, scheduledDate = new Date()) {
  if (!isSingleRestWorkday(scheduledDate)) return;
  const key = `mbh-reminder-${rule.id}-${dateStamp(scheduledDate)}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");
  showCatReminder(rule.text);
}

function isSingleRestWorkday(date = new Date()) {
  const day = date.getDay();
  if (day === 0) return false;
  return !legalHolidayDates.has(dateStamp(date));
}

function dateStamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showCatReminder(text) {
  const reminder = $("catReminder");
  const note = document.querySelector(".cat-note");
  if (!reminder) return;
  reminder.textContent = text;
  reminder.classList.add("show");
  if (note) note.textContent = text;
  playSidebarCatAnimation("cat-anim-hop");

  window.clearTimeout(showCatReminder.hideTimer);
  showCatReminder.hideTimer = window.setTimeout(() => {
    reminder.classList.remove("show");
    if (note) note.textContent = "喵，随时待命";
  }, 12000);
}

async function loadNotifications() {
  try {
    const data = await api("/api/notifications");
    state.notifications = Array.isArray(data.notifications) ? data.notifications : [];
    if (state.activeNotificationIndex >= state.notifications.length) {
      state.activeNotificationIndex = 0;
    }
    renderCatNotification();
  } catch (error) {
    console.error(error);
  }
}

function renderCatNotification() {
  const panel = $("catNotification");
  if (!panel) return;
  panel.innerHTML = "";
  const notifications = Array.isArray(state.notifications) ? state.notifications : [];
  if (!notifications.length) {
    panel.hidden = true;
    panel.classList.remove("show");
    return;
  }

  const index = clamp(state.activeNotificationIndex, 0, notifications.length - 1);
  state.activeNotificationIndex = index;
  const notification = notifications[index];
  panel.hidden = false;
  panel.classList.add("show");
  panel.dataset.notificationId = notification.id || "";

  const count = document.createElement("div");
  count.className = "cat-notification-count";
  count.textContent = `${index + 1}/${notifications.length}`;

  const title = document.createElement("strong");
  title.textContent = notification.title || "通知";

  const summary = document.createElement("p");
  summary.textContent = notification.summary || "有一条需要查看的提醒。";

  const actions = document.createElement("div");
  actions.className = "cat-notification-actions";
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.textContent = "确定";
  confirm.addEventListener("click", () => handleCatNotification(notification.id, "confirm"));
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary";
  cancel.textContent = "取消";
  cancel.addEventListener("click", () => handleCatNotification(notification.id, "cancel"));
  actions.append(confirm, cancel);

  panel.append(count, title, summary, actions);
}

async function handleCatNotification(id, action = "confirm") {
  if (!id) return;
  const current = (state.notifications || []).find((item) => item.id === id);
  try {
    const data = await api("/api/notifications/handle", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    });
    state.notifications = Array.isArray(data.notifications) ? data.notifications : [];
    state.activeNotificationIndex = Math.min(state.activeNotificationIndex, Math.max(0, state.notifications.length - 1));
    renderCatNotification();
    if (action === "confirm") openNotificationTarget(current?.target || data.notification?.target);
  } catch (error) {
    showCatReminder(error.message || "通知处理失败");
  }
}

function openNotificationTarget(target = {}) {
  if (target.page === "learning") {
    openLearningPage();
  }
}

async function loadConversations() {
  const data = await api("/api/conversations");
  state.projects = data.projects || [];
  state.projectGroups = data.projectGroups || [];
  state.conversations = data.conversations || [];
  if (!state.projects.some((project) => project.id === state.currentProjectId)) {
    state.currentProjectId = state.projects[0]?.id || "no-project";
  }
  renderConversationList();
  if (!state.currentId) {
    const visibleConversations = visibleConversationItems();
    if (visibleConversations.length) {
      await loadConversation(visibleConversations[0].id);
    } else {
      await newConversation();
    }
  }
}

function hiddenConversationIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(hiddenConversationsStorageKey) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveHiddenConversationIds(ids) {
  localStorage.setItem(hiddenConversationsStorageKey, JSON.stringify(Array.from(ids)));
}

function loadCollapsedProjectIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(collapsedProjectsStorageKey) || "[]");
    state.collapsedProjectIds = window.MbhProjectTree.normalizeCollapsedProjectIds(raw);
  } catch {
    state.collapsedProjectIds = new Set();
  }
}

function saveCollapsedProjectIds() {
  localStorage.setItem(collapsedProjectsStorageKey, JSON.stringify(Array.from(state.collapsedProjectIds)));
}

function clampSidebarWidth(width) {
  const viewportLimit = Math.max(sidebarMinWidth, Math.min(sidebarMaxWidth, Math.floor(window.innerWidth * 0.42)));
  return Math.min(viewportLimit, Math.max(sidebarMinWidth, Math.round(Number(width) || 260)));
}

function applySidebarWidth(width, persist = false) {
  state.sidebarWidth = clampSidebarWidth(width);
  document.documentElement.style.setProperty("--sidebar-width", `${state.sidebarWidth}px`);
  const handle = $("sidebarResizeHandle");
  if (handle) handle.setAttribute("aria-valuenow", String(state.sidebarWidth));
  if (persist) localStorage.setItem(sidebarWidthStorageKey, String(state.sidebarWidth));
}

function loadSidebarWidth() {
  applySidebarWidth(localStorage.getItem(sidebarWidthStorageKey) || state.sidebarWidth);
}

function applySidebarCollapsed(collapsed) {
  state.sidebarCollapsed = Boolean(collapsed);
  document.querySelector(".app-shell")?.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  const handle = $("sidebarResizeHandle");
  if (handle) {
    handle.setAttribute("aria-disabled", String(state.sidebarCollapsed));
    handle.tabIndex = state.sidebarCollapsed ? -1 : 0;
  }
  const button = $("toggleSidebar");
  if (button) {
    const path = button.querySelector(".sidebar-collapse-path");
    if (path) {
      path.setAttribute("d", state.sidebarCollapsed ? "M10 6l6 6-6 6" : "M14 6 8 12l6 6");
    } else {
      button.textContent = state.sidebarCollapsed ? "›" : "‹";
    }
    button.title = state.sidebarCollapsed ? "展开侧边栏" : "收起侧边栏";
    button.setAttribute("aria-label", state.sidebarCollapsed ? "展开侧边栏" : "收起侧边栏");
    button.setAttribute("aria-pressed", String(state.sidebarCollapsed));
  }
}

function loadSidebarCollapsed() {
  applySidebarCollapsed(localStorage.getItem(sidebarCollapsedStorageKey) === "true");
}

function toggleSidebarCollapsed() {
  applySidebarCollapsed(!state.sidebarCollapsed);
  localStorage.setItem(sidebarCollapsedStorageKey, String(state.sidebarCollapsed));
}

function beginSidebarResize(event) {
  if (state.sidebarCollapsed) return;
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  state.sidebarResize = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: state.sidebarWidth,
  };
  $("sidebarResizeHandle")?.setPointerCapture?.(event.pointerId);
  document.body.classList.add("sidebar-resizing");
}

function updateSidebarResize(event) {
  if (!state.sidebarResize || state.sidebarCollapsed) return;
  const delta = event.clientX - state.sidebarResize.startX;
  applySidebarWidth(state.sidebarResize.startWidth + delta);
}

function endSidebarResize(event) {
  if (!state.sidebarResize) return;
  $("sidebarResizeHandle")?.releasePointerCapture?.(state.sidebarResize.pointerId || event.pointerId);
  state.sidebarResize = null;
  document.body.classList.remove("sidebar-resizing");
  localStorage.setItem(sidebarWidthStorageKey, String(state.sidebarWidth));
}

function visibleConversationItems() {
  const hidden = hiddenConversationIds();
  return state.conversations.filter((item) => !hidden.has(item.id) && (item.projectId || "no-project") === state.currentProjectId);
}

function hiddenConversationItems() {
  const hidden = hiddenConversationIds();
  return state.conversations.filter((item) => hidden.has(item.id));
}

function renderConversationList() {
  const list = $("sessionList");
  list.innerHTML = "";
  const hidden = hiddenConversationIds();
  const groups = state.projectGroups.length
    ? state.projectGroups
    : [{ id: "no-project", title: "无项目", conversations: state.conversations }];
  for (const group of groups) {
    const visibleItems = (group.conversations || []).filter((item) => !hidden.has(item.id));
    const groupNode = document.createElement("section");
    groupNode.className = "project-group";

    const expanded = window.MbhProjectTree.isProjectExpanded(group.id, state.collapsedProjectIds);
    const title = document.createElement("div");
    const canRenameProject = group.id !== "no-project";
    title.className = `project-title${group.id === state.currentProjectId ? " active" : ""}`;
    if (state.editingProjectId === group.id && canRenameProject) {
      title.classList.add("editing");
      const input = document.createElement("input");
      input.className = "project-rename-input";
      input.value = group.title || "无项目";
      input.setAttribute("aria-label", "项目名称");
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitProjectRename(group, input.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelProjectRename();
        }
      });
      title.appendChild(input);

      const actions = document.createElement("div");
      actions.className = "project-rename-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "project-rename-confirm";
      save.textContent = "✓";
      save.title = "保存项目名";
      save.setAttribute("aria-label", "保存项目名");
      save.addEventListener("click", () => commitProjectRename(group, input.value));
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "project-rename-cancel";
      cancel.textContent = "×";
      cancel.title = "取消重命名";
      cancel.setAttribute("aria-label", "取消重命名");
      cancel.addEventListener("click", cancelProjectRename);
      actions.append(save, cancel);
      title.appendChild(actions);
      window.setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    } else {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "project-toggle";
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.setAttribute("aria-label", `${expanded ? "收起" : "展开"}项目 ${group.title || "无项目"}`);
      toggle.innerHTML = `<span class="project-chevron" aria-hidden="true">${expanded ? "▾" : "▸"}</span><span class="project-name">${escapeHtml(group.title || "无项目")}</span><span class="project-count">${visibleItems.length}</span>`;
      toggle.addEventListener("click", () => toggleProject(group.id));
      title.appendChild(toggle);

      if (canRenameProject) {
        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "project-rename";
        rename.textContent = "✎";
        rename.title = "重命名项目";
        rename.setAttribute("aria-label", `重命名项目 ${group.title || "无项目"}`);
        rename.addEventListener("click", (event) => {
          event.stopPropagation();
          startProjectRename(group.id);
        });
        title.appendChild(rename);
      }
    }
    groupNode.appendChild(title);

    const children = document.createElement("div");
    children.className = "project-conversations";
    children.hidden = !expanded;
    for (const item of visibleItems) {
      children.appendChild(renderConversationRow(item));
    }
    groupNode.appendChild(children);
    list.appendChild(groupNode);
  }
}

function toggleProject(projectId) {
  const result = window.MbhProjectTree.toggleProjectExpansion({
    projectId,
    currentProjectId: state.currentProjectId,
    collapsedProjectIds: state.collapsedProjectIds,
  });
  state.currentProjectId = result.currentProjectId;
  state.collapsedProjectIds = result.collapsedProjectIds;
  saveCollapsedProjectIds();
  renderConversationList();
}

function renderConversationRow(item) {
  const row = document.createElement("div");
  row.className = "session-row";

  const button = document.createElement("button");
  button.className = `session-item${item.id === state.currentId ? " active" : ""}`;
  button.textContent = item.title || "新对话";
  let clickTimer = null;
  button.addEventListener("click", () => {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => loadConversation(item.id), 180);
  });
  button.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    startRenameConversation(item, row);
  });

  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (clickTimer) clearTimeout(clickTimer);
    openContextMenu(event, item, row);
  });

  row.appendChild(button);
  return row;
}

async function hideConversationFromList(item) {
  if (!item || !item.id) return;
  const hidden = hiddenConversationIds();
  hidden.add(item.id);
  saveHiddenConversationIds(hidden);
  closeContextMenu();
  renderConversationList();
  renderTrashPanel();
  if (state.currentId === item.id) {
    const next = visibleConversationItems()[0];
    if (next) {
      await loadConversation(next.id);
    } else {
      state.currentId = "";
      await newConversation();
    }
  }
}

function currentTrashMode() {
  return state.appMode === "canvas" ? "canvas" : "chat";
}

function trashModeTitle(mode) {
  return mode === "canvas" ? "画布回收站" : "对话回收站";
}

function trashEmptyText(mode) {
  return mode === "canvas" ? "暂无可恢复画布" : "暂无可恢复对话";
}

function renderTrashEmpty(list, mode) {
  const empty = document.createElement("div");
  empty.className = "trash-empty";
  empty.textContent = trashEmptyText(mode);
  list.appendChild(empty);
}

async function deletedCanvasTrashItems() {
  try {
    const data = await api("/api/canvases?includeDeleted=1");
    return (data.canvases || []).filter((canvas) => canvas.deletedAt);
  } catch {
    return [];
  }
}

function renderConversationTrashItems(list, items) {
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "trash-item";
    const title = document.createElement("div");
    title.className = "trash-title";
    title.textContent = item.title || "新对话";
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "trash-restore";
    restore.textContent = "恢复";
    restore.addEventListener("click", () => restoreConversationToList(item.id));
    row.append(title, restore);
    list.appendChild(row);
  }
}

function renderCanvasTrashItems(list, items) {
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "trash-item";
    const title = document.createElement("div");
    title.className = "trash-title";
    title.textContent = item.title || "未命名画布";
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "trash-restore";
    restore.textContent = "恢复";
    restore.addEventListener("click", () => restoreCanvasFromTrash(item.id));
    row.append(title, restore);
    list.appendChild(row);
  }
}

async function renderTrashPanel() {
  const list = $("trashList");
  if (!list) return;
  const mode = state.trashMode || currentTrashMode();
  const title = $("trashTitle");
  if (title) title.textContent = trashModeTitle(mode);
  list.innerHTML = "";

  if (mode === "canvas") {
    const deletedCanvases = await deletedCanvasTrashItems();
    if ((state.trashMode || currentTrashMode()) !== mode) return;
    if (!deletedCanvases.length) {
      renderTrashEmpty(list, mode);
      return;
    }
    renderCanvasTrashItems(list, deletedCanvases);
    return;
  }

  const items = hiddenConversationItems();
  if (!items.length) {
    renderTrashEmpty(list, mode);
    return;
  }
  renderConversationTrashItems(list, items);
}

function restoreConversationToList(id) {
  const hidden = hiddenConversationIds();
  hidden.delete(id);
  saveHiddenConversationIds(hidden);
  renderConversationList();
  renderTrashPanel();
}

async function restoreCanvasFromTrash(id) {
  await api("/api/canvas/restore", {
    method: "POST",
    body: JSON.stringify({ canvasId: id }),
  });
  await loadCanvases();
  renderTrashPanel();
}

function clearConversationSearch() {
  const results = $("conversationSearchResults");
  if (results) {
    results.innerHTML = "";
    results.classList.remove("open");
  }
}

function updateSearchModalMode() {
  const canvasMode = state.appMode === "canvas";
  const title = $("conversationSearchTitle");
  const input = $("conversationSearch");
  const close = $("closeConversationSearch");
  if (title) title.textContent = canvasMode ? "搜索画布" : "搜索对话";
  if (input) {
    input.placeholder = canvasMode ? "输入关键词，搜索当前画布节点内容" : "输入关键词，搜索全部对话内容";
    input.setAttribute("aria-label", canvasMode ? "搜索当前画布节点内容" : "搜索全部对话内容");
  }
  if (close) close.textContent = "关闭";
}

function openConversationSearch() {
  const modal = $("conversationSearchModal");
  updateSearchModalMode();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  clearConversationSearch();
  const input = $("conversationSearch");
  if (input) {
    input.value = "";
    window.setTimeout(() => input.focus(), 0);
  }
}

function closeConversationSearch() {
  const modal = $("conversationSearchModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  clearConversationSearch();
  const input = $("conversationSearch");
  if (input) input.value = "";
}

function queueConversationSearch() {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => {
    if (state.appMode === "canvas") {
      searchCanvasNodes();
    } else {
      searchConversations();
    }
  }, 180);
}

async function searchConversations() {
  if (state.appMode === "canvas") {
    searchCanvasNodes();
    return;
  }
  const input = $("conversationSearch");
  const results = $("conversationSearchResults");
  if (!input || !results) return;
  const query = input.value.trim();
  if (!query) {
    clearConversationSearch();
    return;
  }
  results.classList.add("open");
  results.innerHTML = '<div class="conversation-search-empty">搜索中...</div>';
  try {
    const data = await api(`/api/conversation-search?q=${encodeURIComponent(query)}`);
    const hidden = hiddenConversationIds();
    const matches = (data.results || []).filter((item) => !hidden.has(item.conversationId));
    renderConversationSearchResults(matches, query);
  } catch (error) {
    results.innerHTML = "";
    const item = document.createElement("div");
    item.className = "conversation-search-empty";
    item.textContent = error.message;
    results.appendChild(item);
  }
}

function searchCanvasNodes() {
  const input = $("conversationSearch");
  const results = $("conversationSearchResults");
  if (!input || !results) return;
  const query = input.value.trim();
  if (!query) {
    clearConversationSearch();
    return;
  }
  results.classList.add("open");
  renderCanvasSearchResults(findCanvasNodeMatches(query), query);
}

function findCanvasNodeMatches(query) {
  const lowerQuery = query.toLowerCase();
  return (state.currentCanvas?.nodes || [])
    .map((node) => {
      const typeLabel = canvasTypeLabels[node.type] || "标识";
      const title = node.title || "未命名节点";
      const content = node.content || "";
      const searchText = `${title}\n${typeLabel}\n${content}`;
      if (!searchText.toLowerCase().includes(lowerQuery)) return null;
      const snippetSource = content.toLowerCase().includes(lowerQuery) ? content : `${title} ${typeLabel}`;
      return {
        nodeId: node.id,
        title,
        typeLabel,
        snippet: buildCanvasSearchSnippet(snippetSource, query),
      };
    })
    .filter(Boolean);
}

function buildCanvasSearchSnippet(text, query) {
  const source = String(text || "");
  if (!source) return query;
  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerSource.indexOf(lowerQuery);
  if (index < 0) return source.slice(0, 96);
  const start = Math.max(0, index - 36);
  const end = Math.min(source.length, index + query.length + 60);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

function renderConversationSearchResults(matches, query) {
  const results = $("conversationSearchResults");
  if (!results) return;
  results.innerHTML = "";
  results.classList.add("open");
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "conversation-search-empty";
    empty.textContent = "没有找到相关对话";
    results.appendChild(empty);
    return;
  }
  for (const match of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-search-result";
    button.dataset.conversationId = match.conversationId;
    button.dataset.messageIndex = match.messageIndex ?? "";

    const title = document.createElement("span");
    title.className = "conversation-search-title";
    title.textContent = match.title || "新对话";

    const snippet = document.createElement("span");
    snippet.className = "conversation-search-snippet";
    snippet.textContent = match.snippet || query;

    const meta = document.createElement("span");
    meta.className = "conversation-search-meta";
    const role = match.role === "user" ? "你" : match.role === "assistant" ? "助手" : "标题";
    meta.textContent = `${role}${match.time ? `｜${formatMessageTime(match.time)}` : ""}`;

    button.append(title, snippet, meta);
    button.addEventListener("click", () => jumpToSearchResult(match));
    results.appendChild(button);
  }
}

function renderCanvasSearchResults(matches, query) {
  const results = $("conversationSearchResults");
  if (!results) return;
  results.innerHTML = "";
  results.classList.add("open");
  if (!state.currentCanvas) {
    const empty = document.createElement("div");
    empty.className = "conversation-search-empty";
    empty.textContent = "当前没有打开的画布";
    results.appendChild(empty);
    return;
  }
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "conversation-search-empty";
    empty.textContent = "没有找到相关节点";
    results.appendChild(empty);
    return;
  }
  for (const match of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-search-result";
    button.dataset.nodeId = match.nodeId;

    const title = document.createElement("span");
    title.className = "conversation-search-title";
    title.textContent = match.title || "未命名节点";

    const snippet = document.createElement("span");
    snippet.className = "conversation-search-snippet";
    snippet.textContent = match.snippet || query;

    const meta = document.createElement("span");
    meta.className = "conversation-search-meta";
    meta.textContent = `${state.currentCanvas.title || "当前画布"} · ${match.typeLabel || "节点"}`;

    button.append(title, snippet, meta);
    button.addEventListener("click", () => jumpToCanvasSearchResult(match));
    results.appendChild(button);
  }
}

async function jumpToSearchResult(match) {
  if (!match || !match.conversationId) return;
  await loadConversation(match.conversationId);
  closeConversationSearch();
  const input = $("conversationSearch");
  if (input) input.blur();
  window.requestAnimationFrame(() => {
    const box = $("messages");
    const index = match.messageIndex;
    const node = index === null || index === undefined || index === ""
      ? null
      : box.querySelector(`.message[data-message-index="${CSS.escape(String(index))}"]`);
    if (!node) {
      box.scrollTop = 0;
      return;
    }
    node.scrollIntoView({ block: "center" });
    node.classList.add("search-hit");
    window.setTimeout(() => node.classList.remove("search-hit"), 1800);
  });
}

function jumpToCanvasSearchResult(match) {
  if (!match || !match.nodeId || !state.currentCanvas) return;
  const node = currentCanvasNode(match.nodeId);
  if (!node) return;
  closeConversationSearch();
  const input = $("conversationSearch");
  if (input) input.blur();
  state.selectedCanvasNodeId = node.id;
  state.selectedCanvasEdgeId = "";
  renderCanvas();
  window.requestAnimationFrame(() => {
    const item = document.querySelector(`.canvas-node[data-node-id="${CSS.escape(String(node.id))}"]`);
    centerCanvasOnNode(node.id);
    if (item) {
      item.focus({ preventScroll: true });
      item.classList.add("search-hit");
      window.setTimeout(() => item.classList.remove("search-hit"), 1800);
    }
  });
}

function openContextMenu(event, item, row) {
  state.contextItem = { item, row };
  const menu = $("contextMenu");
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.classList.add("open");
  menu.setAttribute("aria-hidden", "false");
}

function closeContextMenu() {
  const menu = $("contextMenu");
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
}

function startRenameConversation(item, row) {
  const input = document.createElement("input");
  input.className = "session-rename";
  input.value = item.title || "新对话";
  row.replaceChildren(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    if (save && title && title !== item.title) {
      try {
        const renamed = await api("/api/conversation/rename", {
          method: "POST",
          body: JSON.stringify({ id: item.id, title }),
        });
        if (state.currentId === item.id) {
          $("chatTitle").textContent = renamed.title;
        }
      } catch (error) {
        console.error(error);
      }
    }
    await loadConversations();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

async function loadConversation(id) {
  const data = await api(`/api/conversation?id=${encodeURIComponent(id)}`);
  state.currentId = data.id;
  state.messages = data.messages || [];
  state.currentRunName = data.runName || "";
  state.workbenchRunName = state.currentRunName;
  state.conversationCreatedAt = data.createdAt || data.updatedAt || "";
  $("chatTitle").textContent = data.title || state.appName;
  renderConversationList();
  renderMessages();
  if (state.workbenchOpen) loadWorkbench();
}

function startProjectRename(projectId) {
  if (projectId === "no-project") return;
  state.editingProjectId = projectId;
  renderConversationList();
}

function cancelProjectRename() {
  state.editingProjectId = "";
  renderConversationList();
}

async function commitProjectRename(group, title) {
  if (group?.id === "no-project") return;
  const currentTitle = group?.title || "无项目";
  const nextTitle = String(title || "").trim();
  if (!nextTitle || nextTitle === currentTitle) {
    cancelProjectRename();
    return;
  }
  const data = await api("/api/projects/rename", {
    method: "POST",
    body: JSON.stringify({ id: group.id, title: nextTitle }),
  });
  state.editingProjectId = "";
  state.projects = data.projects || state.projects;
  state.projectGroups = state.projectGroups.map((item) => (
    item.id === group.id ? { ...item, title: data.project?.title || nextTitle } : item
  ));
  await loadConversations();
}

function renderNewConversationProjectOptions() {
  const select = $("newConversationProject");
  if (!select) return;
  select.innerHTML = "";
  for (const project of state.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.title || "无项目";
    select.appendChild(option);
  }
  const createOption = document.createElement("option");
  createOption.value = newProjectSelectValue;
  createOption.textContent = "新建项目...";
  select.appendChild(createOption);
  select.value = state.currentProjectId && state.projects.some((project) => project.id === state.currentProjectId)
    ? state.currentProjectId
    : state.projects[0]?.id || newProjectSelectValue;
  updateNewConversationProjectFields();
}

function updateNewConversationProjectFields() {
  const select = $("newConversationProject");
  const wrap = $("newConversationProjectNameWrap");
  if (!select || !wrap) return;
  const creating = select.value === newProjectSelectValue;
  wrap.hidden = !creating;
  if (creating) $("newConversationProjectName").focus();
}

function openNewConversationModal() {
  const modal = $("newConversationModal");
  if (!modal) return;
  $("newConversationTitle").value = "新对话";
  $("newConversationProjectName").value = "新项目";
  renderNewConversationProjectOptions();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  $("newConversationTitle").focus();
}

function closeNewConversationModal() {
  const modal = $("newConversationModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function createConversationFromModal() {
  const title = $("newConversationTitle").value.trim() || "新对话";
  const selectedProjectId = $("newConversationProject").value;
  const payload = { title };
  if (selectedProjectId === newProjectSelectValue) {
    const newProjectTitle = $("newConversationProjectName").value.trim();
    if (!newProjectTitle) {
      $("newConversationProjectName").focus();
      return;
    }
    payload.newProjectTitle = newProjectTitle;
  } else {
    payload.projectId = selectedProjectId;
  }
  closeNewConversationModal();
  await newConversation(payload);
}

async function newConversation(options = {}) {
  const data = await api("/api/conversations", {
    method: "POST",
    body: JSON.stringify({
      title: options.title || "新对话",
      projectId: options.projectId || state.currentProjectId,
      newProjectTitle: options.newProjectTitle || "",
    }),
  });
  state.currentId = data.id;
  state.currentProjectId = data.projectId || options.projectId || state.currentProjectId;
  state.messages = [];
  state.currentRunName = data.runName || "";
  state.workbenchRunName = state.currentRunName;
  state.conversationCreatedAt = data.createdAt || "";
  await loadConversations();
  await loadConversation(data.id);
}

async function sendMessage(event) {
  event.preventDefault();
  const input = $("chatInput");
  const text = input.value.trim();
  const pendingCorrection = state.pendingLearningCorrection;
  const attachments = state.pendingAttachments.map((item) => ({ ...item }));
  if (!canSendCurrentCompose(text, attachments)) {
    updateSendState();
    return;
  }
  const outgoingText = buildOutgoingText(text);
  input.value = "";
  autoGrowTextarea();
  state.pendingAttachments = [];
  renderPendingAttachments();
  updateSendState();
  appendMessage("user", outgoingText || "已上传附件。", true, null, null, attachments);
  renderConversationOverview();
  syncOverviewPosition();
  const waiting = appendMessage("assistant", "正在思考...", false);
  const learningMode = state.composeMode === "learning";
  const forcedSkillRouteId = selectedChatSkillRouteId();
  if (pendingCorrection) {
    waiting.textContent = "正在记录纠正说明...";
  } else if (learningMode) {
    waiting.textContent = "正在保存到本地学习资料库...";
  } else if (forcedSkillRouteId) {
    waiting.textContent = `正在调用${composeModeLabel(state.composeMode)}技能...`;
  }
  try {
    if (pendingCorrection) {
      state.pendingLearningCorrection = null;
      const data = await api("/api/learning-corrections", {
        method: "POST",
        body: JSON.stringify({
          payload: pendingCorrection.payload,
          action: pendingCorrection.action,
          message: outgoingText,
        }),
      });
      waiting.textContent = data.message || data.record?.nextStepText || "已记录纠正说明。";
      if (data.library) {
        state.learningLibrary = data.library;
        renderLearningLibrary();
      }
      return;
    }
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        conversationId: state.currentId,
        message: outgoingText,
        attachments,
        intent: learningMode ? "learning" : forcedSkillRouteId ? "script_analysis" : "",
        learningMode,
        skillRouteId: forcedSkillRouteId,
        workflowIntent: learningMode || forcedSkillRouteId ? "" : state.composeMode || "",
      }),
    });
    state.currentId = data.id;
    state.currentRunName = data.runName || state.currentRunName;
    if (state.workbenchOpen && !state.workbenchRunName) {
      state.workbenchRunName = state.currentRunName;
    }
    state.messages = data.messages || [];
    $("chatTitle").textContent = data.title || state.appName;
    waiting.textContent = data.content || "没有返回内容。";
    await loadConversations();
    renderMessages();
    if (state.workbenchOpen) loadWorkbench();
  } catch (error) {
    waiting.textContent = error.message;
  }
}

function setAppMode(mode) {
  state.appMode = mode === "canvas" ? "canvas" : "chat";
  $("chatShell").hidden = state.appMode !== "chat";
  $("canvasShell").hidden = state.appMode !== "canvas";
  $("sessionList").hidden = state.appMode !== "chat";
  $("canvasList").hidden = state.appMode !== "canvas";
  $("conversationOverview").hidden = state.appMode !== "chat";
  $("newChat").title = state.appMode === "canvas" ? "新建画布" : "新建对话";
  $("newChat").setAttribute("aria-label", state.appMode === "canvas" ? "新建画布" : "新建对话");
  $("openConversationSearch").title = state.appMode === "canvas" ? "搜索当前画布" : "搜索全部对话";
  $("openConversationSearch").setAttribute("aria-label", state.appMode === "canvas" ? "搜索当前画布" : "搜索全部对话");
  const modeSwitch = $("appModeSwitch");
  if (modeSwitch) {
    const canvasActive = state.appMode === "canvas";
    modeSwitch.dataset.mode = state.appMode;
    modeSwitch.setAttribute("aria-checked", String(canvasActive));
    modeSwitch.setAttribute("aria-label", `工作模式：${canvasActive ? "画布" : "对话"}`);
    modeSwitch.title = canvasActive ? "切换到对话" : "切换到画布";
  }
  if (state.appMode === "canvas") {
    loadCanvases();
  } else {
    renderConversationList();
  }
}

async function handlePrimaryCreate() {
  if (state.appMode === "canvas") {
    await newCanvas();
    return;
  }
  openNewConversationModal();
}

async function loadCanvases() {
  const data = await api("/api/canvases");
  state.canvases = data.canvases || [];
  renderCanvasList();
  if (!state.currentCanvasId) {
    if (state.canvases.length) {
      await loadCanvas(state.canvases[0].id);
    } else {
      await newCanvas("新画布");
    }
  }
}

function renderCanvasList() {
  const list = $("canvasList");
  if (!list) return;
  list.innerHTML = "";
  for (const item of state.canvases) {
    const row = document.createElement("div");
    row.className = `session-row${item.archivedAt ? " archived" : ""}`;
    row.dataset.canvasId = item.id;
    const button = document.createElement("button");
    button.className = `session-item${item.id === state.currentCanvasId ? " active" : ""}`;
    button.textContent = item.title || "新画布";
    button.title = `${item.nodeCount || 0} 个节点`;
    let clickTimer = null;
    button.addEventListener("click", () => {
      if (clickTimer) window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => loadCanvas(item.id), 180);
    });
    button.addEventListener("dblclick", (event) => {
      event.preventDefault();
      if (clickTimer) {
        window.clearTimeout(clickTimer);
        clickTimer = null;
      }
      startRenameCanvas(item, row);
    });
    row.appendChild(button);
    row.addEventListener("contextmenu", (event) => openCanvasItemContextMenu(event, item));
    list.appendChild(row);
  }
}

function startRenameCanvas(item, row) {
  const input = document.createElement("input");
  input.className = "session-rename";
  input.value = item.title || "新画布";
  row.replaceChildren(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    if (save && title && title !== item.title) {
      try {
        const canvas = state.currentCanvas?.id === item.id
          ? { ...state.currentCanvas, title }
          : { ...(await api(`/api/canvas?id=${encodeURIComponent(item.id)}`)), title };
        const renamed = await api("/api/canvas/save", {
          method: "POST",
          body: JSON.stringify({ canvas }),
        });
        if (state.currentCanvasId === item.id) {
          state.currentCanvas = renamed;
          $("canvasTitle").textContent = renamed.title || "自由画布";
        }
        state.canvases = state.canvases.map((canvasItem) => canvasItem.id === item.id
          ? { ...canvasItem, title: renamed.title || title }
          : canvasItem);
      } catch (error) {
        console.error(error);
      }
    }
    renderCanvasList();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

function nextCanvasTitle(baseTitle = "新画布") {
  const names = new Set(state.canvases.map((canvas) => String(canvas.title || "").trim()).filter(Boolean));
  if (!names.has(baseTitle)) return baseTitle;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseTitle} ${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${baseTitle} ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
}

async function newCanvas(defaultTitle = "") {
  const title = (defaultTitle || nextCanvasTitle()).trim();
  if (!title) return;
  const canvas = await api("/api/canvases", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  state.currentCanvasId = canvas.id;
  state.currentCanvas = canvas;
  await loadCanvases();
  await loadCanvas(canvas.id);
}

async function loadCanvas(id) {
  const canvas = await api(`/api/canvas?id=${encodeURIComponent(id)}`);
  state.currentCanvasId = canvas.id;
  state.currentCanvas = canvas;
  state.activeCanvasNodeId = "";
  state.selectedCanvasNodeId = "";
  state.selectedCanvasNodeIds = new Set();
  state.selectedCanvasEdgeId = "";
  state.canvasGroupPrimaryNodeId = "";
  state.canvasMergeHistoryNodeId = "";
  state.editingCanvasBodyNodeId = "";
  resetCanvasHistory(canvas);
  renderCanvasHeaderState();
  renderCanvasList();
  renderCanvas();
}

function renderCanvasHeaderState() {
  const canvas = state.currentCanvas;
  const title = $("canvasTitle");
  const subtitle = $("canvasSubtitle");
  if (title) title.textContent = canvas?.title || "自由画布";
  if (subtitle) {
    subtitle.textContent = canvasIsArchived(canvas)
      ? "只读归档画布。可查看完整节点和连线，如需修改请复制为新画布。"
      : "小说 / 剧本 / 分镜脚本 / 标识节点，可手动连线，也可从节点触发生成。";
  }
  document.querySelectorAll(".canvas-toolbar [data-add-node]").forEach((button) => {
    button.hidden = canvasIsArchived(canvas);
    button.disabled = canvasIsArchived(canvas);
  });
  const archiveButton = $("archiveCurrentCanvas");
  if (archiveButton) {
    archiveButton.hidden = canvasIsArchived(canvas);
    archiveButton.disabled = canvasIsArchived(canvas);
  }
}

function canvasHistorySnapshot(canvas = state.currentCanvas) {
  return canvas ? JSON.stringify(canvas) : "";
}

function cloneCanvasSnapshot(snapshot) {
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot);
  } catch {
    return null;
  }
}

function resetCanvasHistory(canvas = state.currentCanvas) {
  state.canvasUndoStack = [];
  state.canvasRedoStack = [];
  state.canvasHistoryBaseSnapshot = canvasHistorySnapshot(canvas);
  state.canvasHistoryApplying = false;
  updateCanvasHistoryControls();
}

function rememberCanvasHistoryBeforeSave() {
  if (state.canvasHistoryApplying || !state.currentCanvas) return;
  const previous = state.canvasHistoryBaseSnapshot;
  const current = canvasHistorySnapshot();
  if (!previous || previous === current) return;
  state.canvasUndoStack.push(previous);
  if (state.canvasUndoStack.length > canvasHistoryLimit) state.canvasUndoStack.shift();
  state.canvasRedoStack = [];
}

function updateCanvasHistoryControls() {
  const canEditHistory = state.appMode === "canvas" && Boolean(state.currentCanvas) && !canvasIsArchived();
  const undo = $("undoCanvasEdit");
  const redo = $("redoCanvasEdit");
  if (undo) undo.disabled = !canEditHistory || state.canvasUndoStack.length === 0;
  if (redo) redo.disabled = !canEditHistory || state.canvasRedoStack.length === 0;
}

async function applyCanvasHistorySnapshot(snapshot, label) {
  const canvas = cloneCanvasSnapshot(snapshot);
  if (!canvas || !state.currentCanvasId || canvas.id !== state.currentCanvasId) return;
  state.canvasHistoryApplying = true;
  try {
    state.currentCanvas = canvas;
    state.selectedCanvasNodeId = "";
    state.selectedCanvasNodeIds = new Set();
    state.selectedCanvasEdgeId = "";
    state.canvasGroupPrimaryNodeId = "";
    closeCanvasMenus();
    closeCanvasNodeModal();
    await saveCurrentCanvas({ skipHistory: true });
    renderCanvas();
    canvasStatus(label);
  } finally {
    state.canvasHistoryApplying = false;
    updateCanvasHistoryControls();
  }
}

async function undoCanvasEdit() {
  if (!state.currentCanvas || canvasIsArchived() || state.canvasUndoStack.length === 0) return;
  const previous = state.canvasUndoStack.pop();
  state.canvasRedoStack.push(canvasHistorySnapshot());
  await applyCanvasHistorySnapshot(previous, "已撤销上一步画布编辑");
}

async function redoCanvasEdit() {
  if (!state.currentCanvas || canvasIsArchived() || state.canvasRedoStack.length === 0) return;
  const next = state.canvasRedoStack.pop();
  state.canvasUndoStack.push(canvasHistorySnapshot());
  await applyCanvasHistorySnapshot(next, "已恢复下一步画布编辑");
}

function isCanvasHistoryShortcutTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  return target.isContentEditable || ["input", "textarea", "select"].includes(tag);
}

async function saveCurrentCanvas(options = {}) {
  if (!state.currentCanvas) return null;
  if (!options.skipHistory) rememberCanvasHistoryBeforeSave();
  const canvas = await api("/api/canvas/save", {
    method: "POST",
    body: JSON.stringify({ canvas: state.currentCanvas }),
  });
  state.currentCanvas = canvas;
  state.canvasHistoryBaseSnapshot = canvasHistorySnapshot(canvas);
  updateCanvasHistoryControls();
  return canvas;
}

async function runCanvasArchiveCheck(canvasId = state.currentCanvasId) {
  if (!canvasId) return null;
  return api("/api/canvas/archive-check", {
    method: "POST",
    body: JSON.stringify({ canvasId }),
  });
}

function formatCanvasArchiveIssueSummary(archiveCheck = {}) {
  const messages = canvasArchiveIssueMessages(archiveCheck);
  if (!messages.length) return "暂不能归档：请检查画布内容。";
  const shown = messages.slice(0, 3).join("；");
  const extra = messages.length > 3 ? `；另有 ${messages.length - 3} 个问题` : "";
  return `暂不能归档：${shown}${extra}`;
}

function canvasArchiveIssueMessages(archiveCheck = {}) {
  const readinessIssues = Array.isArray(archiveCheck.readiness?.issues) ? archiveCheck.readiness.issues : [];
  const storyboardIssues = Array.isArray(archiveCheck.storyboardIssues) ? archiveCheck.storyboardIssues : [];
  return [...readinessIssues, ...storyboardIssues]
    .map((issue) => String(issue?.message || "").trim())
    .filter(Boolean);
}

function openCanvasArchiveBlockedModal(archiveCheck = {}, options = {}) {
  const modal = $("canvasArchiveBlockedModal");
  const list = $("canvasArchiveBlockedList");
  const intro = $("canvasArchiveBlockedIntro");
  if (!modal || !list || !intro) return;
  const messages = canvasArchiveIssueMessages(archiveCheck);
  const fallback = String(options.message || "").trim() || "请检查画布内容。";
  const shownMessages = messages.length ? messages : [fallback];
  intro.textContent = options.intro || "请先处理以下内容，再重新归档。";
  list.innerHTML = "";
  shownMessages.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    list.appendChild(item);
  });
  modal.classList.remove("pulse");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => modal.classList.add("pulse"));
  $("closeCanvasArchiveBlocked")?.focus();
}

function closeCanvasArchiveBlockedModal() {
  const modal = $("canvasArchiveBlockedModal");
  if (!modal) return;
  modal.classList.remove("open", "pulse");
  modal.setAttribute("aria-hidden", "true");
}

async function archiveCurrentCanvas(canvasId = state.currentCanvasId) {
  if (!canvasId) return;
  canvasStatus("正在检查归档条件...");
  setCanvasActionBusy("archiveCurrentCanvas", "归档检查中");
  try {
    const data = await api("/api/canvas/archive", {
      method: "POST",
      body: JSON.stringify({ canvasId }),
    });
    if (!data.ok) {
      applyCanvasArchiveValidation(data.archiveCheck);
      markCanvasArchiveIssues(data.archiveCheck);
      const summary = formatCanvasArchiveIssueSummary(data.archiveCheck);
      canvasStatus(summary, { lockMs: 6000 });
      openCanvasArchiveBlockedModal(data.archiveCheck, { message: summary.replace(/^暂不能归档：/, "") });
      return data;
    }
    state.currentCanvas = data.canvas;
    await loadCanvases();
    renderCanvas();
    if (data.learningEvidence?.status === "failed") {
      canvasStatus("画布已归档，但学习证据生成失败，可在学习资料库查看。", { lockMs: 6000 });
    } else {
      canvasStatus("画布已归档，仅保留查看。");
    }
    return data;
  } catch (error) {
    const message = error.message || "归档失败，请稍后重试。";
    canvasStatus(message, { lockMs: 6000 });
    openCanvasArchiveBlockedModal({}, { message, intro: "归档请求没有完成，请确认问题后再重试。" });
    return { ok: false, error };
  } finally {
    clearCanvasActionBusy("archiveCurrentCanvas");
  }
}

async function deleteCurrentCanvas() {
  if (!state.currentCanvasId) return;
  const confirmed = await requestCanvasDeleteConfirm({
    title: "删除画布？",
    message: "画布会移入回收站，可在左下角回收站恢复。",
    detail: state.currentCanvas?.title || "当前画布",
    confirmText: "移入回收站",
  });
  if (!confirmed) return;
  await api("/api/canvas/delete", {
    method: "POST",
    body: JSON.stringify({ canvasId: state.currentCanvasId }),
  });
  state.currentCanvasId = "";
  state.currentCanvas = null;
  await loadCanvases();
  renderCanvasList();
  renderCanvas();
  canvasStatus("画布已移入回收站。");
}

async function loadCanvasArchiveItems() {
  const status = $("canvasArchiveStatus");
  if (status) status.textContent = "正在读取已归档画布...";
  try {
    const data = await api("/api/canvases");
    state.canvasArchiveItems = (data.canvases || []).filter((item) => item.archivedAt && !item.deletedAt);
    renderCanvasArchivePage();
  } catch (error) {
    state.canvasArchiveItems = [];
    if (status) status.textContent = error.message || "读取归档画布失败。";
    const list = $("canvasArchiveList");
    if (list) list.innerHTML = `<div class="canvas-archive-empty">${escapeHtml(error.message || "读取失败")}</div>`;
  }
}

function renderCanvasArchivePage() {
  const status = $("canvasArchiveStatus");
  const list = $("canvasArchiveList");
  if (!status || !list) return;
  const items = state.canvasArchiveItems || [];
  status.textContent = items.length ? `共 ${items.length} 个已归档画布` : "暂无已归档画布";
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="canvas-archive-empty">暂无已归档画布。归档后的画布会在这里只读展示。</div>`;
    return;
  }
  for (const item of items) {
    const row = document.createElement("article");
    row.className = "canvas-archive-item";
    const main = document.createElement("div");
    main.className = "canvas-archive-item-main";
    const title = document.createElement("button");
    title.type = "button";
    title.className = "canvas-archive-title-button";
    title.textContent = item.title || "未命名画布";
    title.addEventListener("click", () => viewArchivedCanvas(item.id));
    const meta = document.createElement("span");
    meta.textContent = `${item.nodeCount || 0} 个节点｜${item.edgeCount || 0} 条连线｜归档于 ${formatDateTime(item.archivedAt)}`;
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "canvas-archive-item-actions";
    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.textContent = "复制为新画布";
    duplicate.addEventListener("click", () => duplicateArchivedCanvas(item.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "移入回收站";
    remove.addEventListener("click", () => deleteArchivedCanvas(item.id));
    actions.append(duplicate, remove);
    row.append(main, actions);
    list.appendChild(row);
  }
}

function formatDateTime(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

async function viewArchivedCanvas(id) {
  closeCanvasArchivePage();
  setAppMode("canvas");
  await loadCanvas(id);
  canvasStatus("正在查看已归档画布，仅可查看、复制或移入回收站。");
}

function cloneCanvasAsEditable(source) {
  const now = new Date().toISOString();
  return {
    ...source,
    id: `canvas-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    title: nextCanvasTitle(`${source.title || "归档画布"} 副本`),
    createdAt: now,
    updatedAt: now,
    archivedAt: "",
    deletedAt: "",
    archiveReadiness: null,
  };
}

async function duplicateArchivedCanvas(id) {
  await loadCanvases();
  const source = await api(`/api/canvas?id=${encodeURIComponent(id)}`);
  const cloned = await api("/api/canvas/save", {
    method: "POST",
    body: JSON.stringify({ canvas: cloneCanvasAsEditable(source) }),
  });
  closeCanvasArchivePage();
  setAppMode("canvas");
  await loadCanvases();
  await loadCanvas(cloned.id);
  canvasStatus("已复制为新画布，原归档画布保持只读存档。");
}

async function deleteArchivedCanvas(id) {
  const item = (state.canvasArchiveItems || []).find((canvas) => canvas.id === id);
  const confirmed = await requestCanvasDeleteConfirm({
    title: "移入回收站？",
    message: "归档画布会移入回收站，可在左下角回收站恢复。",
    detail: item?.title || "已归档画布",
    confirmText: "移入回收站",
  });
  if (!confirmed) return;
  await api("/api/canvas/delete", {
    method: "POST",
    body: JSON.stringify({ canvasId: id }),
  });
  if (state.currentCanvasId === id) {
    state.currentCanvasId = "";
    state.currentCanvas = null;
  }
  await loadCanvasArchiveItems();
  await loadCanvases();
  canvasStatus("归档画布已移入回收站。");
}

function markCanvasArchiveIssues(archiveCheck = {}) {
  const firstStoryboardIssue = archiveCheck.storyboardIssues?.[0];
  if (firstStoryboardIssue?.nodeId) {
    state.selectedCanvasNodeId = firstStoryboardIssue.nodeId;
    renderCanvas();
    centerCanvasOnNode(firstStoryboardIssue.nodeId);
  }
}

function applyCanvasArchiveValidation(archiveCheck = {}) {
  if (!state.currentCanvas || !Array.isArray(state.currentCanvas.nodes)) return;
  const issuesByNodeId = new Map();
  for (const item of archiveCheck.storyboardIssues || []) {
    if (!item?.nodeId) continue;
    issuesByNodeId.set(String(item.nodeId), Array.isArray(item.issues) ? item.issues : []);
  }
  state.currentCanvas.nodes = state.currentCanvas.nodes.map((node) => {
    if (node.type !== "storyboard") return node;
    const issues = issuesByNodeId.get(String(node.id || "")) || [];
    const meta = {
      ...(node.meta || {}),
      validation: {
        ok: issues.length === 0,
        issues,
      },
    };
    if (issues.length) delete meta.validationResolution;
    return {
      ...node,
      meta,
    };
  });
}

function currentCanvasNode(nodeId) {
  return state.currentCanvas?.nodes?.find((node) => node.id === nodeId) || null;
}

function currentCanvasEdge(edgeId) {
  return state.currentCanvas?.edges?.find((edge) => edge.id === edgeId) || null;
}

function canvasIsArchived(canvas = state.currentCanvas) {
  return Boolean(canvas?.archivedAt);
}

function isCanvasNodeContentEditable(node) {
  return Boolean(node) && !isCanvasMergedNode(node) && !canvasIsArchived();
}

function canvasNodeBodySelector(nodeId) {
  return `.canvas-node[data-node-id="${CSS.escape(nodeId)}"] .canvas-node-body`;
}

function focusCanvasNodeBody(nodeId) {
  const body = document.querySelector(canvasNodeBodySelector(nodeId));
  if (!body || body.getAttribute("contenteditable") !== "true") return;
  focusMarkdownEditorEnd(body);
}

function startCanvasNodeBodyEdit(nodeId) {
  const node = currentCanvasNode(nodeId);
  if (!isCanvasNodeContentEditable(node)) return;
  state.editingCanvasBodyNodeId = nodeId;
  state.activeCanvasNodeId = nodeId;
  state.selectedCanvasNodeId = nodeId;
  state.selectedCanvasNodeIds = new Set();
  state.selectedCanvasEdgeId = "";
  renderCanvas();
  window.setTimeout(() => focusCanvasNodeBody(nodeId), 0);
}

async function stopCanvasNodeBodyEdit(options = {}) {
  const nodeId = state.editingCanvasBodyNodeId;
  if (!nodeId) return;
  const body = document.querySelector(canvasNodeBodySelector(nodeId));
  if (body) {
    const nextContent = markdownEditorValue(body);
    if (body.dataset.savedContent !== nextContent) {
      await saveCanvasNodeDraft(nodeId, nextContent);
      body.dataset.savedContent = nextContent;
    }
  }
  state.editingCanvasBodyNodeId = "";
  if (options.render) renderCanvas();
}

function maybeStopCanvasBodyEditFromEvent(event) {
  const nodeId = state.editingCanvasBodyNodeId;
  if (!nodeId) return;
  const node = event.target?.closest?.(".canvas-node");
  if (node?.dataset.nodeId === nodeId) return;
  stopCanvasNodeBodyEdit({ render: true });
}

function markdownToolbarButton(label, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `markdown-toolbar-button${options.icon ? " icon-only" : ""}${options.className ? ` ${options.className}` : ""}`;
  button.title = options.title || label;
  button.setAttribute("aria-label", options.title || label);
  if (options.icon) {
    button.innerHTML = markdownToolbarIcon(options.icon, label);
  } else {
    button.textContent = label;
  }
  if (options.prefix) button.dataset.markdownPrefix = options.prefix;
  if (options.wrap) button.dataset.markdownWrap = options.wrap;
  if (options.action) button.setAttribute("data-markdown-action", options.action);
  return button;
}

function markdownToolbarIcon(name, fallback = "") {
  const icons = {
    paragraph: '<span class="toolbar-pilcrow" aria-hidden="true">¶</span>',
    unorderedList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    orderedList: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/><path d="M4 5h1v4"/><path d="M3.8 9h2.4"/><path d="M3.7 11.5h2.2c.8 0 1.1.9.5 1.4L4 15h2.5"/><path d="M4 17h1.6c.9 0 1.2 1.2.3 1.5.9.3.6 1.5-.3 1.5H4"/></svg>',
    horizontalRule: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="1.8"/><path d="M5 15V6.8C5 5.8 5.8 5 6.8 5H15"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4"/><path d="M16 4h4v4"/><path d="M20 16v4h-4"/><path d="M4 16v4h4"/></svg>',
    background: '<svg class="toolbar-bg-icon" viewBox="0 0 24 24" aria-hidden="true"><circle class="toolbar-bg-icon-ring" cx="12" cy="12" r="7.5"/><path class="toolbar-bg-icon-slash" d="M7 17 17 7"/></svg>',
  };
  return icons[name] || escapeHtml(fallback);
}

function markdownToolbarSeparator() {
  const separator = document.createElement("span");
  separator.className = "markdown-toolbar-separator";
  separator.setAttribute("aria-hidden", "true");
  return separator;
}

function setMarkdownEditorValue(editor, markdown = "") {
  if (!editor) return;
  const value = String(markdown || "");
  editor.dataset.markdownValue = value;
  editor.dataset.savedContent = value;
  if (!value.trim()) {
    editor.innerHTML = "";
    return;
  }
  if (window.MbhMarkdown && typeof window.MbhMarkdown.renderMarkdown === "function") {
    editor.innerHTML = window.MbhMarkdown.renderMarkdown(value);
  } else {
    editor.textContent = value;
  }
}

function markdownEditorValue(editor) {
  if (!editor) return "";
  if (window.MbhMarkdown && typeof window.MbhMarkdown.markdownFromHtml === "function") {
    return window.MbhMarkdown.markdownFromHtml(editor.innerHTML);
  }
  return editor.textContent || "";
}

function focusMarkdownEditorEnd(editor) {
  if (!editor) return;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function applyMarkdownEditorFormat(editor, options = {}) {
  if (!editor || editor.getAttribute("contenteditable") !== "true") return;
  editor.focus();
  const prefix = options.prefix || "";
  const wrap = options.wrap || "";
  const action = options.action || "";
  if (action === "paragraph") {
    document.execCommand("formatBlock", false, "p");
  } else if (action === "ordered-list") {
    document.execCommand("insertOrderedList", false);
  } else if (action === "horizontal-rule") {
    document.execCommand("insertHorizontalRule", false);
  } else if (wrap === "**") {
    document.execCommand("bold", false);
  } else if (wrap === "*") {
    document.execCommand("italic", false);
  } else if (prefix === "# ") {
    document.execCommand("formatBlock", false, "h1");
  } else if (prefix === "## ") {
    document.execCommand("formatBlock", false, "h2");
  } else if (prefix === "### ") {
    document.execCommand("formatBlock", false, "h3");
  } else if (prefix === "- ") {
    document.execCommand("insertUnorderedList", false);
  }
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function markdownToolbarBackgroundButton(color, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `markdown-bg-swatch${color ? "" : " clear"}`;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.setAttribute("data-node-background-color", color);
  if (color) button.style.setProperty("--node-bg-swatch", color);
  return button;
}

function canvasNodeBackgroundColor(nodeId = state.activeCanvasNodeId) {
  return sanitizeMarkdownColor(currentCanvasNode(nodeId)?.meta?.backgroundColor || "");
}

function renderMarkdownBackgroundGroup(nodeId = state.activeCanvasNodeId) {
  const group = document.createElement("div");
  const currentBackground = canvasNodeBackgroundColor(nodeId);
  group.className = `markdown-toolbar-bg-group${currentBackground ? " has-color" : ""}`;
  group.setAttribute("aria-label", "节点背景色");
  const menuButton = markdownToolbarButton("", { action: "background-menu", icon: "background", title: currentBackground ? `节点背景色：${currentBackground}` : "节点背景色：默认" });
  if (currentBackground) menuButton.style.setProperty("--toolbar-bg-current", currentBackground);
  group.appendChild(menuButton);
  const palette = document.createElement("div");
  palette.className = "markdown-bg-palette";
  for (const item of markdownBackgroundSwatches) {
    palette.appendChild(markdownToolbarBackgroundButton(item.color, item.title));
  }
  group.appendChild(palette);
  return group;
}

async function applyCanvasNodeBackground(nodeId, color) {
  if (!state.currentCanvas) return;
  const safeColor = sanitizeMarkdownColor(color);
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((node) => {
    if (node.id !== nodeId) return node;
    const meta = { ...(node.meta || {}) };
    if (safeColor) meta.backgroundColor = safeColor;
    else delete meta.backgroundColor;
    return { ...node, meta };
  });
  await saveCurrentCanvas();
  renderCanvas();
}

function renderCanvasInlineMarkdownToolbar(nodeId) {
  const toolbar = document.createElement("div");
  toolbar.className = "canvas-node-inline-markdown-toolbar markdown-toolbar markdown-floating-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Markdown 工具");
  toolbar.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  toolbar.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.target.closest("button");
    if (!button) return;
    const body = document.querySelector(canvasNodeBodySelector(nodeId));
    if (!body) return;
    const action = button.dataset.markdownAction || "";
    await handleMarkdownToolbarButton(button, body, nodeId);
  });
  renderMarkdownToolbarContent(toolbar, nodeId);
  return toolbar;
}

function renderMarkdownToolbarContent(toolbar, nodeId = state.activeCanvasNodeId) {
  toolbar.replaceChildren(
    renderMarkdownBackgroundGroup(nodeId),
    markdownToolbarSeparator(),
    markdownToolbarButton("H1", { prefix: "# ", title: "一级标题", className: "heading" }),
    markdownToolbarButton("H2", { prefix: "## ", title: "二级标题", className: "heading" }),
    markdownToolbarButton("H3", { prefix: "### ", title: "三级标题", className: "heading strong" }),
    markdownToolbarButton("", { action: "paragraph", icon: "paragraph", title: "正文格式" }),
    markdownToolbarSeparator(),
    markdownToolbarButton("B", { wrap: "**", title: "加粗", className: "bold" }),
    markdownToolbarButton("I", { wrap: "*", title: "斜体", className: "italic" }),
    markdownToolbarSeparator(),
    markdownToolbarButton("", { prefix: "- ", icon: "unorderedList", title: "无序列表" }),
    markdownToolbarButton("", { action: "ordered-list", icon: "orderedList", title: "有序列表" }),
    markdownToolbarSeparator(),
    markdownToolbarButton("", { action: "horizontal-rule", icon: "horizontalRule", title: "分割线" }),
    markdownToolbarSeparator(),
    markdownToolbarButton("", { action: "copy", icon: "copy", title: "复制 Markdown 文本" }),
    markdownToolbarButton("", { action: "fullscreen", icon: "fullscreen", title: "全屏编辑" }),
  );
}

async function handleMarkdownToolbarButton(button, editor, nodeId = "") {
  if (!button || !editor) return;
  const action = button.dataset.markdownAction || "";
  if (button.dataset.nodeBackgroundColor !== undefined) {
    await applyCanvasNodeBackground(nodeId || state.activeCanvasNodeId, button.dataset.nodeBackgroundColor || "");
    button.closest(".markdown-toolbar-bg-group")?.classList.remove("open");
    return;
  }
  if (action === "background-menu") {
    const group = button.closest(".markdown-toolbar-bg-group");
    const shouldOpen = !group?.classList.contains("open");
    document.querySelectorAll(".markdown-toolbar-bg-group.open").forEach((item) => {
      if (item !== group) item.classList.remove("open");
    });
    group?.classList.toggle("open", shouldOpen);
    return;
  }
  if (action === "fullscreen") {
    if (nodeId) await openCanvasNodeFullscreenEditor(nodeId, editor);
    return;
  }
  if (action === "copy") {
    const ok = await copyText(markdownEditorValue(editor));
    canvasStatus(ok ? "节点内容已复制" : "复制失败");
    return;
  }
  applyMarkdownEditorFormat(editor, {
    action,
    prefix: button.dataset.markdownPrefix,
    wrap: button.dataset.markdownWrap,
  });
  const nextContent = markdownEditorValue(editor);
  if (editor.dataset.savedContent !== nextContent) {
    if (nodeId) {
      await saveCanvasNodeDraft(nodeId, nextContent);
      editor.dataset.savedContent = nextContent;
    } else {
      scheduleActiveCanvasNodeAutosave();
    }
  }
}

async function openCanvasNodeFullscreenEditor(nodeId, editor = null) {
  if (editor) {
    const nextContent = markdownEditorValue(editor);
    if (editor.dataset.savedContent !== nextContent) {
      await saveCanvasNodeDraft(nodeId, nextContent);
      editor.dataset.savedContent = nextContent;
    }
  }
  state.editingCanvasBodyNodeId = "";
  renderCanvas();
  openCanvasNodeModal(nodeId, { focusContent: true });
}

function isCanvasRevisionNode(node) {
  return node?.meta?.variantKind === "revision";
}

function isCanvasMergedNode(node) {
  return node?.meta?.variantKind === "merged";
}

function canvasMergedVersionRailSegments(node) {
  const versions = Array.isArray(node?.meta?.versions) ? node.meta.versions : [];
  const railCount = Math.min(Math.max(versions.length || 1, 2), 5);
  const primaryId = String(node?.meta?.primaryVersionId || "");
  let primaryIndex = versions.findIndex((version) => String(version.id || "") === primaryId);
  if (primaryIndex < 0) primaryIndex = versions.findIndex((version) => Boolean(version.isPrimary));
  if (primaryIndex < 0) primaryIndex = Math.max(0, railCount - 1);
  const activeIndex = versions.length > railCount
    ? Math.round((primaryIndex / Math.max(versions.length - 1, 1)) * (railCount - 1))
    : Math.min(primaryIndex, railCount - 1);
  return Array.from({ length: railCount }, (_, index) => ({ active: index === activeIndex }));
}

function canvasNodeTitleValue(title) {
  return String(title || "").trim();
}

function hasCanvasNodeTitleConflict(title, excludeNodeId = "") {
  const cleanTitle = canvasNodeTitleValue(title);
  if (!cleanTitle || !state.currentCanvas) return false;
  return (state.currentCanvas.nodes || []).some((node) =>
    node.id !== excludeNodeId &&
    canvasNodeTitleValue(node.title) === cleanTitle
  );
}

function uniqueCanvasNodeTitle(baseTitle, excludeNodeId = "") {
  const cleanBase = canvasNodeTitleValue(baseTitle) || "未命名节点";
  if (!hasCanvasNodeTitleConflict(cleanBase, excludeNodeId)) return cleanBase;
  let index = 2;
  while (hasCanvasNodeTitleConflict(`${cleanBase} ${index}`, excludeNodeId)) index += 1;
  return `${cleanBase} ${index}`;
}

function uniqueCanvasNodeTitleOutside(baseTitle, ignoredNodeIds = new Set()) {
  const cleanBase = canvasNodeTitleValue(baseTitle) || "未命名节点";
  const ignored = ignoredNodeIds instanceof Set ? ignoredNodeIds : new Set(ignoredNodeIds);
  const names = new Set((state.currentCanvas?.nodes || [])
    .filter((node) => !ignored.has(node.id))
    .map((node) => canvasNodeTitleValue(node.title))
    .filter(Boolean));
  if (!names.has(cleanBase)) return cleanBase;
  let index = 2;
  while (names.has(`${cleanBase} ${index}`)) index += 1;
  return `${cleanBase} ${index}`;
}

function selectedCanvasNodes() {
  if (!state.currentCanvas) return [];
  const selected = state.selectedCanvasNodeIds || new Set();
  return (state.currentCanvas.nodes || []).filter((node) => selected.has(node.id));
}

function selectedCanvasNodeCount() {
  return state.selectedCanvasNodeIds?.size || 0;
}

function isCanvasNodeSelected(nodeId) {
  return state.selectedCanvasNodeId === nodeId || Boolean(state.selectedCanvasNodeIds?.has(nodeId));
}

function canGroupCanvasNodes(nodes = []) {
  if (nodes.length < 2) return { ok: false, reason: "至少框选两个节点才能打组" };
  if (nodes.some((node) => !canvasMergeNodeTypes.has(node.type))) {
    return { ok: false, reason: "仅小说、剧本、分镜脚本可以打组" };
  }
  if (nodes.some((node) => isCanvasMergedNode(node))) {
    return { ok: false, reason: "合并节点请通过历史版本继续指定唯一版本" };
  }
  const types = new Set(nodes.map((node) => node.type));
  if (types.size > 1) return { ok: false, reason: "只能打组同一类型的节点" };
  return { ok: true };
}

function canvasNodeIncomingParent(node, selectedIds = new Set()) {
  if (!node || !state.currentCanvas) return null;
  const parentId = node.meta?.parentNodeId || (state.currentCanvas.edges || []).find((edge) =>
    edge.to === node.id && !selectedIds.has(edge.from)
  )?.from;
  return parentId ? currentCanvasNode(parentId) : null;
}

function canvasVersionFromNode(node, index, selectedIds = new Set(), primaryNodeId = "") {
  const parent = canvasNodeIncomingParent(node, selectedIds);
  const content = String(node.content || node.meta?.chatResponse || "");
  return {
    id: `version-${node.id || index + 1}`,
    nodeId: node.id,
    type: node.type,
    title: node.title || `${canvasTypeLabels[node.type] || "节点"} ${index + 1}`,
    parentNodeId: node.meta?.parentNodeId || parent?.id || "",
    parentTitleSnapshot: node.meta?.parentTitleSnapshot || parent?.title || "",
    chatPrompt: node.meta?.chatPrompt || "",
    chatResponse: node.meta?.chatResponse || content,
    content,
    createdAt: node.meta?.revisedAt || node.meta?.generatedAt || node.meta?.createdAt || "",
    sourceKind: node.meta?.variantKind || "original",
    isPrimary: node.id === primaryNodeId,
  };
}

function canvasPrimaryVersionContent(version) {
  return String(version?.content || version?.chatResponse || "");
}

function canConnectCanvasNodes(fromNodeId, toNodeId) {
  if (!state.currentCanvas || !fromNodeId || !toNodeId || fromNodeId === toNodeId) return false;
  const targetNode = currentCanvasNode(toNodeId);
  if (!targetNode) return false;
  if (!isCanvasRevisionNode(targetNode)) return true;
  const parentNodeId = String(targetNode.meta?.parentNodeId || "");
  if (parentNodeId && fromNodeId !== parentNodeId) return false;
  return !(state.currentCanvas.edges || []).some((edge) => edge.to === toNodeId);
}

function canvasStatus(text, options = {}) {
  const node = $("canvasStatus");
  if (!node) return;
  const now = Date.now();
  const lockMs = Number(options.lockMs || 0);
  const shouldLock = lockMs > 0;
  if (!options.force && !shouldLock && state.canvasStatusLockUntil && now < state.canvasStatusLockUntil) return;
  if (shouldLock) {
    state.canvasStatusLockUntil = now + lockMs;
  } else if (options.force || !text) {
    state.canvasStatusLockUntil = 0;
  }
  node.textContent = text;
  node.classList.toggle("show", Boolean(text));
}

function setCanvasActionBusy(elementId, label = "处理中") {
  const button = $(elementId);
  if (!button) return;
  if (!button.dataset.busyOriginalHtml) {
    button.dataset.busyOriginalHtml = button.innerHTML;
  }
  button.disabled = true;
  button.classList.add("is-action-busy");
  button.setAttribute("aria-busy", "true");
  button.innerHTML = `<span class="action-busy-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span>`;
}

function clearCanvasActionBusy(elementId) {
  const button = $(elementId);
  if (!button) return;
  button.disabled = false;
  button.classList.remove("is-action-busy");
  button.removeAttribute("aria-busy");
  if (button.dataset.busyOriginalHtml) {
    button.innerHTML = button.dataset.busyOriginalHtml;
    delete button.dataset.busyOriginalHtml;
  }
}

function canvasZoom() {
  return clamp(Number(state.canvasZoom || 1), canvasZoomMin, canvasZoomMax);
}

function canvasScreenX(x) {
  return (canvasOriginX + Number(x || 0)) * canvasZoom();
}

function canvasScreenY(y) {
  return (canvasOriginY + Number(y || 0)) * canvasZoom();
}

function canvasNodeBounds(node) {
  return {
    x: Number(node.x || 0),
    y: Number(node.y || 0),
    width: Number(node.width || 320),
    height: Number(node.height || 220),
  };
}

function canvasContentBounds(extraPadding = 120) {
  const nodes = state.currentCanvas?.nodes || [];
  if (!nodes.length) {
    return { x: -extraPadding, y: -extraPadding, width: extraPadding * 2, height: extraPadding * 2 };
  }
  const minX = Math.min(...nodes.map((node) => canvasNodeBounds(node).x));
  const minY = Math.min(...nodes.map((node) => canvasNodeBounds(node).y));
  const maxX = Math.max(...nodes.map((node) => {
    const bounds = canvasNodeBounds(node);
    return bounds.x + bounds.width;
  }));
  const maxY = Math.max(...nodes.map((node) => {
    const bounds = canvasNodeBounds(node);
    return bounds.y + bounds.height;
  }));
  return {
    x: minX - extraPadding,
    y: minY - extraPadding,
    width: Math.max(1, maxX - minX + extraPadding * 2),
    height: Math.max(1, maxY - minY + extraPadding * 2),
  };
}

function updateCanvasZoomLabel() {
  const label = $("canvasZoomLabel");
  if (label) label.textContent = `${Math.round(canvasZoom() * 100)}%`;
}

function easeCanvasViewport(t) {
  const clean = clamp(Number(t || 0), 0, 1);
  return 1 - Math.pow(1 - clean, 3);
}

function cancelCanvasViewportAnimation() {
  if (state.canvasViewportAnimation) {
    window.cancelAnimationFrame(state.canvasViewportAnimation.frameId);
    state.canvasViewportAnimation = null;
  }
  $("canvasShell")?.classList.remove("canvas-viewport-animating");
}

function animateCanvasViewportTo({ zoom, left, top, duration = canvasFitAnimationMs }) {
  const stage = $("canvasStage");
  const shell = $("canvasShell");
  if (!stage) return;
  cancelCanvasViewportAnimation();
  const start = {
    zoom: canvasZoom(),
    left: stage.scrollLeft,
    top: stage.scrollTop,
    time: performance.now(),
  };
  const target = {
    zoom: clamp(Number(zoom || start.zoom), canvasZoomMin, canvasZoomMax),
    left: Math.max(0, Number(left || 0)),
    top: Math.max(0, Number(top || 0)),
  };
  shell?.classList.add("canvas-viewport-animating");
  const step = (now) => {
    const progress = duration <= 0 ? 1 : clamp((now - start.time) / duration, 0, 1);
    const eased = easeCanvasViewport(progress);
    state.canvasZoom = start.zoom + (target.zoom - start.zoom) * eased;
    renderCanvas();
    stage.scrollLeft = start.left + (target.left - start.left) * eased;
    stage.scrollTop = start.top + (target.top - start.top) * eased;
    updateCanvasViewportTools();
    if (progress < 1) {
      state.canvasViewportAnimation = {
        frameId: window.requestAnimationFrame(step),
      };
    } else {
      state.canvasZoom = target.zoom;
      stage.scrollLeft = target.left;
      stage.scrollTop = target.top;
      state.canvasViewportAnimation = null;
      shell?.classList.remove("canvas-viewport-animating");
      renderCanvas();
    }
  };
  state.canvasViewportAnimation = {
    frameId: window.requestAnimationFrame(step),
  };
}

function setCanvasZoom(nextZoom, options = {}) {
  const stage = $("canvasStage");
  cancelCanvasViewportAnimation();
  const previousZoom = canvasZoom();
  const cleanZoom = clamp(Number(nextZoom || 1), canvasZoomMin, canvasZoomMax);
  const center = options.logicalCenter || (stage
    ? {
        x: (stage.scrollLeft + stage.clientWidth / 2) / previousZoom,
        y: (stage.scrollTop + stage.clientHeight / 2) / previousZoom,
      }
    : { x: canvasOriginX, y: canvasOriginY });
  state.canvasZoom = cleanZoom;
  renderCanvas();
  if (stage) {
    window.requestAnimationFrame(() => {
      stage.scrollLeft = center.x * cleanZoom - stage.clientWidth / 2;
      stage.scrollTop = center.y * cleanZoom - stage.clientHeight / 2;
      updateCanvasViewportTools();
    });
  } else {
    updateCanvasViewportTools();
  }
}

function canvasViewportLogicalRect() {
  const stage = $("canvasStage");
  const zoom = canvasZoom();
  if (!stage) return { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: stage.scrollLeft / zoom - canvasOriginX,
    y: stage.scrollTop / zoom - canvasOriginY,
    width: stage.clientWidth / zoom,
    height: stage.clientHeight / zoom,
  };
}

function scrollCanvasToLogicalRect(rect, zoom = canvasZoom()) {
  const stage = $("canvasStage");
  if (!stage || !rect) return;
  stage.scrollTo({
    left: (canvasOriginX + rect.x) * zoom,
    top: (canvasOriginY + rect.y) * zoom,
    behavior: "smooth",
  });
}

function canvasCenteredScrollForBounds(bounds, zoom = canvasZoom()) {
  const stage = $("canvasStage");
  if (!stage || !bounds) return { left: 0, top: 0 };
  return {
    left: Math.max(0, (canvasOriginX + bounds.x + bounds.width / 2) * zoom - stage.clientWidth / 2),
    top: Math.max(0, (canvasOriginY + bounds.y + bounds.height / 2) * zoom - stage.clientHeight / 2),
  };
}

function canvasReadableZoomForBounds(bounds) {
  const stage = $("canvasStage");
  if (!stage || !bounds) return canvasFocusReadableZoom;
  const availableWidth = Math.max(240, stage.clientWidth - canvasFocusPadding * 2);
  const availableHeight = Math.max(180, stage.clientHeight - canvasFocusPadding * 2);
  const fitZoom = Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height));
  const targetZoom = Math.min(canvasFocusReadableZoom, fitZoom);
  if (targetZoom < canvasFocusMinReadableZoom) {
    return clamp(targetZoom, canvasZoomMin, canvasZoomMax);
  }
  return clamp(targetZoom, canvasFocusMinReadableZoom, canvasZoomMax);
}

function canvasExpandedZoomForBounds(bounds) {
  const stage = $("canvasStage");
  if (!stage || !bounds) return canvasZoom();
  const targetWidth = Math.max(240, stage.clientWidth * canvasNodeFocusWidthRatio - canvasNodeFocusPadding);
  const targetHeight = Math.max(180, stage.clientHeight * canvasNodeFocusHeightRatio - canvasNodeFocusPadding);
  const proportionalZoom = Math.min(targetWidth / Math.max(1, bounds.width), targetHeight / Math.max(1, bounds.height));
  return clamp(proportionalZoom, canvasZoomMin, Math.min(canvasNodeFocusMaxZoom, canvasZoomMax));
}

function centerCanvasOnNode(nodeId = state.selectedCanvasNodeId) {
  const node = currentCanvasNode(nodeId);
  const stage = $("canvasStage");
  if (!node || !stage) return;
  const bounds = canvasNodeBounds(node);
  const zoom = canvasReadableZoomForBounds(bounds);
  const targetScroll = canvasCenteredScrollForBounds(bounds, zoom);
  animateCanvasViewportTo({
    zoom,
    left: targetScroll.left,
    top: targetScroll.top,
  });
  canvasStatus(`已定位到「${node.title || "选中节点"}」，缩放至 ${Math.round(zoom * 100)}%`);
}

function focusCanvasNodeToViewport(nodeId) {
  const node = currentCanvasNode(nodeId);
  const stage = $("canvasStage");
  if (!node || !stage) return;
  const bounds = canvasNodeBounds(node);
  const zoom = canvasExpandedZoomForBounds(bounds);
  const targetScroll = canvasCenteredScrollForBounds(bounds, zoom);
  animateCanvasViewportTo({
    zoom,
    left: targetScroll.left,
    top: targetScroll.top,
  });
  canvasStatus(`已放大「${node.title || "节点"}」至 ${Math.round(zoom * 100)}%`);
}

function fitCanvasToContent() {
  const stage = $("canvasStage");
  if (!stage || !state.currentCanvas) return;
  const bounds = canvasContentBounds(160);
  const nextZoom = clamp(
    Math.min(stage.clientWidth / bounds.width, stage.clientHeight / bounds.height),
    canvasZoomMin,
    canvasZoomMax
  );
  const targetScroll = canvasCenteredScrollForBounds(bounds, nextZoom);
  animateCanvasViewportTo({
    zoom: nextZoom,
    left: targetScroll.left,
    top: targetScroll.top,
  });
}

function toggleCanvasMiniMap() {
  const panel = $("canvasMiniMap");
  const button = $("toggleCanvasMiniMap");
  if (!panel) return;
  panel.hidden = !panel.hidden;
  button?.classList.toggle("active", !panel.hidden);
  updateCanvasViewportTools();
}

function updateCanvasMiniMap() {
  const panel = $("canvasMiniMap");
  const svg = $("canvasMiniMapSvg");
  if (!panel || !svg || panel.hidden) return;
  const nodes = state.currentCanvas?.nodes || [];
  const viewport = canvasViewportLogicalRect();
  const content = canvasContentBounds(160);
  const minX = Math.min(content.x, viewport.x);
  const minY = Math.min(content.y, viewport.y);
  const maxX = Math.max(content.x + content.width, viewport.x + viewport.width);
  const maxY = Math.max(content.y + content.height, viewport.y + viewport.height);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
  svg.innerHTML = "";
  for (const node of nodes) {
    const bounds = canvasNodeBounds(node);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", `canvas-minimap-node${state.selectedCanvasNodeId === node.id ? " selected" : ""}`);
    rect.setAttribute("x", String(bounds.x));
    rect.setAttribute("y", String(bounds.y));
    rect.setAttribute("width", String(bounds.width));
    rect.setAttribute("height", String(bounds.height));
    rect.setAttribute("rx", "18");
    svg.appendChild(rect);
  }
  const viewRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  viewRect.setAttribute("class", "canvas-minimap-viewport");
  viewRect.setAttribute("x", String(viewport.x));
  viewRect.setAttribute("y", String(viewport.y));
  viewRect.setAttribute("width", String(viewport.width));
  viewRect.setAttribute("height", String(viewport.height));
  viewRect.setAttribute("rx", "12");
  svg.appendChild(viewRect);
}

function canvasMiniMapPoint(event) {
  const svg = $("canvasMiniMapSvg");
  const rect = svg?.getBoundingClientRect();
  const viewBox = svg?.viewBox?.baseVal;
  if (!svg || !rect || !viewBox || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height,
  };
}

function moveCanvasViewportFromMiniMap(event) {
  const point = canvasMiniMapPoint(event);
  const stage = $("canvasStage");
  if (!point || !stage) return;
  cancelCanvasViewportAnimation();
  const zoom = canvasZoom();
  const viewport = canvasViewportLogicalRect();
  stage.scrollLeft = Math.max(0, (canvasOriginX + point.x - viewport.width / 2) * zoom);
  stage.scrollTop = Math.max(0, (canvasOriginY + point.y - viewport.height / 2) * zoom);
  updateCanvasViewportTools();
}

function beginCanvasMiniMapDrag(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  state.canvasMiniMapDrag = {
    pointerId: event.pointerId,
    trigger: event.currentTarget,
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  $("canvasMiniMap")?.classList.add("dragging");
  moveCanvasViewportFromMiniMap(event);
}

function updateCanvasMiniMapDrag(event) {
  const drag = state.canvasMiniMapDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  moveCanvasViewportFromMiniMap(event);
}

function endCanvasMiniMapDrag(event) {
  const drag = state.canvasMiniMapDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.trigger?.releasePointerCapture?.(drag.pointerId);
  state.canvasMiniMapDrag = null;
  $("canvasMiniMap")?.classList.remove("dragging");
}

function updateCanvasViewportTools() {
  updateCanvasZoomLabel();
  const centerButton = $("centerSelectedCanvasNode");
  if (centerButton) centerButton.disabled = !state.selectedCanvasNodeId;
  const zoom = canvasZoom();
  const zoomOut = $("canvasZoomOut");
  const zoomIn = $("canvasZoomIn");
  if (zoomOut) zoomOut.disabled = zoom <= canvasZoomMin + 0.001;
  if (zoomIn) zoomIn.disabled = zoom >= canvasZoomMax - 0.001;
  updateCanvasHistoryControls();
  updateCanvasMiniMap();
}

async function addNodeToCanvas(type, position = null) {
  if (!state.currentCanvas) await newCanvas("新画布");
  if (canvasIsArchived()) {
    canvasStatus("画布已归档，仅可查看。");
    return;
  }
  const cleanType = canvasTypeLabels[type] ? type : "label";
  const nodes = state.currentCanvas.nodes || [];
  if (cleanType === "novel" && nodes.some((node) => node.type === "novel" && !isCanvasRevisionNode(node))) {
    canvasStatus("一个画布只能有一个小说节点");
    return;
  }
  const index = nodes.length;
  const point = position || {
    x: 140 + (index % 4) * 70,
    y: 140 + index * 44,
  };
  const node = {
    id: `node-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    type: cleanType,
    title: uniqueCanvasNodeTitle(canvasTypeLabels[cleanType] || "标识"),
    content: "",
    x: Number(point.x || 0),
    y: Number(point.y || 0),
    width: cleanType === "label" ? 260 : 360,
    height: cleanType === "label" ? 140 : 240,
    meta: {},
  };
  state.currentCanvas.nodes = [...nodes, node];
  await saveCurrentCanvas();
  state.selectedCanvasNodeId = node.id;
  state.selectedCanvasEdgeId = "";
  renderCanvas();
}

function renderCanvas() {
  const canvas = state.currentCanvas;
  const layer = $("canvasNodes");
  if (!layer) return;
  layer.innerHTML = "";
  if (!canvas) {
    canvasStatus("还没有画布");
    return;
  }
  renderCanvasHeaderState();
  applyCanvasSurfaceSize(canvas);
  for (const node of canvas.nodes || []) {
    layer.appendChild(renderCanvasNode(node));
  }
  renderCanvasEdges();
  renderCanvasGroupBar();
  updateCanvasSelectionModeClass();
  updateCanvasViewportTools();
  if (state.canvasDrag?.type === "connect") {
    canvasStatus("拖到目标节点松开");
  }
}

function applyCanvasSurfaceSize(canvas) {
  const nodes = canvas?.nodes || [];
  const zoom = canvasZoom();
  const maxRight = nodes.reduce((max, node) => Math.max(max, canvasOriginX + Number(node.x || 0) + Number(node.width || 320)), 0);
  const maxBottom = nodes.reduce((max, node) => Math.max(max, canvasOriginY + Number(node.y || 0) + Number(node.height || 220)), 0);
  const width = Math.max(canvasSurfaceMinWidth, Math.ceil(maxRight + canvasSurfacePadding)) * zoom;
  const height = Math.max(canvasSurfaceMinHeight, Math.ceil(maxBottom + canvasSurfacePadding)) * zoom;
  const stage = $("canvasStage");
  const edges = $("canvasEdges");
  const nodesLayer = $("canvasNodes");
  stage?.style.setProperty("--canvas-surface-width", `${width}px`);
  stage?.style.setProperty("--canvas-surface-height", `${height}px`);
  if (edges) {
    edges.style.width = `${width}px`;
    edges.style.height = `${height}px`;
    edges.setAttribute("width", String(width));
    edges.setAttribute("height", String(height));
  }
  if (nodesLayer) {
    nodesLayer.style.width = `${width}px`;
    nodesLayer.style.height = `${height}px`;
  }
  ensureCanvasViewportOrigin(canvas);
}

function ensureCanvasViewportOrigin(canvas) {
  const stage = $("canvasStage");
  const canvasId = canvas?.id || "";
  if (!stage || !canvasId || stage.dataset.canvasViewportId === canvasId) return;
  stage.dataset.canvasViewportId = canvasId;
  window.requestAnimationFrame(() => {
    stage.scrollLeft = canvasOriginX * canvasZoom();
    stage.scrollTop = canvasOriginY * canvasZoom();
    updateCanvasViewportTools();
  });
}

function renderCanvasNode(node) {
  const editableBody = isCanvasNodeContentEditable(node);
  const editingBody = editableBody && state.editingCanvasBodyNodeId === node.id;
  const item = document.createElement("article");
  item.className = `canvas-node ${node.type || "label"}${isCanvasRevisionNode(node) ? " revision" : ""}${isCanvasMergedNode(node) ? " merged" : ""}${isCanvasNodeSelected(node.id) ? " selected" : ""}${editingBody ? " editing-body" : ""}`;
  item.dataset.nodeId = node.id;
  item.tabIndex = 0;
  item.style.left = `${canvasScreenX(node.x)}px`;
  item.style.top = `${canvasScreenY(node.y)}px`;
  item.style.width = `${Number(node.width || 320)}px`;
  item.style.height = `${Number(node.height || 220)}px`;
  item.style.transform = `scale(${canvasZoom()})`;
  item.style.transformOrigin = "top left";
  const nodeBackgroundColor = sanitizeMarkdownColor(node.meta?.backgroundColor || "");
  if (nodeBackgroundColor) {
    item.style.setProperty("--canvas-node-custom-bg", nodeBackgroundColor);
    item.style.setProperty("--canvas-node-readable-ink", readableTextColorForBackground(nodeBackgroundColor));
  }
  item.addEventListener("contextmenu", (event) => openCanvasContextMenu(event, node.id));
  item.addEventListener("pointerenter", () => {
    window.clearTimeout(item.canvasHoverTimer);
    item.classList.add("hovering");
  });
  item.addEventListener("pointerleave", () => {
    window.clearTimeout(item.canvasHoverTimer);
    item.canvasHoverTimer = window.setTimeout(() => {
      if (!$("canvasActionMenu")?.classList.contains("open")) item.classList.remove("hovering");
    }, 260);
  });
  item.addEventListener("focusin", () => item.classList.add("hovering"));
  item.addEventListener("focusout", () => item.classList.remove("hovering"));

  const head = document.createElement("div");
  head.className = "canvas-node-headline";
  head.innerHTML = `<span class="canvas-node-type-icon ${escapeHtml(node.type || "label")}" title="${escapeHtml(canvasTypeLabels[node.type] || "标识")}" aria-hidden="true">${canvasTypeIcon(node.type)}</span><span class="canvas-node-title-text">${escapeHtml(node.title || "未命名节点")}</span>`;
  let titleClickTimer = null;
  head.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      event.stopPropagation();
      return;
    }
    if (event.button === 0 && event.detail >= 2) {
      event.preventDefault();
      event.stopPropagation();
      if (titleClickTimer) {
        window.clearTimeout(titleClickTimer);
        titleClickTimer = null;
      }
      editCanvasNodeTitle(node.id);
      return;
    }
    event.stopPropagation();
    selectCanvasNode(node.id);
  });
  head.addEventListener("pointerup", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.suppressCanvasTitleClick) return;
    if (titleClickTimer) {
      window.clearTimeout(titleClickTimer);
      titleClickTimer = null;
      editCanvasNodeTitle(node.id);
      return;
    }
    titleClickTimer = window.setTimeout(() => {
      titleClickTimer = null;
    }, 800);
  });
  head.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  if (isCanvasMergedNode(node)) {
    const rail = document.createElement("div");
    rail.className = "canvas-node-version-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.dataset.versionCount = String(node.meta?.versions?.length || 0);
    canvasMergedVersionRailSegments(node).forEach((segment) => {
      const span = document.createElement("span");
      if (segment.active) span.className = "active";
      rail.appendChild(span);
    });
    item.appendChild(rail);
  }
  item.appendChild(head);
  if (state.editingCanvasNodeId === node.id) {
    head.innerHTML = `<span class="canvas-node-type-icon ${escapeHtml(node.type || "label")}" title="${escapeHtml(canvasTypeLabels[node.type] || "标识")}" aria-hidden="true">${canvasTypeIcon(node.type)}</span>`;
    const titleInput = document.createElement("input");
    titleInput.className = "canvas-node-title-input";
    titleInput.value = node.title || "";
    titleInput.setAttribute("aria-label", "节点标题");
    titleInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    titleInput.addEventListener("pointerup", (event) => event.stopPropagation());
    titleInput.addEventListener("click", (event) => event.stopPropagation());
    titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitCanvasNodeTitleEdit(node.id, titleInput.value);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCanvasNodeTitleEdit();
      }
    });
    titleInput.addEventListener("blur", () => commitCanvasNodeTitleEdit(node.id, titleInput.value));
    head.appendChild(titleInput);
    window.setTimeout(() => {
      titleInput.focus();
      titleInput.select();
    }, 0);
  }

  const body = document.createElement("div");
  body.className = "canvas-node-body markdown-editor markdown-body";
  setMarkdownEditorValue(body, node.content || "");
  body.dataset.placeholder = "点击编辑节点内容。";
  body.setAttribute("aria-label", `${node.title || "节点"}内容`);
  body.setAttribute("role", "textbox");
  body.contentEditable = editingBody ? "true" : "false";
  body.dataset.editable = String(editableBody);
  body.dataset.editing = String(editingBody);
  body.title = editableBody
    ? editingBody
      ? "正在编辑，Markdown 工具条在节点上方。"
      : "单击选中，双击在节点内编辑 Markdown"
    : "只读节点";
  body.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    selectCanvasNode(node.id);
    if (canvasIsArchived()) return;
    if (editingBody) return;
    if (event.button === 0 && event.detail >= 2) {
      event.preventDefault();
      return;
    }
    startCanvasNodeDrag(event, node.id, { pending: true, textarea: body });
  });
  body.addEventListener("click", (event) => {
    event.stopPropagation();
    selectCanvasNode(node.id);
  });
  body.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    focusCanvasNodeToViewport(node.id);
    startCanvasNodeBodyEdit(node.id);
  });
  body.addEventListener("wheel", (event) => {
    if (body.scrollHeight > body.clientHeight) event.stopPropagation();
  }, { passive: true });
  body.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editingBody) {
      event.preventDefault();
      stopCanvasNodeBodyEdit({ render: true });
    }
  });
  body.addEventListener("input", () => {
    const nextContent = markdownEditorValue(body);
    updateCanvasNodeDraft(node.id, nextContent);
    if (body.canvasNodeAutosaveTimer) window.clearTimeout(body.canvasNodeAutosaveTimer);
    body.canvasNodeAutosaveTimer = window.setTimeout(async () => {
      body.canvasNodeAutosaveTimer = null;
      try {
        const latestContent = markdownEditorValue(body);
        await saveCanvasNodeDraft(node.id, latestContent);
        body.dataset.savedContent = latestContent;
      } catch (error) {
        canvasStatus(error.message);
      }
    }, canvasNodeAutosaveDelayMs);
  });
  body.addEventListener("blur", async () => {
    if (body.canvasNodeAutosaveTimer) {
      window.clearTimeout(body.canvasNodeAutosaveTimer);
      body.canvasNodeAutosaveTimer = null;
    }
    const nextContent = markdownEditorValue(body);
    if (body.dataset.savedContent === nextContent) return;
    await saveCanvasNodeDraft(node.id, nextContent);
    body.dataset.savedContent = nextContent;
  });
  item.appendChild(body);
  if (editingBody) item.appendChild(renderCanvasInlineMarkdownToolbar(node.id));
  const validationIssues = storyboardValidationIssues(node);
  if (validationIssues.length) {
    const issueButton = document.createElement("button");
    issueButton.type = "button";
    issueButton.className = "canvas-node-issue-badge";
    issueButton.textContent = String(validationIssues.length);
    issueButton.title = "查看分镜问题";
    issueButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    issueButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStoryboardIssueDetail(node.id);
    });
    item.appendChild(issueButton);
  }
  if (isCanvasMergedNode(node)) {
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "canvas-node-merge-badge";
    badge.textContent = "合";
    badge.title = "查看历史版本";
    badge.addEventListener("pointerdown", (event) => event.stopPropagation());
    badge.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCanvasMergeHistory(node.id);
    });
    item.appendChild(badge);
  }
  if (isCanvasRevisionNode(node)) {
    const badge = document.createElement("div");
    badge.className = "canvas-node-revision-badge";
    badge.textContent = "修";
    badge.title = "修改节点";
    item.appendChild(badge);
    item.appendChild(renderCanvasRevisionChat(node));
  }
  applyCanvasNodeBusy(item, node.id);

  const plusSides = node.type === "novel" ? ["right"] : ["left", "right"];
  for (const side of plusSides) {
    item.appendChild(canvasHoverBridge(side));
    item.appendChild(canvasPlusButton(node.id, side));
  }

  const resize = document.createElement("div");
  resize.className = "canvas-resize";
  resize.addEventListener("pointerdown", (event) => startCanvasNodeResize(event, node.id));
  item.appendChild(resize);
  return item;
}

function storyboardValidationIssues(node) {
  const validation = node?.meta?.validation;
  if (!validation || validation.ok) return [];
  return Array.isArray(validation.issues) ? validation.issues : [];
}

function storyboardContentFingerprint(content) {
  const text = String(content || "");
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function openStoryboardIssueDetail(nodeId) {
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  state.storyboardIssueNodeId = nodeId;
  $("storyboardIssueTitle").textContent = `${node.title || "分镜问题"}`;
  const list = $("storyboardIssueList");
  list.innerHTML = "";
  const issues = storyboardValidationIssues(node);
  const hasIssues = issues.length > 0;
  $("autoFixStoryboardIssues").disabled = !hasIssues;
  $("acknowledgeStoryboardIssues").disabled = !hasIssues;
  $("adoptStoryboardIssues").disabled = !hasIssues;
  renderStoryboardIssueText(node.content || "", issues);
  if (!issues.length) {
    list.innerHTML = `<div class="storyboard-issue-empty">暂无问题。</div>`;
  }
  for (const issue of issues) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lineNumber = String(issue.lineNumber || "");
    button.innerHTML = `<strong>第 ${escapeHtml(issue.lineNumber || "")} 行</strong><span>${escapeHtml(issue.message || issue.type || "分镜问题")}</span>`;
    button.addEventListener("click", () => highlightStoryboardIssueLine(issue.lineNumber));
    list.appendChild(button);
  }
  $("storyboardIssueModal").classList.add("open");
  $("storyboardIssueModal").setAttribute("aria-hidden", "false");
}

async function autoFixStoryboardIssues() {
  const sourceNodeId = state.storyboardIssueNodeId;
  const node = currentCanvasNode(sourceNodeId);
  if (!node) return;
  const issues = storyboardValidationIssues(node);
  if (!issues.length) {
    closeStoryboardIssueDetail();
    return;
  }
  closeStoryboardIssueDetail();
  const revisionNode = await createRevisionCanvasNode(sourceNodeId, {
    initialPrompt: storyboardIssueAutoFixPrompt,
    silentStatus: true,
  });
  if (!revisionNode) return;
  canvasStatus("正在根据识别到的分镜问题自动调整...");
  await submitCanvasRevisionChat(revisionNode.id, storyboardIssueAutoFixPrompt);
}

async function resolveStoryboardIssues(action) {
  const node = currentCanvasNode(state.storyboardIssueNodeId);
  if (!node) return;
  const issues = storyboardValidationIssues(node);
  if (!issues.length) {
    closeStoryboardIssueDetail();
    return;
  }
  const normalizedAction = action === "adopt" ? "adopted" : "acknowledged";
  const label = normalizedAction === "adopted" ? "仍然采用" : "我已知晓";
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((item) => {
    if (item.id !== node.id) return item;
    return {
      ...item,
      meta: {
        ...(item.meta || {}),
        validation: {
          ok: true,
          issues: [],
          resolvedIssues: issues,
        },
        validationResolution: {
          action: normalizedAction,
          label,
          issueCount: issues.length,
          resolvedAt: new Date().toISOString(),
          contentFingerprint: storyboardContentFingerprint(item.content),
        },
      },
    };
  });
  await saveCurrentCanvas();
  closeStoryboardIssueDetail();
  renderCanvas();
  canvasStatus(`${label}：当前分镜已标记为可用。`);
}

function renderStoryboardIssueText(content, issues = []) {
  const container = $("storyboardIssueText");
  if (!container) return;
  const issueLines = new Set(
    (Array.isArray(issues) ? issues : [])
      .map((issue) => Number(issue.lineNumber || 0))
      .filter((lineNumber) => Number.isFinite(lineNumber) && lineNumber > 0),
  );
  const lines = String(content || "").split(/\r?\n/);
  container.innerHTML = "";
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const row = document.createElement("div");
    row.className = `storyboard-issue-line${issueLines.has(lineNumber) ? " has-issue" : ""}`;
    row.dataset.lineNumber = String(lineNumber);

    const marker = document.createElement("span");
    marker.className = "storyboard-issue-line-number";
    marker.textContent = String(lineNumber);

    const text = document.createElement("code");
    text.className = "storyboard-issue-line-text";
    text.textContent = line || " ";

    row.append(marker, text);
    container.appendChild(row);
  });
}

function highlightStoryboardIssueLine(lineNumber) {
  const container = $("storyboardIssueText");
  if (!container || !lineNumber) return;
  container.querySelectorAll(".storyboard-issue-line-highlight").forEach((item) => {
    item.classList.remove("storyboard-issue-line-highlight");
  });
  const line = container.querySelector(`[data-line-number="${CSS.escape(String(lineNumber))}"]`);
  if (!line) return;
  line.classList.add("storyboard-issue-line-highlight");
  line.scrollIntoView({ block: "center", behavior: "smooth" });
}

function closeStoryboardIssueDetail() {
  state.storyboardIssueNodeId = "";
  $("storyboardIssueModal").classList.remove("open");
  $("storyboardIssueModal").setAttribute("aria-hidden", "true");
}

function openCanvasMergeHistory(nodeId) {
  const node = currentCanvasNode(nodeId);
  if (!node || !isCanvasMergedNode(node)) return;
  state.canvasMergeHistoryNodeId = nodeId;
  renderCanvasMergedHistoryModal();
  $("canvasMergeHistoryModal").setAttribute("aria-hidden", "false");
}

function closeCanvasMergeHistory() {
  state.canvasMergeHistoryNodeId = "";
  $("canvasMergeHistoryModal").setAttribute("aria-hidden", "true");
  const list = $("canvasMergeHistoryList");
  if (list) list.innerHTML = "";
}

function mergedVersionSourceText(version) {
  const type = version.sourceKind === "revision" ? "修改版本" : "原始版本";
  const parent = version.parentTitleSnapshot ? `｜来源：${version.parentTitleSnapshot}` : "";
  return `${type}${parent}`;
}

function renderCanvasMergedHistoryModal() {
  const node = currentCanvasNode(state.canvasMergeHistoryNodeId);
  const list = $("canvasMergeHistoryList");
  if (!node || !isCanvasMergedNode(node) || !list) return;
  $("canvasMergeHistoryTitle").textContent = `${node.title || "合并节点"} · 历史版本`;
  list.innerHTML = "";
  const versions = node.meta?.versions || [];
  if (!versions.length) {
    list.innerHTML = `<div class="canvas-merge-empty">暂无历史版本。</div>`;
    return;
  }
  for (const version of versions) {
    const item = document.createElement("article");
    item.className = `canvas-merge-version${version.id === node.meta?.primaryVersionId ? " primary" : ""}`;
    item.innerHTML = `
      <div class="canvas-merge-version-head">
        <div>
          <h3>${escapeHtml(version.title || "未命名版本")}</h3>
          <p>${escapeHtml(mergedVersionSourceText(version))}</p>
        </div>
        <button type="button" data-merge-version-id="${escapeHtml(version.id)}"${version.id === node.meta?.primaryVersionId ? " disabled" : ""}>${version.id === node.meta?.primaryVersionId ? "当前唯一" : "设为唯一"}</button>
      </div>
      <div class="canvas-merge-version-grid">
        <section>
          <h4>对话内容</h4>
          <p>${escapeHtml(version.chatPrompt || "无对话内容")}</p>
        </section>
        <section>
          <h4>返回信息</h4>
          <p>${escapeHtml(version.chatResponse || version.content || "无返回信息")}</p>
        </section>
      </div>
    `;
    list.appendChild(item);
  }
}

async function setMergedPrimaryVersion(nodeId, versionId) {
  if (!state.currentCanvas) return;
  const node = currentCanvasNode(nodeId);
  if (!node || !isCanvasMergedNode(node)) return;
  const versions = node.meta?.versions || [];
  const primary = versions.find((version) => version.id === versionId);
  if (!primary) {
    canvasStatus("找不到该历史版本");
    return;
  }
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((item) => {
    if (item.id !== nodeId) return item;
    return {
      ...item,
      title: uniqueCanvasNodeTitle(primary.title || item.title, item.id),
      content: canvasPrimaryVersionContent(primary),
      meta: {
        ...item.meta,
        primaryVersionId: primary.id,
        versions: versions.map((version) => ({
          ...version,
          isPrimary: version.id === primary.id,
        })),
      },
    };
  });
  await saveCurrentCanvas();
  state.selectedCanvasNodeId = nodeId;
  renderCanvas();
  renderCanvasMergedHistoryModal();
  canvasStatus("已更新唯一版本；已生成的下游内容不会自动调整");
}

function renderCanvasRevisionChat(node) {
  const panel = document.createElement("div");
  panel.className = `canvas-node-revision-chat${node.meta?.chatLocked ? " locked" : ""}`;
  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("pointerup", (event) => event.stopPropagation());
  panel.addEventListener("click", (event) => event.stopPropagation());
  panel.addEventListener("dblclick", (event) => event.stopPropagation());
  panel.addEventListener("contextmenu", (event) => event.stopPropagation());

  const parent = currentCanvasNode(node.meta?.parentNodeId);
  const sourceTitle = parent?.title || node.meta?.parentTitleSnapshot || "父级节点";
  const locked = Boolean(node.meta?.chatLocked);

  const header = document.createElement("div");
  header.className = "canvas-node-revision-chat-head";

  const icon = document.createElement("span");
  icon.className = "canvas-node-revision-source-icon";
  icon.textContent = "≡";
  icon.setAttribute("aria-hidden", "true");
  header.appendChild(icon);

  const source = document.createElement("div");
  source.className = "canvas-node-revision-source";
  source.innerHTML = `<strong>来源：${escapeHtml(sourceTitle)}</strong><small>${locked ? "修改已生效，只读" : "输入针对父级内容的调整要求"}</small>`;
  header.appendChild(source);
  panel.appendChild(header);

  const textarea = document.createElement("textarea");
  textarea.className = "canvas-node-revision-input";
  textarea.value = node.meta?.chatPrompt || "";
  textarea.readOnly = locked;
  textarea.placeholder = "写下你想调整的故事、场景或角色设定。";
  textarea.setAttribute("aria-label", "修改要求");
  panel.appendChild(textarea);

  const footer = document.createElement("div");
  footer.className = "canvas-node-revision-actions";
  const send = document.createElement("button");
  send.type = "button";
  send.className = "canvas-node-revision-send";
  send.textContent = locked ? "已生效" : "发送";
  send.disabled = locked;
  send.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await submitCanvasRevisionChat(node.id, textarea.value);
  });
  footer.appendChild(send);
  panel.appendChild(footer);
  return panel;
}

function canvasTypeIcon(type = "label") {
  const safeType = canvasTypeIconPaths[type] ? type : "label";
  return `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${canvasTypeIconPaths[safeType]}</svg>`;
}

function renderCanvasToolbarIcons() {
  document.querySelectorAll(".canvas-toolbar [data-add-node]").forEach((button) => {
    const type = canvasTypeIconPaths[button.dataset.addNode] ? button.dataset.addNode : "label";
    const label = button.dataset.label || button.textContent.trim() || canvasTypeLabels[type] || "节点";
    button.dataset.label = label;
    button.innerHTML = `<span class="canvas-node-type-icon canvas-toolbar-icon ${escapeHtml(type)}" aria-hidden="true">${canvasTypeIcon(type)}</span><span>${escapeHtml(label)}</span>`;
    button.title = canvasTypeLabels[type] || label;
  });
}

function selectCanvasNode(nodeId) {
  state.selectedCanvasNodeId = nodeId;
  state.selectedCanvasNodeIds = new Set();
  state.canvasGroupPrimaryNodeId = "";
  state.selectedCanvasEdgeId = "";
  document.querySelectorAll(".canvas-node").forEach((node) => {
    node.classList.toggle("selected", node.dataset.nodeId === nodeId);
  });
  document.querySelectorAll(".canvas-edge").forEach((edge) => {
    edge.classList.remove("selected");
  });
  renderCanvasGroupBar();
  updateCanvasSelectionModeClass();
  updateCanvasViewportTools();
}

function selectCanvasEdge(edgeId) {
  state.selectedCanvasEdgeId = edgeId;
  state.selectedCanvasNodeId = "";
  state.selectedCanvasNodeIds = new Set();
  state.canvasGroupPrimaryNodeId = "";
  document.querySelectorAll(".canvas-node").forEach((node) => {
    node.classList.remove("selected");
  });
  document.querySelectorAll(".canvas-edge").forEach((edge) => {
    edge.classList.toggle("selected", edge.dataset.edgeId === edgeId);
  });
  renderCanvasGroupBar();
  updateCanvasSelectionModeClass();
  updateCanvasViewportTools();
}

function setCanvasBusy(nodeId, label = "生成中") {
  if (!nodeId) {
    state.canvasBusy = {};
    renderCanvasBusyIndicators();
    return;
  }
  const busy = canvasBusyState();
  busy[nodeId] = { nodeId, label };
  renderCanvasBusyIndicators();
}

function clearCanvasBusy(nodeId) {
  if (!nodeId) {
    setCanvasBusy(null);
    return;
  }
  const busy = canvasBusyState();
  delete busy[nodeId];
  renderCanvasBusyIndicators();
}

function canvasBusyState() {
  if (!state.canvasBusy || typeof state.canvasBusy !== "object" || Array.isArray(state.canvasBusy)) {
    state.canvasBusy = {};
  }
  return state.canvasBusy;
}

function renderCanvasBusyIndicators() {
  document.querySelectorAll(".canvas-node").forEach((item) => {
    applyCanvasNodeBusy(item, item.dataset.nodeId);
  });
}

function applyCanvasNodeBusy(item, nodeId) {
  const busyState = canvasBusyState()[nodeId];
  const isBusy = Boolean(busyState);
  const existing = Array.from(item.children).find((child) => child.classList?.contains("canvas-node-busy"));
  item.classList.toggle("is-generating", isBusy);
  if (!isBusy) {
    existing?.remove();
    return;
  }
  const label = busyState?.label || "生成中";
  const busy = existing || document.createElement("div");
  busy.className = "canvas-node-busy";
  busy.setAttribute("role", "status");
  busy.setAttribute("aria-live", "polite");
  busy.innerHTML = `<span class="canvas-node-busy-spinner" aria-hidden="true"></span><span class="canvas-node-busy-text">${escapeHtml(label)}</span>`;
  if (!existing) item.appendChild(busy);
}

function updateCanvasNodeDraft(nodeId, content) {
  if (!state.currentCanvas) return;
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((node) => {
    if (node.id !== nodeId) return node;
    const contentChanged = String(node.content || "") !== String(content || "");
    if (!contentChanged) return { ...node, content };
    const meta = { ...(node.meta || {}) };
    if (node.type === "storyboard") {
      delete meta.validation;
      delete meta.validationResolution;
    }
    return { ...node, content, meta };
  });
}

async function saveCanvasNodeDraft(nodeId, content) {
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  updateCanvasNodeDraft(nodeId, content);
  await saveCurrentCanvas();
}

function clearCanvasSelection() {
  state.selectedCanvasNodeId = "";
  state.selectedCanvasNodeIds = new Set();
  state.canvasGroupPrimaryNodeId = "";
  state.selectedCanvasEdgeId = "";
  document.querySelectorAll(".canvas-node.selected, .canvas-node.hovering").forEach((node) => {
    node.classList.remove("selected");
    node.classList.remove("hovering");
  });
  document.querySelectorAll(".canvas-edge.selected").forEach((edge) => {
    edge.classList.remove("selected");
  });
  hideCanvasSelectionBox();
  renderCanvasGroupBar();
  updateCanvasSelectionModeClass();
  updateCanvasViewportTools();
}

function updateCanvasSelectionModeClass() {
  $("canvasShell")?.classList.toggle("canvas-multi-selecting", selectedCanvasNodeCount() > 1);
}

function renderCanvasGroupBar() {
  const bar = $("canvasGroupBar");
  const count = $("canvasGroupCount");
  const select = $("canvasGroupPrimarySelect");
  if (!bar || !count || !select) return;
  const nodes = selectedCanvasNodes();
  const canGroup = canGroupCanvasNodes(nodes);
  bar.hidden = nodes.length < 2;
  if (bar.hidden) return;
  count.textContent = canGroup.ok ? `已选 ${nodes.length} 个` : canGroup.reason;
  select.innerHTML = "";
  for (const node of nodes) {
    const option = document.createElement("option");
    option.value = node.id;
    option.textContent = node.title || canvasTypeLabels[node.type] || "节点";
    select.appendChild(option);
  }
  if (!state.canvasGroupPrimaryNodeId || !nodes.some((node) => node.id === state.canvasGroupPrimaryNodeId)) {
    state.canvasGroupPrimaryNodeId = state.selectedCanvasNodeId && nodes.some((node) => node.id === state.selectedCanvasNodeId)
      ? state.selectedCanvasNodeId
      : nodes[0]?.id || "";
  }
  select.value = state.canvasGroupPrimaryNodeId;
  $("mergeSelectedCanvasNodes").disabled = !canGroup.ok;
}

function setCanvasMultiSelection(nodeIds = [], primaryNodeId = "") {
  const ids = new Set(nodeIds.filter(Boolean));
  state.selectedCanvasNodeIds = ids;
  state.selectedCanvasNodeId = primaryNodeId && ids.has(primaryNodeId) ? primaryNodeId : (ids.values().next().value || "");
  state.canvasGroupPrimaryNodeId = state.selectedCanvasNodeId;
  state.selectedCanvasEdgeId = "";
  document.querySelectorAll(".canvas-node").forEach((node) => {
    node.classList.toggle("selected", ids.has(node.dataset.nodeId));
    node.classList.remove("hovering");
  });
  document.querySelectorAll(".canvas-edge.selected").forEach((edge) => edge.classList.remove("selected"));
  renderCanvasGroupBar();
  updateCanvasSelectionModeClass();
  updateCanvasViewportTools();
}

function handleCanvasStageClick(event) {
  if (state.suppressCanvasStageClick) {
    state.suppressCanvasStageClick = false;
    return;
  }
  if (
    event.target.closest?.(".canvas-node, .canvas-edge, .canvas-node-plus, .canvas-action-menu, .canvas-context-menu")
  ) {
    return;
  }
  closeCanvasMenus();
  if (document.activeElement?.closest?.(".canvas-node")) {
    document.activeElement.blur();
  }
  clearCanvasSelection();
}

async function editCanvasNodeTitle(nodeId) {
  const node = currentCanvasNode(nodeId);
  if (!node || !state.currentCanvas) return;
  const nextTitle = window.prompt("节点标题", node.title || "");
  if (nextTitle === null) return;
  const cleanTitle = nextTitle.trim();
  if (!cleanTitle || cleanTitle === node.title) return;
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((item) => item.id === nodeId
    ? { ...item, title: cleanTitle }
    : item);
  await saveCurrentCanvas();
  state.selectedCanvasNodeId = nodeId;
  renderCanvas();
}

function editCanvasNodeTitle(nodeId) {
  const node = currentCanvasNode(nodeId);
  if (!node || !state.currentCanvas) return;
  state.editingCanvasNodeId = nodeId;
  state.selectedCanvasNodeId = nodeId;
  state.selectedCanvasEdgeId = "";
  renderCanvas();
}

async function commitCanvasNodeTitleEdit(nodeId, title) {
  const node = currentCanvasNode(nodeId);
  if (!node || !state.currentCanvas || state.editingCanvasNodeId !== nodeId) return;
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle || cleanTitle === node.title) {
    state.editingCanvasNodeId = "";
    renderCanvas();
    return;
  }
  if (hasCanvasNodeTitleConflict(cleanTitle, nodeId)) {
    state.editingCanvasNodeId = nodeId;
    canvasStatus("节点名称已存在，请换一个名称");
    renderCanvas();
    return;
  }
  state.editingCanvasNodeId = "";
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((item) => item.id === nodeId
    ? { ...item, title: cleanTitle }
    : item);
  await saveCurrentCanvas();
  state.selectedCanvasNodeId = nodeId;
  state.selectedCanvasEdgeId = "";
  renderCanvas();
}

function cancelCanvasNodeTitleEdit() {
  if (!state.editingCanvasNodeId) return;
  state.editingCanvasNodeId = "";
  renderCanvas();
}

function canvasHoverBridge(side) {
  const bridge = document.createElement("div");
  bridge.className = `canvas-node-hover-bridge ${side}`;
  bridge.setAttribute("aria-hidden", "true");
  return bridge;
}

function canvasPlusButton(nodeId, side) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `canvas-node-plus ${side}`;
  button.textContent = "+";
  button.title = side === "left" ? "拖拽连接到其他节点右侧" : "单击生成，拖拽连接到其他节点左侧";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("pointerdown", (event) => beginCanvasEdgeDraft(event, nodeId, side));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.suppressCanvasPlusClick) {
      state.suppressCanvasPlusClick = false;
      event.preventDefault();
      return;
    }
    openCanvasActionMenu(event, nodeId, side);
  });
  return button;
}

function canvasMenuButton(label, action, meta = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.canvasAction = action;
  button.innerHTML = `<span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}`;
  return button;
}

function canvasNodeCreateOptions(node) {
  const revisionOption = canvasRevisionNodeTypes.has(node.type)
    ? [{ label: "修改", action: "create-revision", meta: "对该节点改一版" }]
    : [];
  if (node.type === "novel") {
    return [
      { label: "剧本", action: "generate-script", meta: "按小说生成" },
      { label: "标识", action: "add-label", meta: "补充说明" },
      ...revisionOption,
    ];
  }
  if (node.type === "script") {
    return [
      { label: "分镜脚本", action: "generate-storyboard-all", meta: "一键生成所有集数分镜" },
      { label: "标识", action: "add-label", meta: "补充说明" },
      ...revisionOption,
    ];
  }
  if (node.type === "storyboard") {
    return [
      { label: "标识", action: "add-label", meta: "补充说明" },
      ...revisionOption,
    ];
  }
  return [
    { label: "标识", action: "add-label", meta: "补充说明" },
  ];
}

function openCanvasActionMenu(event, nodeId, side = "right") {
  event.preventDefault();
  const node = currentCanvasNode(nodeId);
  const menu = $("canvasActionMenu");
  if (!node || !menu) return;
  selectCanvasNode(nodeId);
  closeCanvasContextMenu();
  menu.dataset.nodeId = nodeId;
  menu.dataset.edgeId = "";
  menu.dataset.selectedNodeIds = "";
  menu.dataset.side = side;
  menu.innerHTML = "";

  const title = document.createElement("div");
  title.className = "canvas-menu-title";
  title.textContent = side === "left" ? "添加到该节点附近" : "引用该节点生成";
  menu.appendChild(title);

  for (const option of canvasNodeCreateOptions(node)) {
    menu.appendChild(canvasMenuButton(option.label, option.action, option.meta || ""));
  }
  positionFloatingMenu(menu, event.clientX + (side === "left" ? -12 : 12), event.clientY);
}

function openCanvasItemContextMenu(event, item) {
  event.preventDefault();
  event.stopPropagation();
  const menu = $("canvasContextMenu");
  if (!item || !menu) return;
  closeCanvasActionMenu();
  menu.dataset.nodeId = "";
  menu.dataset.edgeId = "";
  menu.dataset.selectedNodeIds = "";
  menu.dataset.canvasItemId = item.id;
  menu.innerHTML = "";
  const title = document.createElement("div");
  title.className = "canvas-menu-title";
  title.textContent = item.title || "画布";
  menu.appendChild(title);
  if (!item.archivedAt) {
    menu.appendChild(canvasMenuButton("重命名", "rename-canvas"));
    menu.appendChild(canvasMenuButton("归档", "archive-canvas"));
  }
  menu.appendChild(canvasMenuButton("删除", "delete-canvas"));
  positionFloatingMenu(menu, event.clientX, event.clientY);
}

function openCanvasContextMenu(event, nodeId) {
  event.preventDefault();
  event.stopPropagation();
  const node = currentCanvasNode(nodeId);
  const menu = $("canvasContextMenu");
  if (!node || !menu) return;
  const selectedIds = state.selectedCanvasNodeIds || new Set();
  const isMultiSelectionMenu = selectedIds.size > 1 && selectedIds.has(nodeId);
  closeCanvasActionMenu();
  menu.dataset.nodeId = isMultiSelectionMenu ? "" : nodeId;
  menu.dataset.edgeId = "";
  menu.dataset.selectedNodeIds = isMultiSelectionMenu ? [...selectedIds].join(",") : "";
  menu.innerHTML = "";
  if (isMultiSelectionMenu) {
    const title = document.createElement("div");
    title.className = "canvas-menu-title";
    title.textContent = `已选 ${selectedIds.size} 个节点`;
    menu.appendChild(title);
    if (!canvasIsArchived()) {
      menu.appendChild(canvasMenuButton("删除选中节点", "delete-selected", "Delete"));
    }
    positionFloatingMenu(menu, event.clientX, event.clientY);
    return;
  }
  selectCanvasNode(nodeId);
  menu.appendChild(canvasMenuButton("复制节点", "copy-node", "Ctrl+C"));
  menu.appendChild(canvasMenuButton("复制文本", "copy-text"));
  if (!canvasIsArchived()) {
    if (node.type === "novel") menu.appendChild(canvasMenuButton("创建剧本", "generate-script"));
    if (node.type === "script") menu.appendChild(canvasMenuButton("创建分镜脚本", "generate-storyboard-all", "全部集数"));
    menu.appendChild(canvasMenuButton("编辑", "edit"));
    menu.appendChild(canvasMenuButton("删除", "delete", "Delete"));
  }
  positionFloatingMenu(menu, event.clientX, event.clientY);
}

function openCanvasBoardContextMenu(event) {
  if (!state.currentCanvas) return;
  if (event.target.closest?.(".canvas-node, .canvas-edge")) return;
  event.preventDefault();
  if (canvasIsArchived()) {
    canvasStatus("归档画布为只读，不能新增节点。");
    return;
  }
  closeCanvasActionMenu();
  const menu = $("canvasContextMenu");
  if (!menu) return;
  const point = canvasStagePoint(event.clientX, event.clientY);
  menu.dataset.nodeId = "";
  menu.dataset.edgeId = "";
  menu.dataset.selectedNodeIds = "";
  menu.dataset.canvasX = String(point.x);
  menu.dataset.canvasY = String(point.y);
  menu.innerHTML = "";

  const title = document.createElement("div");
  title.className = "canvas-menu-title";
  title.textContent = "新增节点";
  menu.appendChild(title);

  const hasNovel = (state.currentCanvas.nodes || []).some((node) => node.type === "novel" && !isCanvasRevisionNode(node));
  const options = [
    { label: hasNovel ? "小说（已存在）" : "小说", action: "canvas-add-novel", disabled: hasNovel, meta: hasNovel ? "每个画布仅允许一个" : "原始材料" },
    { label: "剧本", action: "canvas-add-script" },
    { label: "分镜脚本", action: "canvas-add-storyboard" },
    { label: "标识", action: "canvas-add-label" },
  ];
  for (const option of options) {
    const button = canvasMenuButton(option.label, option.action, option.meta || "");
    button.disabled = Boolean(option.disabled);
    menu.appendChild(button);
  }
  positionFloatingMenu(menu, event.clientX, event.clientY);
}

function openCanvasEdgeMenu(event, edgeId) {
  event.preventDefault();
  event.stopPropagation();
  const edge = currentCanvasEdge(edgeId);
  const menu = $("canvasContextMenu");
  if (!edge || !menu) return;
  selectCanvasEdge(edgeId);
  closeCanvasActionMenu();
  menu.dataset.nodeId = "";
  menu.dataset.edgeId = edgeId;
  menu.dataset.selectedNodeIds = "";
  menu.innerHTML = "";
  const title = document.createElement("div");
  title.className = "canvas-menu-title";
  title.textContent = "连线";
  menu.appendChild(title);
  menu.appendChild(canvasMenuButton(edge.label ? "修改注释" : "添加注释", "edge-label"));
  menu.appendChild(canvasMenuButton("删除连线", "edge-delete", "Delete"));
  positionFloatingMenu(menu, event.clientX, event.clientY);
}

function positionFloatingMenu(menu, x, y) {
  menu.classList.add("open");
  menu.setAttribute("aria-hidden", "false");
  menu.style.left = "0px";
  menu.style.top = "0px";
  const rect = menu.getBoundingClientRect();
  const nextX = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
  const nextY = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
  menu.style.left = `${nextX}px`;
  menu.style.top = `${nextY}px`;
}

function closeCanvasActionMenu() {
  const menu = $("canvasActionMenu");
  if (!menu) return;
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
  menu.innerHTML = "";
}

function closeCanvasContextMenu() {
  const menu = $("canvasContextMenu");
  if (!menu) return;
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
  menu.dataset.edgeId = "";
  menu.dataset.nodeId = "";
  menu.dataset.selectedNodeIds = "";
  menu.dataset.canvasItemId = "";
  menu.dataset.canvasX = "";
  menu.dataset.canvasY = "";
  menu.innerHTML = "";
}

function closeCanvasMenus() {
  closeCanvasActionMenu();
  closeCanvasContextMenu();
}

async function handleCanvasMenuAction(event) {
  const button = event.target.closest("button[data-canvas-action]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const menu = event.currentTarget;
  const nodeId = menu.dataset.nodeId;
  const edgeId = menu.dataset.edgeId;
  const selectedNodeIds = (menu.dataset.selectedNodeIds || "").split(",").filter(Boolean);
  const canvasItemId = menu.dataset.canvasItemId;
  const action = button.dataset.canvasAction;
  const point = {
    x: Number(menu.dataset.canvasX || 0),
    y: Number(menu.dataset.canvasY || 0),
  };
  if (edgeId && action === "edge-label") {
    openCanvasEdgeLabelEditor(menu, edgeId);
    return;
  }
  closeCanvasMenus();
  try {
    if (canvasItemId) {
      await runCanvasItemAction(canvasItemId, action);
      return;
    }
    if (edgeId) {
      await runCanvasEdgeAction(edgeId, action);
      return;
    }
    if (selectedNodeIds.length && action === "delete-selected") {
      await deleteSelectedCanvasNodes(selectedNodeIds);
      return;
    }
    if (!nodeId && action.startsWith("canvas-add-")) {
      await addNodeToCanvas(action.replace("canvas-add-", ""), point);
      return;
    }
    await runCanvasNodeAction(nodeId, action);
  } catch (error) {
    canvasStatus(error.message || "操作失败，请稍后重试。");
  }
}

async function runCanvasItemAction(canvasId, action) {
  if (action === "rename-canvas") {
    const item = state.canvases.find((canvas) => canvas.id === canvasId);
    if (!item) {
      canvasStatus("画布不存在或已被移动。");
      return;
    }
    const row = document.querySelector(`.session-row[data-canvas-id="${CSS.escape(canvasId)}"]`);
    if (row) startRenameCanvas(item, row);
    return;
  }
  if (action === "archive-canvas") {
    if (state.currentCanvasId !== canvasId) await loadCanvas(canvasId);
    await archiveCurrentCanvas(canvasId);
    return;
  }
  if (action === "delete-canvas") {
    if (state.currentCanvasId !== canvasId) await loadCanvas(canvasId);
    await deleteCurrentCanvas();
  }
}

async function runCanvasNodeAction(nodeId, action) {
  if (!nodeId) return;
  if (action === "generate-script") return generateScriptFromNode(nodeId);
  if (action === "generate-storyboard") return planStoryboardsFromNode(nodeId);
  if (action === "generate-storyboard-all") return generateAllStoryboardsFromNode(nodeId);
  if (action === "create-revision") return createRevisionCanvasNode(nodeId);
  if (action === "edit") {
    openCanvasNodeModal(nodeId);
    return;
  }
  if (action === "copy-node") return copyCanvasNode(nodeId);
  if (action === "copy-text") return copyCanvasNodeText(nodeId);
  if (action === "delete") return deleteCanvasNode(nodeId);
  if (action.startsWith("add-")) return addDerivedCanvasNode(nodeId, action.replace("add-", ""));
}

async function runCanvasEdgeAction(edgeId, action) {
  if (action === "edge-label") return editCanvasEdgeLabel(edgeId);
  if (action === "edge-delete") return deleteCanvasEdge(edgeId);
}

function openCanvasEdgeLabelEditor(menu, edgeId) {
  const edge = currentCanvasEdge(edgeId);
  if (!edge || !menu) return;
  menu.dataset.nodeId = "";
  menu.dataset.edgeId = edgeId;
  menu.innerHTML = "";

  const title = document.createElement("div");
  title.className = "canvas-menu-title";
  title.textContent = "连线注释";
  menu.appendChild(title);

  const input = document.createElement("input");
  input.className = "canvas-edge-label-input";
  input.value = edge.label || "";
  input.placeholder = "输入注释，Enter 保存";
  input.setAttribute("aria-label", "连线注释");
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await saveCanvasEdgeLabel(edgeId, input.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeCanvasContextMenu();
    }
  });
  menu.appendChild(input);

  const actions = document.createElement("div");
  actions.className = "canvas-menu-inline-actions";
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "保存";
  save.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await saveCanvasEdgeLabel(edgeId, input.value);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeCanvasContextMenu();
  });
  actions.append(save, cancel);
  menu.appendChild(actions);

  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

async function saveCanvasEdgeLabel(edgeId, label) {
  if (!state.currentCanvas) return;
  const cleanLabel = String(label || "").trim();
  state.currentCanvas.edges = (state.currentCanvas.edges || []).map((item) => item.id === edgeId
    ? { ...item, label: cleanLabel }
    : item);
  state.selectedCanvasEdgeId = edgeId;
  state.selectedCanvasNodeId = "";
  closeCanvasContextMenu();
  await saveCurrentCanvas();
  renderCanvas();
}

async function addDerivedCanvasNode(sourceNodeId, kind) {
  if (!state.currentCanvas) return;
  const source = currentCanvasNode(sourceNodeId);
  if (!source) return;
  const typeByKind = {
    label: "label",
    text: "label",
    image: "label",
    video: "label",
    audio: "label",
    role: "label",
    scene: "label",
  };
  const titleByKind = {
    label: "标识",
    text: "文本",
    image: "图片",
    video: "视频",
    audio: "音频",
    role: "角色",
    scene: "场景",
  };
  const offset = (state.currentCanvas.nodes || []).filter((node) => node.meta?.sourceNodeId === sourceNodeId).length * 34;
  const node = {
    id: `node-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    type: typeByKind[kind] || "label",
    title: uniqueCanvasNodeTitle(titleByKind[kind] || "文本"),
    content: "",
    x: Number(source.x || 0) + Number(source.width || 320) + 120,
    y: Number(source.y || 0) + offset,
    width: 300,
    height: 168,
    meta: { kind, sourceNodeId },
  };
  state.currentCanvas.nodes = [...(state.currentCanvas.nodes || []), node];
  state.currentCanvas.edges = [
    ...(state.currentCanvas.edges || []),
    { id: `edge-${Date.now()}`, from: sourceNodeId, to: node.id, label: titleByKind[kind] || "" },
  ];
  await saveCurrentCanvas();
  renderCanvas();
}

async function groupSelectedCanvasNodes() {
  if (!state.currentCanvas) return;
  const nodes = selectedCanvasNodes();
  const check = canGroupCanvasNodes(nodes);
  if (!check.ok) {
    canvasStatus(check.reason);
    return;
  }
  const primaryId = $("canvasGroupPrimarySelect")?.value || state.canvasGroupPrimaryNodeId || nodes[0].id;
  await createMergedCanvasNode(nodes.map((node) => node.id), primaryId);
}

async function createMergedCanvasNode(nodeIds = [], primaryNodeId = "") {
  if (!state.currentCanvas) return;
  const selectedIds = new Set(nodeIds.filter(Boolean));
  const nodes = (state.currentCanvas.nodes || []).filter((node) => selectedIds.has(node.id));
  const check = canGroupCanvasNodes(nodes);
  if (!check.ok) {
    canvasStatus(check.reason);
    return;
  }
  const primary = nodes.find((node) => node.id === primaryNodeId) || nodes[0];
  const versions = nodes.map((node, index) => canvasVersionFromNode(node, index, selectedIds, primary.id));
  const primaryVersion = versions.find((version) => version.nodeId === primary.id) || versions[0];
  const minX = Math.min(...nodes.map((node) => Number(node.x || 0)));
  const minY = Math.min(...nodes.map((node) => Number(node.y || 0)));
  const maxX = Math.max(...nodes.map((node) => Number(node.x || 0) + Number(node.width || 320)));
  const maxY = Math.max(...nodes.map((node) => Number(node.y || 0) + Number(node.height || 220)));
  const mergedId = `merged-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const mergedNode = {
    id: mergedId,
    type: primary.type,
    title: uniqueCanvasNodeTitleOutside(primaryVersion.title || primary.title || canvasTypeLabels[primary.type] || "节点", selectedIds),
    content: canvasPrimaryVersionContent(primaryVersion),
    x: minX,
    y: minY,
    width: Math.min(900, Math.max(Number(primary.width || 360), Math.min(maxX - minX, 720))),
    height: Math.min(900, Math.max(Number(primary.height || 240), Math.min(maxY - minY, 420))),
    meta: {
      variantKind: "merged",
      primaryVersionId: primaryVersion.id,
      versionIds: versions.map((version) => version.id),
      mergedNodeIds: nodes.map((node) => node.id),
      mergedAt: new Date().toISOString(),
      versions,
    },
  };
  const edgeKeys = new Set();
  const rewiredEdges = [];
  for (const edge of state.currentCanvas.edges || []) {
    const fromSelected = selectedIds.has(edge.from);
    const toSelected = selectedIds.has(edge.to);
    if (fromSelected && toSelected) continue;
    const next = {
      ...edge,
      id: `edge-${edge.id || Date.now()}-${mergedId}`,
      from: fromSelected ? mergedId : edge.from,
      to: toSelected ? mergedId : edge.to,
      fromSide: fromSelected ? "right" : edge.fromSide,
      toSide: toSelected ? "left" : edge.toSide,
    };
    if (next.from === next.to) continue;
    const key = `${next.from}->${next.to}:${next.label || ""}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    rewiredEdges.push(next);
  }
  state.currentCanvas.nodes = [
    ...(state.currentCanvas.nodes || []).filter((node) => !selectedIds.has(node.id)),
    mergedNode,
  ];
  state.currentCanvas.edges = rewiredEdges;
  state.selectedCanvasNodeIds = new Set();
  state.selectedCanvasNodeId = mergedId;
  state.canvasGroupPrimaryNodeId = "";
  state.selectedCanvasEdgeId = "";
  await saveCurrentCanvas();
  renderCanvas();
  canvasStatus("已合并为唯一版本节点");
}

async function createRevisionCanvasNode(sourceNodeId, options = {}) {
  if (!state.currentCanvas) return;
  const source = currentCanvasNode(sourceNodeId);
  if (!source || !canvasRevisionNodeTypes.has(source.type)) {
    canvasStatus("该节点类型暂不支持修改");
    return;
  }
  const siblings = (state.currentCanvas.nodes || []).filter((node) =>
    isCanvasRevisionNode(node) &&
    node.meta?.parentNodeId === sourceNodeId
  );
  const node = {
    id: `revision-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    type: source.type,
    title: uniqueCanvasNodeTitle(`${source.title || canvasTypeLabels[source.type] || "节点"} 修改`),
    content: "",
    x: Number(source.x || 0) + Number(source.width || 320) + 160,
    y: Number(source.y || 0) + siblings.length * 56,
    width: Number(source.width || 360),
    height: Number(source.height || 240),
    meta: {
      variantKind: "revision",
      parentNodeId: source.id,
      parentTitleSnapshot: source.title || "",
      chatPrompt: String(options.initialPrompt || ""),
      chatLocked: false,
      createdAt: new Date().toISOString(),
    },
  };
  state.currentCanvas.nodes = [...(state.currentCanvas.nodes || []), node];
  state.currentCanvas.edges = [
    ...(state.currentCanvas.edges || []),
    {
      id: `edge-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      from: source.id,
      to: node.id,
      label: "修改",
      fromSide: "right",
      toSide: "left",
    },
  ];
  await saveCurrentCanvas();
  state.selectedCanvasNodeId = node.id;
  state.selectedCanvasEdgeId = "";
  renderCanvas();
  if (!options.silentStatus) {
    canvasStatus("已创建修改节点，请在下方输入修改要求");
  }
  return node;
}

async function submitCanvasRevisionChat(nodeId, prompt) {
  if (!state.currentCanvas) return;
  const node = currentCanvasNode(nodeId);
  if (!node || !isCanvasRevisionNode(node)) return;
  if (node.meta?.chatLocked) {
    canvasStatus("该修改节点已经生效，不能再次对话");
    return;
  }
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    canvasStatus("请输入修改要求");
    return;
  }
  canvasStatus("正在根据修改要求生成新版本...");
  setCanvasBusy(nodeId, "修改生成中");
  try {
    const data = await api("/api/canvas/revise-node", {
      method: "POST",
      body: JSON.stringify({
        canvasId: state.currentCanvasId,
        nodeId,
        prompt: cleanPrompt,
      }),
    });
    state.currentCanvas = data.canvas;
    state.selectedCanvasNodeId = nodeId;
    state.selectedCanvasEdgeId = "";
    renderCanvas();
    canvasStatus("修改节点已生成并锁定");
  } catch (error) {
    canvasStatus(error.message);
  } finally {
    clearCanvasBusy(nodeId);
  }
}

async function copyCanvasNode(nodeId) {
  if (!state.currentCanvas) return;
  const source = currentCanvasNode(nodeId);
  if (!source) return;
  const node = {
    ...source,
    id: `node-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    title: uniqueCanvasNodeTitle(`${source.title || "节点"} 副本`),
    x: Number(source.x || 0) + 36,
    y: Number(source.y || 0) + 36,
    meta: { ...(source.meta || {}), copiedFrom: source.id },
  };
  state.currentCanvas.nodes = [...(state.currentCanvas.nodes || []), node];
  await saveCurrentCanvas();
  renderCanvas();
}

async function copyCanvasNodeText(nodeId) {
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  const ok = await copyText(node.content || node.title || "");
  canvasStatus(ok ? "节点文本已复制" : "复制失败");
}

function canvasStagePoint(clientX, clientY) {
  const stage = $("canvasStage");
  const rect = stage?.getBoundingClientRect();
  if (!stage || !rect) return { x: clientX, y: clientY };
  const zoom = canvasZoom();
  return {
    x: (clientX - rect.left + stage.scrollLeft) / zoom - canvasOriginX,
    y: (clientY - rect.top + stage.scrollTop) / zoom - canvasOriginY,
  };
}

function canvasSelectionRect(drag) {
  const start = drag?.startPoint || { x: 0, y: 0 };
  const current = drag?.currentPoint || start;
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function updateCanvasSelectionBox(drag) {
  const box = $("canvasSelectionBox");
  if (!box || !drag) return;
  const rect = canvasSelectionRect(drag);
  box.hidden = false;
  box.style.left = `${canvasScreenX(rect.x)}px`;
  box.style.top = `${canvasScreenY(rect.y)}px`;
  box.style.width = `${Math.max(1, rect.width * canvasZoom())}px`;
  box.style.height = `${Math.max(1, rect.height * canvasZoom())}px`;
}

function hideCanvasSelectionBox() {
  const box = $("canvasSelectionBox");
  if (!box) return;
  box.hidden = true;
  box.style.width = "0px";
  box.style.height = "0px";
}

function rectIntersectsCanvasNode(rect, node) {
  const bounds = canvasNodeBounds(node);
  return !(
    bounds.x + bounds.width < rect.x ||
    bounds.x > rect.x + rect.width ||
    bounds.y + bounds.height < rect.y ||
    bounds.y > rect.y + rect.height
  );
}

function canvasNodeEndpoint(node, side = "right") {
  const zoom = canvasZoom();
  const x = (canvasOriginX + Number(node.x || 0)) * zoom;
  const y = (canvasOriginY + Number(node.y || 0)) * zoom;
  const width = Number(node.width || 0) * zoom;
  const height = Number(node.height || 0) * zoom;
  const cleanSide = side === "left" ? "left" : "right";
  return {
    x: cleanSide === "left" ? x - 2 : x + width + 2,
    y: y + height / 2,
    side: cleanSide,
  };
}

function canvasEdgePath(start, end) {
  const distance = Math.max(80, Math.abs(end.x - start.x) * 0.5);
  const startDirection = start.side === "left" ? -1 : 1;
  const endDirection = end.side === "left" ? -1 : 1;
  const c1 = { x: start.x + distance * startDirection, y: start.y };
  const c2 = { x: end.x + distance * endDirection, y: end.y };
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

function edgeMidpoint(start, end) {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function renderCanvasEdges() {
  const svg = $("canvasEdges");
  if (!svg || !state.currentCanvas) return;
  svg.innerHTML = "";
  const stage = $("canvasStage");
  const surfaceWidth = parseInt(stage?.style.getPropertyValue("--canvas-surface-width"), 10) || canvasSurfaceMinWidth;
  const surfaceHeight = parseInt(stage?.style.getPropertyValue("--canvas-surface-height"), 10) || canvasSurfaceMinHeight;
  svg.setAttribute("width", String(surfaceWidth));
  svg.setAttribute("height", String(surfaceHeight));
  const nodes = new Map((state.currentCanvas.nodes || []).map((node) => [node.id, node]));
  for (const edge of state.currentCanvas.edges || []) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) continue;
    const start = canvasNodeEndpoint(from, edge.fromSide || "right");
    const end = canvasNodeEndpoint(to, edge.toSide || "left");
    svg.appendChild(renderCanvasEdge(edge, start, end));
  }
  if (state.canvasDrag?.type === "connect" && state.canvasDrag.active) {
    const source = nodes.get(state.canvasDrag.nodeId);
    if (source) {
      const start = canvasNodeEndpoint(source, state.canvasDrag.sourceSide);
      const current = state.canvasDrag.current;
      const end = current
        ? { x: canvasScreenX(current.x), y: canvasScreenY(current.y), side: state.canvasDrag.targetSide }
        : start;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "canvas-edge-draft");
      path.setAttribute("d", canvasEdgePath(start, end));
      svg.appendChild(path);
    }
  }
}

function renderCanvasEdge(edge, start, end) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", `canvas-edge${state.selectedCanvasEdgeId === edge.id ? " selected" : ""}`);
  group.dataset.edgeId = edge.id;

  const pathText = canvasEdgePath(start, end);
  const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hit.setAttribute("class", "canvas-edge-hit");
  hit.setAttribute("d", pathText);
  group.appendChild(hit);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("class", "canvas-edge-line");
  line.setAttribute("d", pathText);
  group.appendChild(line);

  if (edge.label) {
    const mid = edgeMidpoint(start, end);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "canvas-edge-label");
    label.setAttribute("x", String(mid.x));
    label.setAttribute("y", String(mid.y - 10));
    label.textContent = String(edge.label).slice(0, 24);
    group.appendChild(label);
  }

  group.addEventListener("click", (event) => openCanvasEdgeMenu(event, edge.id));
  group.addEventListener("contextmenu", (event) => openCanvasEdgeMenu(event, edge.id));
  return group;
}

function activateCanvasEdgeDraft(drag) {
  if (!drag || state.canvasDrag !== drag || drag.active) return;
  drag.active = true;
  if (drag.holdTimer) {
    window.clearTimeout(drag.holdTimer);
    drag.holdTimer = null;
  }
  closeCanvasMenus();
  renderCanvasEdges();
}

function clearCanvasDragHoldTimer(drag) {
  if (!drag?.holdTimer) return;
  window.clearTimeout(drag.holdTimer);
  drag.holdTimer = null;
}

function captureCanvasPointer(target, pointerId) {
  try {
    target?.setPointerCapture?.(pointerId);
  } catch {
    // Pointer capture can fail if the pointer has already ended.
  }
}

function releaseCanvasPointer(target, pointerId) {
  try {
    target?.releasePointerCapture?.(pointerId);
  } catch {
    // Pointer release is best-effort across browser implementations.
  }
}

function activatePendingCanvasNodeDrag(drag) {
  if (!drag || state.canvasDrag !== drag || drag.type !== "move" || !drag.pending) return;
  clearCanvasDragHoldTimer(drag);
  drag.pending = false;
  drag.active = true;
  drag.textarea?.blur?.();
  captureCanvasPointer(drag.trigger, drag.pointerId);
  document.body.classList.add("canvas-node-dragging");
}

function activateCanvasPan(drag) {
  if (!drag || state.canvasDrag !== drag || drag.type !== "pan" || !drag.pending) return;
  clearCanvasDragHoldTimer(drag);
  drag.pending = false;
  drag.active = true;
  captureCanvasPointer(drag.trigger, drag.pointerId);
  document.body.classList.add("canvas-panning");
}

function startCanvasSelection(event) {
  if (!state.currentCanvas || event.button !== 0) return;
  if (event.target?.closest?.(".canvas-node, .canvas-edge, .canvas-context-menu, .canvas-action-menu, .canvas-view-tools, .canvas-group-bar, button, input, textarea, select")) return;
  event.preventDefault();
  closeCanvasMenus();
  const point = canvasStagePoint(event.clientX, event.clientY);
  const drag = {
    type: "select",
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startPoint: point,
    currentPoint: point,
    active: true,
    trigger: $("canvasStage"),
  };
  state.canvasDrag = drag;
  captureCanvasPointer(drag.trigger, drag.pointerId);
  updateCanvasSelectionBox(drag);
}

function beginCanvasEdgeDraft(event, nodeId, side) {
  if (!state.currentCanvas || event.button !== 0) return;
  event.stopPropagation();
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  const draft = {
    type: "connect",
    nodeId,
    pointerId: event.pointerId,
    sourceSide: side === "left" ? "left" : "right",
    targetSide: side === "left" ? "right" : "left",
    startX: event.clientX,
    startY: event.clientY,
    current: canvasStagePoint(event.clientX, event.clientY),
    active: false,
    moved: false,
    holdTimer: null,
    trigger: event.currentTarget,
  };
  draft.holdTimer = window.setTimeout(() => activateCanvasEdgeDraft(draft), canvasConnectHoldMs);
  state.canvasDrag = draft;
}

function findCanvasNodeAtPoint(clientX, clientY, exceptNodeId = "") {
  const element = document.elementFromPoint(clientX, clientY);
  const nodeElement = element?.closest?.(".canvas-node");
  if (!nodeElement || nodeElement.dataset.nodeId === exceptNodeId) return null;
  return currentCanvasNode(nodeElement.dataset.nodeId);
}

async function finishCanvasEdgeDraft(event, draft) {
  if (!draft.active) return;
  const target = findCanvasNodeAtPoint(event.clientX, event.clientY, draft.nodeId);
  if (!target) {
    canvasStatus("未连接：请拖到目标节点后松开");
    return;
  }
  if (!canConnectCanvasNodes(draft.nodeId, target.id)) {
    canvasStatus("修改节点只能保留一个父级来源");
    return;
  }
  const duplicate = (state.currentCanvas.edges || []).some((edge) =>
    edge.from === draft.nodeId &&
    edge.to === target.id &&
    (edge.fromSide || "right") === draft.sourceSide &&
    (edge.toSide || "left") === draft.targetSide
  );
  if (!duplicate) {
    state.currentCanvas.edges = [
      ...(state.currentCanvas.edges || []),
      {
        id: `edge-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        from: draft.nodeId,
        to: target.id,
        label: "",
        fromSide: draft.sourceSide,
        toSide: draft.targetSide,
      },
    ];
    await saveCurrentCanvas();
  }
  state.selectedCanvasEdgeId = "";
}

async function editCanvasEdgeLabel(edgeId) {
  const edge = currentCanvasEdge(edgeId);
  if (!edge || !state.currentCanvas) return;
  const nextLabel = window.prompt("连线注释", edge.label || "");
  if (nextLabel === null) return;
  state.currentCanvas.edges = (state.currentCanvas.edges || []).map((item) => item.id === edgeId
    ? { ...item, label: nextLabel.trim() }
    : item);
  await saveCurrentCanvas();
  state.selectedCanvasEdgeId = edgeId;
  renderCanvas();
}

function closeCanvasDeleteConfirm(confirmed = false) {
  const modal = $("canvasDeleteConfirm");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }
  const pending = state.canvasDeleteConfirm;
  state.canvasDeleteConfirm = null;
  if (pending?.resolve) pending.resolve(Boolean(confirmed));
}

function requestCanvasDeleteConfirm(options) {
  const modal = $("canvasDeleteConfirm");
  if (!modal) return Promise.resolve(false);
  if (state.canvasDeleteConfirm?.resolve) {
    state.canvasDeleteConfirm.resolve(false);
  }
  $("canvasDeleteConfirmTitle").textContent = options.title || "确认删除";
  $("canvasDeleteConfirmMessage").textContent = options.message || "删除后无法撤回。";
  $("canvasDeleteConfirmDetail").textContent = options.detail || "";
  $("confirmCanvasDelete").textContent = options.confirmText || "删除";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  closeCanvasMenus();
  return new Promise((resolve) => {
    state.canvasDeleteConfirm = { resolve };
    window.requestAnimationFrame(() => $("cancelCanvasDelete")?.focus());
  });
}

async function deleteCanvasEdge(edgeId) {
  const edge = currentCanvasEdge(edgeId);
  if (!state.currentCanvas || !edge) return;
  const confirmed = await requestCanvasDeleteConfirm({
    title: "删除连线？",
    message: "删除后，这条连线及它的注释会从画布中移除。",
    detail: edge.label ? `注释：${edge.label}` : "该操作不会删除两端节点。",
    confirmText: "删除连线",
  });
  if (!confirmed) return;
  state.currentCanvas.edges = (state.currentCanvas.edges || []).filter((edge) => edge.id !== edgeId);
  state.selectedCanvasEdgeId = "";
  await saveCurrentCanvas();
  renderCanvas();
}

function startCanvasNodeDrag(event, nodeId, options = {}) {
  if (!state.currentCanvas || event.button !== 0) return;
  if (!options.pending || options.preventSelection) event.preventDefault();
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  const drag = {
    type: "move",
    nodeId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    nodeX: Number(node.x || 0),
    nodeY: Number(node.y || 0),
    pending: Boolean(options.pending),
    active: !options.pending,
    holdTimer: null,
    trigger: event.currentTarget,
    textarea: options.textarea || null,
  };
  if (drag.pending) {
    drag.holdTimer = window.setTimeout(() => activatePendingCanvasNodeDrag(drag), canvasNodeHoldMs);
  } else {
    captureCanvasPointer(event.currentTarget, event.pointerId);
    document.body.classList.add("canvas-node-dragging");
  }
  state.canvasDrag = drag;
}

function startCanvasNodeResize(event, nodeId) {
  if (!state.currentCanvas) return;
  event.preventDefault();
  event.stopPropagation();
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  state.canvasDrag = {
    type: "resize",
    nodeId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    width: Number(node.width || 320),
    height: Number(node.height || 220),
    trigger: event.currentTarget,
  };
}

function beginCanvasPan(event) {
  if (!state.currentCanvas || event.button !== 1) return;
  if (event.target?.closest?.(".canvas-context-menu, .canvas-action-menu, .modal, button, input, textarea, select")) return;
  event.preventDefault();
  event.stopPropagation();
  const stage = $("canvasStage");
  const drag = {
    type: "pan",
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: stage.scrollLeft,
    scrollTop: stage.scrollTop,
    pending: true,
    active: false,
    holdTimer: null,
    trigger: stage,
  };
  drag.holdTimer = window.setTimeout(() => activateCanvasPan(drag), canvasPanHoldMs);
  state.canvasDrag = drag;
}

function updateCanvasPointer(event) {
  const drag = state.canvasDrag;
  if (!drag || !state.currentCanvas) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  const canvasDx = dx / canvasZoom();
  const canvasDy = dy / canvasZoom();
  if (drag.type === "select") {
    drag.currentPoint = canvasStagePoint(event.clientX, event.clientY);
    updateCanvasSelectionBox(drag);
    return;
  }
  if (drag.type === "connect") {
    drag.current = canvasStagePoint(event.clientX, event.clientY);
    if (Math.hypot(dx, dy) > canvasConnectMovePx) {
      drag.moved = true;
    }
    if (drag.active) renderCanvasEdges();
    return;
  }
  if (drag.type === "pan") {
    if (!drag.active) return;
    const stage = $("canvasStage");
    stage.scrollLeft = drag.scrollLeft - dx;
    stage.scrollTop = drag.scrollTop - dy;
    return;
  }
  if (drag.type === "move" && !drag.active) {
    if (Math.hypot(dx, dy) < canvasNodeMovePx) return;
    activatePendingCanvasNodeDrag(drag);
  }
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).map((node) => {
    if (node.id !== drag.nodeId) return node;
    if (drag.type === "move") {
      return { ...node, x: drag.nodeX + canvasDx, y: drag.nodeY + canvasDy };
    }
    return {
      ...node,
      width: Math.max(220, drag.width + canvasDx),
      height: Math.max(120, drag.height + canvasDy),
    };
  });
  renderCanvas();
}

async function endCanvasPointer(event) {
  if (!state.canvasDrag) return;
  const drag = state.canvasDrag;
  state.canvasDrag = null;
  clearCanvasDragHoldTimer(drag);
  if (drag.type === "connect") {
    releaseCanvasPointer(drag.trigger, drag.pointerId);
    if (!drag.active) {
      state.suppressCanvasPlusClick = false;
      return;
    }
    state.suppressCanvasPlusClick = true;
    await finishCanvasEdgeDraft(event, drag);
    renderCanvas();
    return;
  }
  if (drag.type === "pan") {
    releaseCanvasPointer(drag.trigger, drag.pointerId);
    document.body.classList.remove("canvas-panning");
    return;
  }
  if (drag.type === "select") {
    releaseCanvasPointer(drag.trigger, drag.pointerId);
    const rect = canvasSelectionRect(drag);
    hideCanvasSelectionBox();
    if (rect.width < 6 && rect.height < 6) {
      clearCanvasSelection();
      return;
    }
    state.suppressCanvasStageClick = true;
    const ids = (state.currentCanvas.nodes || [])
      .filter((node) => rectIntersectsCanvasNode(rect, node))
      .map((node) => node.id);
    if (ids.length) {
      setCanvasMultiSelection(ids, ids[0]);
      const canGroup = canGroupCanvasNodes(selectedCanvasNodes());
      if (canGroup.ok) {
        canvasStatus("", { force: true });
      } else {
        canvasStatus(canGroup.reason);
      }
    } else {
      clearCanvasSelection();
    }
    return;
  }
  if (drag.type === "move") {
    releaseCanvasPointer(drag.trigger, drag.pointerId);
    document.body.classList.remove("canvas-node-dragging");
    if (!drag.active) return;
    state.suppressCanvasTitleClick = true;
    window.setTimeout(() => {
      state.suppressCanvasTitleClick = false;
    }, 350);
  }
  if (drag.type === "resize") {
    releaseCanvasPointer(drag.trigger, drag.pointerId);
  }
  await saveCurrentCanvas();
  renderCanvas();
}

function openCanvasNodeModal(nodeId, options = {}) {
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  const editable = isCanvasNodeContentEditable(node);
  state.activeCanvasNodeId = nodeId;
  const titleInput = $("canvasNodeTitle");
  const contentInput = $("canvasNodeContent");
  titleInput.value = node.title || "";
  titleInput.readOnly = !editable;
  setMarkdownEditorValue(contentInput, node.content || "");
  contentInput.contentEditable = editable ? "true" : "false";
  contentInput.dataset.editable = String(editable);
  renderMarkdownToolbarContent($("canvasNodeMarkdownToolbar"), nodeId);
  $("canvasNodeMarkdownToolbar").hidden = !editable;
  $("generateScriptFromNode").hidden = !editable || node.type !== "novel";
  $("generateStoryboardsFromNode").hidden = !editable || node.type !== "script";
  $("canvasNodeModal").classList.add("open");
  $("canvasNodeModal").setAttribute("aria-hidden", "false");
  if (options.focusContent && editable) {
    window.setTimeout(() => {
      focusMarkdownEditorEnd(contentInput);
    }, 0);
  }
}

async function closeCanvasNodeModal() {
  await flushActiveCanvasNodeAutosave({ render: true });
  $("canvasNodeModal").classList.remove("open");
  $("canvasNodeModal").setAttribute("aria-hidden", "true");
}

function applyMarkdownFormat(textarea, options = {}) {
  if (!textarea || textarea.getAttribute("contenteditable") !== "true") return;
  applyMarkdownEditorFormat(textarea, options);
}

function sanitizeMarkdownColor(color) {
  const value = String(color || "").trim().toLowerCase();
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(value)) return "";
  return value;
}

function expandHexColor(color) {
  const safeColor = sanitizeMarkdownColor(color);
  if (!safeColor) return "";
  if (safeColor.length === 7) return safeColor;
  return `#${safeColor.slice(1).split("").map((part) => `${part}${part}`).join("")}`;
}

function hexToRgb(color) {
  const expanded = expandHexColor(color);
  if (!expanded) return null;
  return {
    r: Number.parseInt(expanded.slice(1, 3), 16),
    g: Number.parseInt(expanded.slice(3, 5), 16),
    b: Number.parseInt(expanded.slice(5, 7), 16),
  };
}

function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function colorContrastRatio(colorA, colorB) {
  const luminanceA = relativeLuminance(hexToRgb(colorA));
  const luminanceB = relativeLuminance(hexToRgb(colorB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function readableTextColorForBackground(backgroundColor) {
  const safeColor = sanitizeMarkdownColor(backgroundColor);
  if (!safeColor) return "";
  const darkText = "#171615";
  const lightText = "#fffaf2";
  return colorContrastRatio(safeColor, lightText) >= colorContrastRatio(safeColor, darkText)
    ? lightText
    : darkText;
}

function applyActiveCanvasNodeEditorDraft() {
  const nodeId = state.activeCanvasNodeId;
  if (!nodeId || !state.currentCanvas) return false;
  const activeNode = currentCanvasNode(nodeId);
  if (!isCanvasNodeContentEditable(activeNode)) {
    return false;
  }
  const nextTitle = $("canvasNodeTitle").value.trim();
  const hasTitleConflict = nextTitle && hasCanvasNodeTitleConflict(nextTitle, nodeId);
  if (hasTitleConflict) {
    canvasStatus("节点名称已存在，请换一个名称");
  }
  state.currentCanvas.nodes = state.currentCanvas.nodes.map((node) => node.id === nodeId
    ? {
        ...node,
        title: nextTitle && !hasTitleConflict ? nextTitle : node.title,
        content: markdownEditorValue($("canvasNodeContent")),
      }
    : node);
  return true;
}

function scheduleActiveCanvasNodeAutosave() {
  if (!applyActiveCanvasNodeEditorDraft()) return;
  if (state.canvasNodeAutosaveTimer) {
    window.clearTimeout(state.canvasNodeAutosaveTimer);
  }
  state.canvasNodeAutosaveTimer = window.setTimeout(async () => {
    state.canvasNodeAutosaveTimer = null;
    try {
      await saveCurrentCanvas();
    } catch (error) {
      canvasStatus(error.message);
    }
  }, canvasNodeAutosaveDelayMs);
}

async function flushActiveCanvasNodeAutosave(options = {}) {
  if (state.canvasNodeAutosaveTimer) {
    window.clearTimeout(state.canvasNodeAutosaveTimer);
    state.canvasNodeAutosaveTimer = null;
  }
  if (!applyActiveCanvasNodeEditorDraft()) return;
  try {
    await saveCurrentCanvas();
    if (options.render) renderCanvas();
  } catch (error) {
    canvasStatus(error.message);
  }
}

async function saveActiveCanvasNode() {
  await flushActiveCanvasNodeAutosave({ render: true });
}

async function deleteCanvasNode(nodeId) {
  if (!state.currentCanvas) return;
  const node = currentCanvasNode(nodeId);
  if (!node) return;
  const connectedCount = (state.currentCanvas.edges || []).filter((edge) => edge.from === nodeId || edge.to === nodeId).length;
  const confirmed = await requestCanvasDeleteConfirm({
    title: "删除节点？",
    message: connectedCount > 0
      ? `删除后，该节点和 ${connectedCount} 条关联连线会一起移除。`
      : "删除后，该节点会从画布中移除。",
    detail: `${canvasTypeLabels[node.type] || "节点"}：${node.title || "未命名节点"}`,
    confirmText: "删除节点",
  });
  if (!confirmed) return;
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).filter((node) => node.id !== nodeId);
  state.currentCanvas.edges = (state.currentCanvas.edges || []).filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  await saveCurrentCanvas();
  renderCanvas();
}

async function deleteSelectedCanvasNodes(nodeIds = []) {
  if (!state.currentCanvas || canvasIsArchived()) return;
  const ids = new Set(nodeIds.filter((id) => currentCanvasNode(id)));
  if (!ids.size) return;
  const connectedCount = (state.currentCanvas.edges || []).filter((edge) => ids.has(edge.from) || ids.has(edge.to)).length;
  const confirmed = await requestCanvasDeleteConfirm({
    title: "删除选中节点？",
    message: connectedCount > 0
      ? `删除后，${ids.size} 个节点和 ${connectedCount} 条关联连线会一起移除。`
      : `删除后，${ids.size} 个节点会从画布中移除。`,
    detail: "已框选的节点",
    confirmText: "删除选中节点",
  });
  if (!confirmed) return;
  state.currentCanvas.nodes = (state.currentCanvas.nodes || []).filter((node) => !ids.has(node.id));
  state.currentCanvas.edges = (state.currentCanvas.edges || []).filter((edge) => !ids.has(edge.from) && !ids.has(edge.to));
  state.selectedCanvasNodeId = "";
  state.selectedCanvasNodeIds = new Set();
  state.selectedCanvasEdgeId = "";
  state.canvasGroupPrimaryNodeId = "";
  await saveCurrentCanvas();
  renderCanvas();
  canvasStatus(`已删除 ${ids.size} 个选中节点`);
}

async function generateScriptFromNode(nodeId = state.activeCanvasNodeId) {
  if (nodeId === state.activeCanvasNodeId) await flushActiveCanvasNodeAutosave();
  canvasStatus("正在从小说节点生成剧本...");
  setCanvasBusy(nodeId, "剧本生成中");
  try {
    const data = await api("/api/canvas/generate-script", {
      method: "POST",
      body: JSON.stringify({ canvasId: state.currentCanvasId, nodeId }),
    });
    state.currentCanvas = data.canvas;
    closeCanvasNodeModal();
    renderCanvas();
    canvasStatus("剧本节点已生成");
  } catch (error) {
    canvasStatus(error.message);
  } finally {
    clearCanvasBusy(nodeId);
  }
}

async function planStoryboardsFromNode(nodeId = state.activeCanvasNodeId) {
  if (nodeId === state.activeCanvasNodeId) await flushActiveCanvasNodeAutosave();
  canvasStatus("正在识别剧本分集...");
  setCanvasBusy(nodeId, "分集识别中");
  try {
    const data = await api("/api/canvas/plan-storyboards", {
      method: "POST",
      body: JSON.stringify({ canvasId: state.currentCanvasId, nodeId }),
    });
    state.pendingEpisodes = data;
    renderEpisodeConfirm(data.episodes || []);
  } catch (error) {
    canvasStatus(error.message);
  } finally {
    clearCanvasBusy(nodeId);
  }
}

async function generateAllStoryboardsFromNode(nodeId) {
  if (!nodeId) return;
  canvasStatus("正在识别分集并生成全部分镜...");
  setCanvasBusy(nodeId, "分镜生成中");
  try {
    const plan = await api("/api/canvas/plan-storyboards", {
      method: "POST",
      body: JSON.stringify({ canvasId: state.currentCanvasId, nodeId }),
    });
    const episodes = Array.isArray(plan.episodes) ? plan.episodes : [];
    if (!episodes.length) {
      canvasStatus("没有识别到可生成的分集");
      return;
    }
    const data = await api("/api/canvas/generate-storyboards", {
      method: "POST",
      body: JSON.stringify({
        canvasId: state.currentCanvasId,
        nodeId: plan.scriptNodeId || nodeId,
        episodes,
      }),
    });
    state.currentCanvas = data.canvas;
    state.pendingEpisodes = null;
    closeCanvasNodeModal();
    renderCanvas();
    canvasStatus(`已生成 ${data.nodes?.length || episodes.length} 个分镜脚本节点`);
  } catch (error) {
    canvasStatus(error.message);
  } finally {
    setCanvasBusy(null);
  }
}

function renderEpisodeConfirm(episodes) {
  const list = $("episodeConfirmList");
  list.innerHTML = "";
  episodes.forEach((episode, index) => {
    const row = document.createElement("label");
    row.className = "episode-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = String(index);
    const body = document.createElement("div");
    body.innerHTML = `<strong>${escapeHtml(episode.title || `第${index + 1}集`)}</strong><small>${escapeHtml((episode.content || "").slice(0, 160))}</small>`;
    row.appendChild(checkbox);
    row.appendChild(body);
    list.appendChild(row);
  });
  $("episodeConfirmModal").classList.add("open");
  $("episodeConfirmModal").setAttribute("aria-hidden", "false");
}

function closeEpisodeConfirm() {
  $("episodeConfirmModal").classList.remove("open");
  $("episodeConfirmModal").setAttribute("aria-hidden", "true");
}

async function generateConfirmedStoryboards() {
  if (!state.pendingEpisodes) return;
  const selected = Array.from($("episodeConfirmList").querySelectorAll("input[type='checkbox']"))
    .filter((input) => input.checked)
    .map((input) => state.pendingEpisodes.episodes[Number(input.dataset.index)])
    .filter(Boolean);
  if (!selected.length) {
    canvasStatus("请至少选择一集");
    return;
  }
  closeEpisodeConfirm();
  closeCanvasNodeModal();
  const sourceNodeId = state.pendingEpisodes.scriptNodeId;
  canvasStatus(`正在生成 ${selected.length} 个分镜节点...`);
  setCanvasBusy(sourceNodeId, "分镜生成中");
  try {
    const data = await api("/api/canvas/generate-storyboards", {
      method: "POST",
      body: JSON.stringify({
        canvasId: state.currentCanvasId,
        nodeId: sourceNodeId,
        episodes: selected,
      }),
    });
    state.currentCanvas = data.canvas;
    state.pendingEpisodes = null;
    renderCanvas();
    canvasStatus(`已生成 ${data.nodes?.length || selected.length} 个分镜节点`);
  } catch (error) {
    canvasStatus(error.message);
  } finally {
    setCanvasBusy(null);
  }
}

function openWorkbench() {
  state.workbenchOpen = true;
  state.workbenchRunName = state.currentRunName || state.workbenchRunName;
  $("workbench").classList.add("open");
  $("workbench").setAttribute("aria-hidden", "false");
  loadWorkbench();
}

function closeWorkbench() {
  state.workbenchOpen = false;
  $("workbench").classList.remove("open");
  $("workbench").setAttribute("aria-hidden", "true");
}

async function loadWorkbench() {
  const status = $("workbenchStatus");
  const list = $("workbenchStages");
  const runNode = $("workbenchRunName");
  if (!status || !list || !runNode) return;
  await loadWorkbenchRuns();
  const activeRun = state.workbenchRunName || state.currentRunName;
  runNode.textContent = activeRun ? `当前对话：${formatWorkbenchRunLabel(activeRun)}` : "尚未选择对话";
  runNode.title = activeRun || "";
  hideArtifactPreview();
  if (!activeRun) {
    status.textContent = "还没有可查看的对话，请先新建或打开一个对话。";
    list.innerHTML = "";
    return;
  }
  status.textContent = "读取中...";
  list.innerHTML = "";
  state.workbenchLoading = true;
  try {
    const data = await api(`/api/workbench?run=${encodeURIComponent(activeRun)}`);
    renderWorkbench(data);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.workbenchLoading = false;
  }
}

async function loadWorkbenchRuns() {
  const select = $("workbenchRunSelect");
  if (!select) return;
  const data = await api("/api/runs");
  state.runs = data.runs || [];
  if (!state.workbenchRunName && state.currentRunName) {
    state.workbenchRunName = state.currentRunName;
  }
  select.innerHTML = "";
  for (const run of state.runs) {
    const option = document.createElement("option");
    option.value = run.name;
    option.textContent = run.title && run.title !== run.name ? run.title : formatWorkbenchRunLabel(run.name);
    option.title = run.name;
    select.appendChild(option);
  }
  select.disabled = state.runs.length === 0;
  if (state.workbenchRunName && state.runs.some((run) => run.name === state.workbenchRunName)) {
    select.value = state.workbenchRunName;
  } else if (state.runs.length) {
    state.workbenchRunName = select.value || state.runs[0].name;
  }
}

function formatWorkbenchRunLabel(runName) {
  const text = String(runName || "").trim();
  const match = text.match(/^(\d{8})-(\d{6})-\w+-web-chat-(.+)$/);
  if (!match) return text || "未命名对话";
  const [, date, time, title] = match;
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const hour = time.slice(0, 2);
  const minute = time.slice(2, 4);
  return `${month}月${day}日 ${hour}:${minute}｜${title || "未命名对话"}`;
}

function renderWorkbench(data) {
  const status = $("workbenchStatus");
  const list = $("workbenchStages");
  if (!status || !list) return;
  const nodeCount = Number(data.nodeCount || 0);
  const candidates = Array.isArray(data.archiveCandidates) ? data.archiveCandidates.length : 0;
  status.textContent = `流程节点 ${nodeCount} 个｜可归档节点 ${candidates} 个${data.inputAvailable ? "｜已收到输入材料" : "｜还没有输入材料"}`;
  list.innerHTML = "";
  if (!data.tree) {
    list.innerHTML = `<div class="empty-state">当前运行还没有可查看的流程节点。</div>`;
    renderArchiveSelections();
    return;
  }
  list.appendChild(renderMindMapTree(data.tree));
  renderArchiveSelections();
}

function renderMindMapTree(root) {
  const wrap = document.createElement("div");
  wrap.className = "mind-map-tree";
  wrap.appendChild(renderMindMapNode(root, 0));
  return wrap;
}

function renderMindMapNode(node, depth) {
  const item = document.createElement("div");
  item.className = `mind-node depth-${depth} ${node.status || ""} ${node.file ? "clickable" : ""}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mind-node-card";
  button.disabled = !node.file && !(node.emptyText && node.status === "empty");
  const title = document.createElement("span");
  title.className = "mind-node-title";
  title.textContent = node.title || "未命名节点";
  button.appendChild(title);
  const meta = document.createElement("span");
  meta.className = "mind-node-meta";
  if (node.file) {
    meta.textContent = `${node.file}｜${formatFileSize(node.size)}${node.updatedAt ? `｜${formatMessageTime(node.updatedAt)}` : ""}`;
  } else {
    const count = Array.isArray(node.children) ? node.children.length : 0;
    meta.textContent = node.type === "root" ? "点击子节点查看内容" : count ? `${count} 个节点` : node.emptyText || "暂无内容";
  }
  button.appendChild(meta);
  button.addEventListener("click", () => previewWorkbenchNode(node));
  item.appendChild(button);

  if (Array.isArray(node.children) && node.children.length) {
    const children = document.createElement("div");
    children.className = "mind-node-children";
    for (const child of node.children) {
      children.appendChild(renderMindMapNode(child, depth + 1));
    }
    item.appendChild(children);
  }
  return item;
}

async function previewWorkbenchNode(node) {
  state.activeWorkbenchNode = node;
  const addButton = $("addArchiveSelection");
  if (addButton) {
    addButton.hidden = !node.archiveEligible;
  }
  if (!node.file) {
    const panel = $("artifactPreview");
    const titleNode = $("artifactPreviewTitle");
    const body = $("artifactPreviewBody");
    if (!panel || !titleNode || !body) return;
    panel.hidden = false;
    titleNode.textContent = node.title || "节点内容";
    body.textContent = node.emptyText || "这个节点用于组织流程，没有单独的产物文件。";
    return;
  }
  await previewWorkbenchArtifact(node.file, node.title, node);
}

async function previewWorkbenchArtifact(file, title, sourceNode = null) {
  const activeRun = state.workbenchRunName || state.currentRunName;
  if (!activeRun || !file) return;
  const panel = $("artifactPreview");
  const titleNode = $("artifactPreviewTitle");
  const body = $("artifactPreviewBody");
  if (!panel || !titleNode || !body) return;
  state.activeWorkbenchNode = sourceNode || { file, title, archiveEligible: true };
  const addButton = $("addArchiveSelection");
  if (addButton) addButton.hidden = sourceNode ? !sourceNode.archiveEligible : false;
  panel.hidden = false;
  titleNode.textContent = `${title || "节点内容"}｜${file}`;
  body.textContent = "读取中...";
  try {
    const data = await api(`/api/artifact?run=${encodeURIComponent(activeRun)}&file=${encodeURIComponent(file)}`);
    const content = data.raw || "";
    if (window.MbhMarkdown && typeof window.MbhMarkdown.renderMarkdown === "function") {
      body.innerHTML = window.MbhMarkdown.renderMarkdown(content);
    } else {
      body.textContent = content;
    }
  } catch (error) {
    body.textContent = error.message;
  }
}

function hideArtifactPreview() {
  const panel = $("artifactPreview");
  const body = $("artifactPreviewBody");
  if (panel) panel.hidden = true;
  if (body) body.textContent = "";
  state.activeWorkbenchNode = null;
}

function addActiveNodeToArchive() {
  const node = state.activeWorkbenchNode;
  if (!node || !node.file || !node.archiveEligible) return;
  if (state.archiveSelections.some((item) => item.file === node.file)) {
    const stateNode = $("archiveState");
    if (stateNode) stateNode.textContent = "这个节点已经在采纳清单里。";
    return;
  }
  state.archiveSelections.push({
    title: node.title || node.file,
    file: node.file,
    scope: "",
    decision: "采纳",
    reason: "",
  });
  renderArchiveSelections();
  const stateNode = $("archiveState");
  if (stateNode) stateNode.textContent = "已加入采纳清单。";
}

function renderArchiveSelections() {
  const list = $("archiveSelectionList");
  const stateNode = $("archiveState");
  if (!list) return;
  list.innerHTML = "";
  if (!state.archiveSelections.length) {
    list.innerHTML = `<div class="empty-state">还没有采纳项。</div>`;
    if (stateNode) stateNode.textContent = "从思维导图里点击节点，再加入归档。";
    return;
  }
  state.archiveSelections.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "archive-selection";
    const head = document.createElement("div");
    head.className = "archive-selection-head";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
      state.archiveSelections.splice(index, 1);
      renderArchiveSelections();
    });
    head.append(title, remove);

    const file = document.createElement("small");
    file.textContent = item.file;
    const scope = document.createElement("input");
    scope.placeholder = "采纳范围，如：第1-2集 / 开场镜头 / 某条规则";
    scope.value = item.scope;
    scope.addEventListener("input", () => {
      item.scope = scope.value;
    });
    const reason = document.createElement("input");
    reason.placeholder = "采纳原因，如：冲突更清楚、节奏更稳";
    reason.value = item.reason;
    reason.addEventListener("input", () => {
      item.reason = reason.value;
    });
    row.append(head, file, scope, reason);
    list.appendChild(row);
  });
  if (stateNode) stateNode.textContent = `已选择 ${state.archiveSelections.length} 条采纳项。`;
}

async function submitArchiveLearning() {
  const activeRun = state.workbenchRunName || state.currentRunName;
  const stateNode = $("archiveState");
  if (!activeRun) {
    if (stateNode) stateNode.textContent = "请先选择一次运行。";
    return;
  }
  if (!state.archiveSelections.length) {
    if (stateNode) stateNode.textContent = "请先加入至少一条采纳项。";
    return;
  }
  if (stateNode) stateNode.textContent = "归档中...";
  try {
    const data = await api("/api/archive-learning", {
      method: "POST",
      body: JSON.stringify({ run: activeRun, selections: state.archiveSelections }),
    });
    state.archiveSelections = [];
    renderArchiveSelections();
    if (stateNode) stateNode.textContent = `已归档：${data.learningRecord}`;
    await loadWorkbench();
  } catch (error) {
    if (stateNode) stateNode.textContent = error.message;
  }
}

function openSettings(tab = "deepseek") {
  if (tab === "learning") {
    openLearningPage();
    return;
  }
  $("settings").classList.add("open");
  $("settings").setAttribute("aria-hidden", "false");
  switchSettingsTab(tab);
}

function closeSettings() {
  $("settings").classList.remove("open");
  $("settings").setAttribute("aria-hidden", "true");
}

function openTrash() {
  state.trashMode = currentTrashMode();
  $("trash").classList.add("open");
  $("trash").setAttribute("aria-hidden", "false");
  renderTrashPanel();
}

function closeTrash() {
  $("trash").classList.remove("open");
  $("trash").setAttribute("aria-hidden", "true");
}

function openLearningLibrary() {
  openLearningPage();
}

function openLearningPage() {
  closeSettings();
  $("learningPage").classList.add("open");
  $("learningPage").setAttribute("aria-hidden", "false");
  loadLearningPanel();
}

function closeLearningPage() {
  $("learningPage").classList.remove("open");
  $("learningPage").setAttribute("aria-hidden", "true");
}

function openCanvasArchivePage() {
  closeSettings();
  closeLearningPage();
  closeWorkbench();
  $("canvasArchivePage").classList.add("open");
  $("canvasArchivePage").setAttribute("aria-hidden", "false");
  loadCanvasArchiveItems();
}

function closeCanvasArchivePage() {
  $("canvasArchivePage").classList.remove("open");
  $("canvasArchivePage").setAttribute("aria-hidden", "true");
}

function openArchiveView() {
  openCanvasArchivePage();
}

function switchSettingsTab(tab) {
  if (tab === "learning") {
    openLearningPage();
    return;
  }
  const target = "deepseek";
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    const active = button.dataset.settingsTab === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    const active = panel.dataset.settingsPanel === target;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  loadConfig();
}

async function loadConfig() {
  const data = await api("/api/config");
  applyAppName(data.appName);
  $("configAppName").value = data.appName || state.appName;
  $("configProvider").value = data.provider || "deepseek";
  renderModelProviderFields(data.provider || "deepseek", data.model);
  $("configBaseUrl").value = data.baseUrl || providerDefaults[data.provider || "deepseek"].baseUrl;
  updateApiKeySavedState(data.hasEnvApiKey || data.hasStoredApiKey, data.hasEnvApiKey);
  state.testedModelConfigSignature = data.hasEnvApiKey || data.hasStoredApiKey
    ? modelConfigSignature(currentModelConfigPayload())
    : "";
  $("configState").textContent = data.hasEnvApiKey
    ? `已检测到环境变量 ${providerDefaults[data.provider || "deepseek"].keyName}`
    : data.hasStoredApiKey
      ? `已保存本地 ${providerDefaults[data.provider || "deepseek"].keyName}`
      : `尚未配置 ${providerDefaults[data.provider || "deepseek"].keyName}`;
}

function renderModelProviderFields(provider, selectedModel = "") {
  const id = providerDefaults[provider] ? provider : "deepseek";
  const defaults = providerDefaults[id];
  const modelSelect = $("configModel");
  modelSelect.innerHTML = "";
  const models = defaults.models.includes(selectedModel) || !selectedModel
    ? defaults.models
    : [selectedModel, ...defaults.models];
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  }
  modelSelect.value = selectedModel || defaults.models[0];
  $("configBaseUrl").placeholder = defaults.baseUrl;
  if (!$("configBaseUrl").value || $("configBaseUrl").dataset.provider !== id) {
    $("configBaseUrl").value = defaults.baseUrl;
  }
  $("configBaseUrl").dataset.provider = id;
  const input = $("configApiKey");
  if (input && input.dataset.masked !== "true") {
    input.placeholder = `请输入 ${defaults.keyName}`;
  }
}

function applyAppName(appName) {
  const nextName = String(appName || "").trim() || "猫主子漫剧剧本分镜小助手";
  const oldName = state.appName || "猫主子漫剧剧本分镜小助手";
  state.appName = nextName;
  document.title = nextName;
  if (!$("chatTitle").textContent || $("chatTitle").textContent === oldName || $("chatTitle").textContent === "猫主子漫剧剧本分镜小助手") {
    $("chatTitle").textContent = nextName;
  }
}

async function loadLearningPanel() {
  await loadLearningLibrary();
}

async function loadLearningLibrary() {
  const records = $("learningLibraryRecords");
  if (!records) return;
  try {
    state.learningLibrary = await api("/api/learning-library");
    renderLearningLibrary();
  } catch (error) {
    const status = $("learningStatus");
    if (status) status.textContent = `学习资料读取失败：${error.message}`;
    records.innerHTML = `<div class="learning-library-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderLearningLibrary() {
  const data = state.learningLibrary || { records: [], currentRules: [], skills: [] };
  renderLearningTabCounts(data);
  document.querySelectorAll("[data-learning-library-tab]").forEach((button) => {
    const active = button.dataset.learningLibraryTab === state.learningLibraryTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-learning-library-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.learningLibraryPanel !== state.learningLibraryTab;
  });
  renderLearningLibraryList("learningLibraryRecords", data.records || [], renderLearningRecordItem, "暂无学习记录");
  renderLearningLibraryList("learningLibraryRules", data.currentRules || [], renderCurrentRuleItem, "暂无当前规则");
  renderLearningLibraryList("learningLibrarySkills", data.skills || [], renderSkillLibraryItem, "暂无技能");
}

function renderLearningTabCounts(data) {
  const records = data.records || [];
  const rules = data.currentRules || [];
  const skillCount = data.skills?.length || 0;
  const activeRuleCount = rules.filter((rule) => !rule.coveredByRuleId && rule.status !== "covered").length;
  const unviewedFailures = records.filter((record) => (
    isFailedLearningRecord(record) && !state.viewedLearningFailureIds.has(learningRecordKey(record))
  ));
  setTextIfPresent("learningRecordsTabCount", String(records.length));
  setTextIfPresent("learningRulesTabCount", String(activeRuleCount));
  setTextIfPresent("learningSkillsTabCount", String(skillCount));
  setTextIfPresent("learningFailureTabCount", String(unviewedFailures.length));

  const failureJump = $("learningFailureJump");
  if (failureJump) {
    failureJump.hidden = unviewedFailures.length === 0;
    failureJump.title = unviewedFailures.length
      ? `还有 ${unviewedFailures.length} 条失败学习记录未查看`
      : "暂无未查看失败记录";
  }

  const status = $("learningStatus");
  if (!status) return;
  if (!records.length && !rules.length) {
    status.textContent = "还没有沉淀学习记录。后续在对话、样例学习或画布归档中产生的结果会出现在这里。";
    status.hidden = false;
    return;
  }
  status.hidden = true;
}

function renderLearningLibraryList(id, items, renderer, emptyText) {
  const node = $(id);
  if (!node) return;
  node.innerHTML = "";
  if (!items.length) {
    node.innerHTML = `<div class="learning-library-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  for (const item of items) {
    node.appendChild(renderer(item));
  }
}

function renderLearningRecordItem(record) {
  const item = document.createElement("article");
  const key = learningRecordKey(record);
  const failed = isFailedLearningRecord(record);
  const displayStatus = record.displayStatus || record.status;
  item.className = `learning-library-item status-${safeClassName(displayStatus)}`;
  item.dataset.learningRecordKey = key;
  item.classList.toggle("failed", failed);
  item.classList.toggle("failure-viewed", failed && state.viewedLearningFailureIds.has(key));
  const title = record.learnedText || record.summary || record.rawTrigger || record.advanced?.topicKey || "学习事件";
  const errorMessage = record.advanced?.error?.message || record.error?.message || "";
  const error = errorMessage
    ? `<p class="learning-library-error">失败原因：${escapeHtml(errorMessage)}</p>`
    : "";
  const coveredByEventId = record.advanced?.coveredByEventId || record.coveredByEventId || "";
  const covered = coveredByEventId ? `<p>已被后续学习覆盖：${escapeHtml(coveredByEventId)}</p>` : "";
  const proof = record.generationProof?.claimText
    ? `<p>${escapeHtml(record.generationProof.claimText)}</p>`
    : "";
  const detailParts = [
    record.sourceText,
    record.usedWhereText,
    record.generationImpactText,
    formatDateTime(record.updatedAt || record.createdAt),
  ].filter(Boolean);
  const localRecord = record.learningRecord ? `<p>本地记录：${escapeHtml(record.learningRecord)}</p>` : "";
  const correctionAction = record.correctionAction;
  const correctionButton = correctionAction
    ? `<div class="learning-correction-actions"><button type="button" data-learning-correction="${escapeHtml(key)}">带引用去纠正</button></div>`
    : "";
  item.innerHTML = `
    <div class="learning-library-item-head">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(formatLearningStatus(displayStatus))}</span>
    </div>
    <p>${escapeHtml(detailParts.join(" · "))}</p>
    ${proof}
    ${localRecord}
    ${error}
    ${covered}
    ${correctionButton}
  `;
  return item;
}

function beginLearningCorrection(recordKey) {
  const records = state.learningLibrary?.records || [];
  const record = records.find((item) => learningRecordKey(item) === recordKey);
  const correctionAction = record?.correctionAction;
  if (!record || !correctionAction) return;
  if (!correctionAction.enabled) {
    setTextIfPresent("learningStatus", correctionAction.disabledReason || "这条记录缺少可引用的位置。");
    return;
  }

  const input = $("chatInput");
  const reference = buildLearningCorrectionReference(record, correctionAction.payload);
  input.value = `${correctionAction.defaultText}\n\n引用：${reference}\n补充说明：`;
  state.pendingLearningCorrection = {
    payload: correctionAction.payload,
    action: correctionAction.action || "override",
    recordKey,
  };
  closeLearningPage();
  setAppMode("chat");
  autoGrowTextarea();
  updateSendState();
  input.focus();
}

function buildLearningCorrectionReference(record, payload = {}) {
  const ids = [
    payload.recordId ? `记录 ${payload.recordId}` : "",
    payload.eventId ? `事件 ${payload.eventId}` : "",
    payload.landingIds?.length ? `落点 ${payload.landingIds.join("、")}` : "",
    payload.outputId ? `输出 ${payload.outputId}` : "",
  ].filter(Boolean);
  const title = record.learnedText || record.sourceText || record.usedWhereText || "学习记录";
  return [title, ...ids].filter(Boolean).join("；");
}

function learningRecordKey(record) {
  return String(record?.recordId || record?.eventId || record?.advanced?.eventId || record?.advanced?.ruleId || [
    record?.summary,
    record?.rawTrigger,
    record?.advanced?.topicKey,
    record?.createdAt,
  ].filter(Boolean).join("|") || "learning-record");
}

function isFailedLearningRecord(record) {
  const status = String(record?.displayStatus || record?.status || "").trim().toLowerCase();
  return Boolean(record?.advanced?.error || record?.error) || status === "失败" || status.includes("failed");
}

function jumpToNextLearningFailure() {
  const records = state.learningLibrary?.records || [];
  const failures = records.filter((record) => (
    isFailedLearningRecord(record) && !state.viewedLearningFailureIds.has(learningRecordKey(record))
  ));
  if (!failures.length) {
    renderLearningTabCounts(state.learningLibrary || {});
    return;
  }
  const record = failures[state.learningFailureCursor % failures.length] || failures[0];
  const key = learningRecordKey(record);
  state.viewedLearningFailureIds.add(key);
  state.learningFailureCursor += 1;
  state.learningLibraryTab = "records";
  renderLearningLibrary();
  window.requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll("#learningLibraryRecords .learning-library-item"))
      .find((item) => item.dataset.learningRecordKey === key);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("focus");
    window.setTimeout(() => target.classList.remove("focus"), 1600);
  });
}

function renderCurrentRuleItem(rule) {
  const item = document.createElement("article");
  item.className = `learning-library-item status-${safeClassName(rule.status)}`;
  const canToggle = ["active", "disabled"].includes(rule.status) && !rule.coveredByRuleId;
  const nextStatus = rule.status === "active" ? "disabled" : "active";
  const actionLabel = rule.status === "active" ? "停用" : "启用";
  item.innerHTML = `
    <div class="learning-library-item-head">
      <strong>${escapeHtml(rule.content || rule.topicKey || "规则")}</strong>
      <span>${escapeHtml(formatCurrentRuleStatus(rule.status))}</span>
    </div>
    <p>适用：${escapeHtml(formatLearningCapability(rule.capability))} · ${escapeHtml(formatLearningTopic(rule.topicKey))} · 更新时间 ${escapeHtml(formatDateTime(rule.updatedAt || rule.createdAt))}</p>
    ${canToggle ? `
      <div class="learning-rule-actions">
        <button type="button" data-rule-status-action data-rule-id="${escapeHtml(rule.ruleId)}" data-next-status="${nextStatus}">
          ${actionLabel}
        </button>
      </div>
    ` : ""}
  `;
  const action = item.querySelector("[data-rule-status-action]");
  if (action) {
    action.addEventListener("click", () => setCurrentRuleStatus(rule.ruleId, nextStatus));
  }
  return item;
}

async function setCurrentRuleStatus(ruleId, status) {
  const statusNode = $("learningStatus");
  if (statusNode) {
    statusNode.hidden = false;
    statusNode.textContent = status === "disabled" ? "正在停用当前规则..." : "正在启用当前规则...";
  }
  try {
    const result = await api("/api/learning-rules/status", {
      method: "POST",
      body: JSON.stringify({ ruleId, status }),
    });
    if (result.library) {
      state.learningLibrary = result.library;
      renderLearningLibrary();
    } else {
      await loadLearningLibrary();
    }
    if (statusNode) {
      statusNode.hidden = false;
      statusNode.textContent = status === "disabled" ? "当前规则已停用。" : "当前规则已启用。";
    }
  } catch (error) {
    if (statusNode) {
      statusNode.hidden = false;
      statusNode.textContent = `当前规则状态更新失败：${error.message}`;
    }
  }
}

function renderSkillLibraryItem(skill) {
  const item = document.createElement("article");
  item.className = `learning-library-item${skill.exists ? "" : " missing"}`;
  const description = skill.description || "暂无技能摘要。";
  const instructions = skill.instructions || "未读取到技能说明。";
  const hints = Array.isArray(skill.keywordHints) && skill.keywordHints.length
    ? `<p>常见触发：${escapeHtml(skill.keywordHints.slice(0, 8).join("、"))}</p>`
    : "";
  item.innerHTML = `
    <div class="learning-library-item-head">
      <strong>${escapeHtml(skill.name || skill.id)}</strong>
      <span>${skill.exists ? "可用" : "未安装"}</span>
    </div>
    <p>${escapeHtml(description)}</p>
    <p>${escapeHtml(formatSkillCategory(skill.category))} · ${escapeHtml(skill.path || "")}</p>
    ${hints}
    <details class="learning-skill-detail">
      <summary>查看技能详细说明</summary>
      <pre>${escapeHtml(instructions)}</pre>
    </details>
  `;
  return item;
}

function formatLearningTokenUsage(usage) {
  if (!usage) return "学习 token：0";
  return `学习 token：${Number(usage.total_tokens || 0)}`;
}

function setTextIfPresent(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function formatLearningStatus(status) {
  const value = String(status || "").trim();
  const labels = {
    active: "已生效",
    disabled: "已停用",
    covered: "已被覆盖",
    queued: "处理中",
    failed_retrying: "处理中",
  };
  return labels[value] || value || "处理中";
}

function formatCurrentRuleStatus(status) {
  const value = String(status || "").trim();
  const labels = {
    active: "已启用",
    disabled: "已停用",
    covered: "已被覆盖",
  };
  return labels[value] || formatLearningStatus(value);
}

function formatLearningSource(sourceType) {
  const labels = {
    conversation: "对话学习",
    canvas_archive: "画布归档",
    sample: "样例学习",
    manual: "手动记录",
  };
  return labels[sourceType] || "系统学习";
}

function formatLearningTopic(topicKey) {
  const labels = {
    "storyboard.dialogue.length": "分镜台词长度",
    "storyboard.structure": "分镜结构",
    "script.format": "剧本格式",
    "script.style": "剧本写法",
    "general": "通用规则",
  };
  if (!topicKey) return "通用规则";
  return labels[topicKey] || String(topicKey).split(".").filter(Boolean).join(" / ");
}

function formatLearningCapability(capability) {
  const labels = {
    storyboard: "分镜生成",
    script: "剧本生成",
    review: "评审分析",
    general: "通用能力",
  };
  return labels[capability] || "通用能力";
}

function formatSkillCategory(category) {
  const labels = {
    "skills/00-orchestrator": "任务路由",
    "skills/01-input-analysis": "资料理解",
    "skills/02-script": "剧本能力",
    "skills/03-storyboard": "分镜能力",
    "skills/04-learning": "学习能力",
    "skills/05-evolution": "技能进化",
  };
  if (!category) return "技能";
  return labels[category] || String(category).replace(/^skills\//, "技能 / ");
}

function safeClassName(value) {
  return String(value || "unknown").replace(/[^\w-]+/g, "-");
}

function updateApiKeyBadge(saved) {
  const badge = $("apiKeySavedBadge");
  if (!badge) return;
  badge.textContent = saved ? "已保存 API Key" : "未保存 API Key";
  badge.classList.toggle("saved", Boolean(saved));
}

function updateApiKeySavedState(saved, fromEnv = false) {
  updateApiKeyBadge(saved);
  const input = $("configApiKey");
  if (!input) return;
  const defaults = providerDefaults[$("configProvider")?.value || "deepseek"] || providerDefaults.deepseek;
  input.dataset.saved = saved ? "true" : "false";
  input.dataset.fromEnv = fromEnv ? "true" : "false";
  if (saved) {
    input.dataset.masked = "true";
    input.value = fromEnv ? `环境变量 ${defaults.keyName} 已配置` : `本地 ${defaults.keyName} 已保存`;
    input.placeholder = "输入新 Key 会覆盖当前配置";
    input.classList.add("masked-key");
  } else {
    input.dataset.masked = "false";
    input.value = "";
    input.placeholder = `请输入 ${defaults.keyName}`;
    input.classList.remove("masked-key");
  }
}

function prepareApiKeyEdit() {
  const input = $("configApiKey");
  if (!input || input.dataset.masked !== "true") return;
  input.value = "";
  input.dataset.masked = "false";
  const defaults = providerDefaults[$("configProvider")?.value || "deepseek"] || providerDefaults.deepseek;
  input.placeholder = `输入新的 ${defaults.keyName}；留空则继续使用已保存配置`;
  input.classList.remove("masked-key");
}

function restoreApiKeyMaskIfNeeded() {
  const input = $("configApiKey");
  if (!input) return;
  window.setTimeout(() => {
    if (input.dataset.saved === "true" && !input.value.trim()) {
      updateApiKeySavedState(true, input.dataset.fromEnv === "true");
    }
  }, 0);
}

function currentModelConfigPayload() {
  const provider = $("configProvider").value;
  const apiKeyInput = $("configApiKey");
  const apiKey = apiKeyInput.dataset.masked === "true" ? "" : apiKeyInput.value.trim();
  return {
    provider,
    baseUrl: $("configBaseUrl").value.trim() || providerDefaults[provider].baseUrl,
    model: $("configModel").value,
    apiKey,
  };
}

function fingerprintText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function modelConfigSignature(payload) {
  return JSON.stringify({
    provider: payload.provider,
    baseUrl: payload.baseUrl,
    model: payload.model,
    apiKeyToken: payload.apiKey ? "input:" + fingerprintText(payload.apiKey) : "stored-or-env",
  });
}

function invalidateModelConfigTest(message) {
  state.testedModelConfigSignature = "";
  if (message) {
    $("configState").textContent = message;
  }
}

async function saveConfig() {
  try {
    const modelPayload = currentModelConfigPayload();
    const signature = modelConfigSignature(modelPayload);
    if (state.testedModelConfigSignature !== signature) {
      $("configState").textContent = "请先测试连接，确认成功后再保存当前模型配置。";
      return;
    }
    const data = await api("/api/config", {
      method: "POST",
      body: JSON.stringify({
        appName: $("configAppName").value.trim(),
        ...modelPayload,
      }),
    });
    applyAppName(data.appName);
    $("configAppName").value = data.appName || state.appName;
    $("configProvider").value = data.provider || $("configProvider").value;
    renderModelProviderFields(data.provider || $("configProvider").value, data.model);
    $("configBaseUrl").value = data.baseUrl || $("configBaseUrl").value;
    updateApiKeySavedState(data.hasStoredApiKey || data.hasEnvApiKey, data.hasEnvApiKey);
    const keyName = providerDefaults[data.provider || $("configProvider").value].keyName;
    $("configState").textContent = data.hasEnvApiKey
      ? `配置已保存。已使用环境变量 ${keyName}，输入框不回显明文。`
      : data.hasStoredApiKey
        ? `配置已保存。输入框用占位符显示已保存 ${keyName} 状态，不回显明文。`
        : `配置已保存，但未保存 ${keyName}`;
    state.testedModelConfigSignature = modelConfigSignature(currentModelConfigPayload());
  } catch (error) {
    $("configState").textContent = error.message;
  }
}

async function testApi() {
  $("configState").textContent = "测试中...";
  try {
    const modelPayload = currentModelConfigPayload();
    const data = await api("/api/deepseek-test", {
      method: "POST",
      body: JSON.stringify(modelPayload),
    });
    state.testedModelConfigSignature = modelConfigSignature(modelPayload);
    $("configState").textContent = data.content || "连接成功";
  } catch (error) {
    state.testedModelConfigSignature = "";
    $("configState").textContent = error.message;
  }
}

function bindEvents() {
  $("chatForm").addEventListener("submit", sendMessage);
  $("attachBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async (event) => {
    await addPendingFiles(event.target.files);
    event.target.value = "";
  });
  $("newChat").addEventListener("click", handlePrimaryCreate);
  $("toggleSidebar").addEventListener("click", toggleSidebarCollapsed);
  $("appModeSwitch").addEventListener("click", () => setAppMode(state.appMode === "canvas" ? "chat" : "canvas"));
  $("sidebarResizeHandle").addEventListener("pointerdown", beginSidebarResize);
  $("closeNewConversationModal").addEventListener("click", closeNewConversationModal);
  $("cancelNewConversation").addEventListener("click", closeNewConversationModal);
  $("confirmNewConversation").addEventListener("click", createConversationFromModal);
  $("newConversationProject").addEventListener("change", updateNewConversationProjectFields);
  $("newConversationModal").addEventListener("click", (event) => {
    if (event.target === $("newConversationModal")) closeNewConversationModal();
  });
  $("newConversationTitle").addEventListener("keydown", (event) => {
    if (event.key === "Enter") createConversationFromModal();
  });
  $("newConversationProjectName").addEventListener("keydown", (event) => {
    if (event.key === "Enter") createConversationFromModal();
  });
  renderCanvasToolbarIcons();
  document.querySelectorAll("[data-add-node]").forEach((button) => {
    button.addEventListener("click", () => addNodeToCanvas(button.dataset.addNode));
  });
  window.addEventListener("pointermove", updateCanvasPointer);
  window.addEventListener("pointermove", updateSidebarResize);
  window.addEventListener("pointerup", endCanvasPointer);
  window.addEventListener("pointerup", endSidebarResize);
  $("canvasNodeTitle").addEventListener("input", scheduleActiveCanvasNodeAutosave);
  $("canvasNodeContent").addEventListener("input", scheduleActiveCanvasNodeAutosave);
  renderMarkdownToolbarContent($("canvasNodeMarkdownToolbar"));
  $("closeCanvasNode").addEventListener("click", closeCanvasNodeModal);
  $("canvasNodeModal").addEventListener("click", (event) => {
    if (event.target === $("canvasNodeModal")) closeCanvasNodeModal();
  });
  $("canvasNodeMarkdownToolbar").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    handleMarkdownToolbarButton(button, $("canvasNodeContent"), state.activeCanvasNodeId);
  });
  $("generateScriptFromNode").addEventListener("click", () => generateScriptFromNode());
  $("generateStoryboardsFromNode").addEventListener("click", () => planStoryboardsFromNode());
  $("confirmEpisodeGenerate").addEventListener("click", generateConfirmedStoryboards);
  $("closeEpisodeConfirm").addEventListener("click", closeEpisodeConfirm);
  $("episodeConfirmModal").addEventListener("click", (event) => {
    if (event.target === $("episodeConfirmModal")) closeEpisodeConfirm();
  });
  $("canvasActionMenu").addEventListener("click", handleCanvasMenuAction);
  $("canvasContextMenu").addEventListener("click", handleCanvasMenuAction);
  $("cancelCanvasDelete").addEventListener("click", () => closeCanvasDeleteConfirm(false));
  $("confirmCanvasDelete").addEventListener("click", () => closeCanvasDeleteConfirm(true));
  $("canvasDeleteConfirm").addEventListener("click", (event) => {
    if (event.target === $("canvasDeleteConfirm")) closeCanvasDeleteConfirm(false);
  });
  $("canvasGroupPrimarySelect").addEventListener("change", (event) => {
    state.canvasGroupPrimaryNodeId = event.target.value;
  });
  $("mergeSelectedCanvasNodes").addEventListener("click", groupSelectedCanvasNodes);
  $("cancelCanvasGroup").addEventListener("click", clearCanvasSelection);
  $("closeCanvasMergeHistory").addEventListener("click", closeCanvasMergeHistory);
  $("canvasMergeHistoryModal").addEventListener("click", (event) => {
    if (event.target === $("canvasMergeHistoryModal")) closeCanvasMergeHistory();
  });
  $("canvasMergeHistoryList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-merge-version-id]");
    if (!button) return;
    await setMergedPrimaryVersion(state.canvasMergeHistoryNodeId, button.dataset.mergeVersionId);
  });
  $("canvasStage").addEventListener("pointerdown", startCanvasSelection);
  $("canvasStage").addEventListener("pointerdown", beginCanvasPan);
  $("canvasStage").addEventListener("click", handleCanvasStageClick);
  $("canvasStage").addEventListener("contextmenu", openCanvasBoardContextMenu);
  $("canvasStage").addEventListener("scroll", updateCanvasViewportTools);
  $("toggleCanvasMiniMap").addEventListener("click", toggleCanvasMiniMap);
  $("canvasMiniMapSvg").addEventListener("pointerdown", beginCanvasMiniMapDrag);
  $("undoCanvasEdit").addEventListener("click", undoCanvasEdit);
  $("redoCanvasEdit").addEventListener("click", redoCanvasEdit);
  $("fitCanvasView").addEventListener("click", fitCanvasToContent);
  $("centerSelectedCanvasNode").addEventListener("click", () => centerCanvasOnNode());
  $("canvasZoomOut").addEventListener("click", () => setCanvasZoom(canvasZoom() - canvasZoomStep));
  $("canvasZoomIn").addEventListener("click", () => setCanvasZoom(canvasZoom() + canvasZoomStep));
  $("archiveCurrentCanvas").addEventListener("click", () => archiveCurrentCanvas());
  $("deleteCurrentCanvas").addEventListener("click", deleteCurrentCanvas);
  $("closeStoryboardIssue").addEventListener("click", closeStoryboardIssueDetail);
  $("autoFixStoryboardIssues").addEventListener("click", autoFixStoryboardIssues);
  $("acknowledgeStoryboardIssues").addEventListener("click", () => resolveStoryboardIssues("acknowledge"));
  $("adoptStoryboardIssues").addEventListener("click", () => resolveStoryboardIssues("adopt"));
  $("storyboardIssueModal").addEventListener("click", (event) => {
    if (event.target === $("storyboardIssueModal")) closeStoryboardIssueDetail();
  });
  $("closeCanvasArchiveBlocked").addEventListener("click", closeCanvasArchiveBlockedModal);
  $("canvasArchiveBlockedModal").addEventListener("click", (event) => {
    if (event.target === $("canvasArchiveBlockedModal")) closeCanvasArchiveBlockedModal();
  });
  window.addEventListener("pointermove", updateCanvasMiniMapDrag);
  window.addEventListener("pointerup", endCanvasMiniMapDrag);
  window.addEventListener("pointercancel", endCanvasMiniMapDrag);
  $("openConversationSearch").addEventListener("click", openConversationSearch);
  $("closeConversationSearch").addEventListener("click", closeConversationSearch);
  $("conversationSearch").addEventListener("input", queueConversationSearch);
  $("conversationSearch").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeConversationSearch();
    }
    if (event.key === "Enter") {
      const firstResult = $("conversationSearchResults").querySelector(".conversation-search-result");
      if (firstResult) firstResult.click();
    }
  });
  $("conversationSearchModal").addEventListener("click", (event) => {
    if (event.target === $("conversationSearchModal")) closeConversationSearch();
  });
  $("openWorkbench").addEventListener("click", openWorkbench);
  $("closeWorkbench").addEventListener("click", closeWorkbench);
  $("closeArtifactPreview").addEventListener("click", hideArtifactPreview);
  $("addArchiveSelection").addEventListener("click", addActiveNodeToArchive);
  $("submitArchiveLearning").addEventListener("click", submitArchiveLearning);
  $("workbenchRunSelect").addEventListener("change", (event) => {
    state.workbenchRunName = event.target.value;
    state.archiveSelections = [];
    loadWorkbench();
  });
  $("workbench").addEventListener("click", (event) => {
    if (event.target === $("workbench")) closeWorkbench();
  });
  $("openSettings").addEventListener("click", () => openSettings("deepseek"));
  $("openTrash").addEventListener("click", openTrash);
  $("openArchiveView").addEventListener("click", openArchiveView);
  $("closeCanvasArchivePage").addEventListener("click", closeCanvasArchivePage);
  $("canvasArchivePage").addEventListener("click", (event) => {
    if (event.target === $("canvasArchivePage")) closeCanvasArchivePage();
  });
  $("openLearningLibrary").addEventListener("click", openLearningLibrary);
  $("closeLearningPage").addEventListener("click", closeLearningPage);
  $("learningPage").addEventListener("click", (event) => {
    const correctionButton = event.target.closest("[data-learning-correction]");
    if (correctionButton) {
      beginLearningCorrection(correctionButton.dataset.learningCorrection || "");
      return;
    }
    if (event.target === $("learningPage")) closeLearningPage();
  });
  $("closeTrash").addEventListener("click", closeTrash);
  $("trash").addEventListener("click", (event) => {
    if (event.target === $("trash")) closeTrash();
  });
  $("closeSettings").addEventListener("click", closeSettings);
  $("saveConfig").addEventListener("click", saveConfig);
  $("testApi").addEventListener("click", testApi);
  document.querySelectorAll("[data-compose-mode]").forEach((button) => {
    button.addEventListener("click", () => setComposeMode(button.dataset.composeMode));
  });
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => switchSettingsTab(button.dataset.settingsTab));
  });
  document.querySelectorAll("[data-learning-library-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.learningLibraryTab = button.dataset.learningLibraryTab || "records";
      renderLearningLibrary();
    });
  });
  $("learningFailureJump").addEventListener("click", jumpToNextLearningFailure);
  $("configApiKey").addEventListener("pointerdown", prepareApiKeyEdit);
  $("configApiKey").addEventListener("focus", prepareApiKeyEdit);
  $("configApiKey").addEventListener("keydown", prepareApiKeyEdit);
  $("configApiKey").addEventListener("blur", restoreApiKeyMaskIfNeeded);
  $("configProvider").addEventListener("change", () => {
    renderModelProviderFields($("configProvider").value);
    updateApiKeySavedState(false, false);
    invalidateModelConfigTest(`已切换到 ${providerDefaults[$("configProvider").value].label}，请先测试连接，成功后再保存。`);
  });
  $("configBaseUrl").addEventListener("input", () => invalidateModelConfigTest());
  $("configModel").addEventListener("change", () => invalidateModelConfigTest());
  $("configApiKey").addEventListener("input", () => invalidateModelConfigTest());
  $("messages").addEventListener("scroll", syncOverviewPosition);
  $("chatForm").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("chatForm").classList.add("dragging");
  });
  $("chatForm").addEventListener("dragleave", () => {
    $("chatForm").classList.remove("dragging");
  });
  $("chatForm").addEventListener("drop", async (event) => {
    event.preventDefault();
    $("chatForm").classList.remove("dragging");
    await addPendingFiles(event.dataTransfer.files);
  });
  initOverviewDragEvents();
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
  });
  $("renameFromMenu").addEventListener("click", () => {
    if (state.contextItem) {
      const { item, row } = state.contextItem;
      closeContextMenu();
      startRenameConversation(item, row);
    }
  });
  $("hideFromMenu").addEventListener("click", async () => {
    if (state.contextItem) {
      await hideConversationFromList(state.contextItem.item);
    }
  });
  document.addEventListener("click", (event) => {
    maybeStopCanvasBodyEditFromEvent(event);
    if (!$("contextMenu").contains(event.target)) closeContextMenu();
    if (!$("canvasActionMenu").contains(event.target) && !(event.target.closest && event.target.closest(".canvas-node-plus"))) closeCanvasActionMenu();
    if (!$("canvasContextMenu").contains(event.target)) closeCanvasContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (state.appMode === "canvas" && !isCanvasHistoryShortcutTarget(event.target)) {
      const key = String(event.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "z") {
        event.preventDefault();
        undoCanvasEdit();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (key === "y" || (event.shiftKey && key === "z"))) {
        event.preventDefault();
        redoCanvasEdit();
        return;
      }
    }
    if (event.key === "Escape") {
      closeContextMenu();
      closeCanvasMenus();
      stopCanvasNodeBodyEdit({ render: true });
      closeLearningPage();
      closeCanvasArchivePage();
      closeTrash();
      closeWorkbench();
      closeConversationSearch();
      closeNewConversationModal();
      closeStoryboardIssueDetail();
      closeCanvasArchiveBlockedModal();
      closeCanvasDeleteConfirm(false);
    }
  });
  window.addEventListener("resize", syncOverviewPosition);
  window.addEventListener("resize", () => {
    applySidebarWidth(state.sidebarWidth, true);
    autoGrowTextarea();
    updateCanvasViewportTools();
  });
  $("chatInput").addEventListener("input", () => {
    autoGrowTextarea();
    updateSendState();
  });
  $("chatInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("chatForm").requestSubmit();
    }
  });
}

async function init() {
  loadTheme();
  loadCollapsedProjectIds();
  loadSidebarWidth();
  loadSidebarCollapsed();
  bindEvents();
  setAppMode(state.appMode);
  setComposeMode("");
  autoGrowTextarea();
  updateSendState();
  initSidebarCat();
  await loadConfig();
  await loadConversations();
}

init().catch((error) => {
  console.error(error);
  appendMessage("assistant", error.message, false);
});
