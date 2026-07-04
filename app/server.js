const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const zlib = require("zlib");
const { execFile } = require("child_process");
const { URL } = require("url");
const { buildAssistantMessage } = require("./lib/chatUsage");
const { DEFAULT_APP_NAME, normalizeAppSettings } = require("./lib/appSettings");
const { findLocalSkillRoute, loadLocalSkillContext, routeLocalSkill } = require("./lib/localSkills");
const { extractExplicitRuleLearningInput, writeConversationLearningRecord } = require("./lib/conversationLearning");
const { buildCompletenessMatrix } = require("./lib/productCompleteness");
const { classifyChatIntent, selectHistoryForIntent } = require("./lib/chatIntent");
const { buildArchiveRecordMarkdown, buildWorkbenchState } = require("./lib/workbench");
const { addCanvasNode, connectCanvasNodes, createCanvas, normalizeCanvas } = require("./lib/canvasState");
const { applyCanvasStoryboardValidation } = require("./lib/canvasStoryboardValidation");
const { buildStoryboardNodePlan, splitScriptIntoEpisodes } = require("./lib/episodeSplit");
const { DEFAULT_PROJECT_ID, createProject, groupConversationsByProject, normalizeProjects, renameProject, resolveProjectId } = require("./lib/projects");
const { normalizeModelSettings, publicModelSettings, resolveActiveModelSettings, updateModelSettings } = require("./lib/modelSettings");
const { handleNotification, listNotifications } = require("./lib/notifications");
const { buildLearningLibrary } = require("./lib/learningLibrary");
const { applyLearningCorrectionRequest } = require("./lib/learningCorrection");
const { appendLearningEvent, learnExplicitRule, updateCurrentRuleStatus } = require("./lib/autonomousLearning");
const { recordArchiveLearningEvidence } = require("./lib/learningEvidence");
const { analyzeCanvasArchiveReadiness } = require("./lib/canvasArchive");
const { buildCurrentRulesetContext } = require("./lib/currentRulesetContext");
const { applyStoryboardHardRuleValidation, isStoryboardValidationResolved, validateStoryboardContent } = require("./lib/storyboardValidation");

const ROOT = path.resolve(__dirname, "..");
const ACCEPTANCE_ROOT = process.env.MBH_ACCEPTANCE_ROOT ? path.resolve(process.env.MBH_ACCEPTANCE_ROOT) : "";
const ACCEPTANCE_MODE = Boolean(ACCEPTANCE_ROOT);
const BUSINESS_ROOT = ACCEPTANCE_ROOT || ROOT;
const PUBLIC_DIR = path.join(__dirname, "public");
const RUNS_DIR = path.join(BUSINESS_ROOT, "runs");
const CONFIG_DIR = path.join(__dirname, "config");
const DATA_DIR = path.join(BUSINESS_ROOT, "app", "data");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations");
const CANVASES_DIR = path.join(DATA_DIR, "canvases");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const DEEPSEEK_CONFIG = path.join(CONFIG_DIR, "deepseek.local.json");
const APP_CONFIG = path.join(CONFIG_DIR, "app.local.json");
const PORT = Number(process.env.MBH_WEB_PORT || 17877);

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function runCommand(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd: ROOT, windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\n${stderr || ""}`;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(text);
}

function safeName(name) {
  const cleaned = String(name || "未命名运行").replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "未命名运行";
}

function safeFileName(name) {
  const cleaned = String(name || "attachment").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || "attachment";
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function conversationId() {
  return `${timestamp()}-${Math.random().toString(16).slice(2, 8)}`;
}

function resolveRun(runName) {
  const base = path.resolve(RUNS_DIR);
  const target = path.resolve(RUNS_DIR, runName || "");
  if (!target.startsWith(base)) throw new Error("运行目录不合法");
  return target;
}

function resolveArtifact(runName, fileName) {
  const runDir = resolveRun(runName);
  const target = path.resolve(runDir, fileName || "");
  if (!target.startsWith(runDir)) throw new Error("产物路径不合法");
  return target;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = stripBom(Buffer.concat(chunks).toString("utf8"));
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

function isReadableTextAttachment(name, type) {
  const ext = path.extname(String(name || "")).toLowerCase();
  return String(type || "").startsWith("text/") || [".txt", ".md", ".markdown", ".csv", ".json", ".srt", ".ass", ".log", ".xml", ".html", ".htm"].includes(ext);
}

function xmlText(text) {
  return String(text || "")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inflateZipEntry(buffer, entry) {
  const localOffset = entry.localOffset;
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) return null;
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data);
  return null;
}

function extractDocxText(buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return "";
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const targets = [];
  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === "word/document.xml" || /^word\/(header|footer)\d+\.xml$/.test(name)) {
      targets.push({ name, method, compressedSize, localOffset });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return targets
    .sort((a, b) => (a.name === "word/document.xml" ? -1 : b.name === "word/document.xml" ? 1 : a.name.localeCompare(b.name)))
    .map((entry) => {
      const data = inflateZipEntry(buffer, entry);
      return data ? xmlText(data.toString("utf8")) : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function readJsonFile(filePath) {
  return JSON.parse(stripBom(await fsp.readFile(filePath, "utf8")));
}

async function readDeepSeekConfig() {
  if (!fs.existsSync(DEEPSEEK_CONFIG)) return normalizeModelSettings();
  try {
    const data = await readJsonFile(DEEPSEEK_CONFIG);
    return normalizeModelSettings(data);
  } catch {
    return normalizeModelSettings();
  }
}

async function writeDeepSeekConfig(body) {
  await fsp.mkdir(CONFIG_DIR, { recursive: true });
  const existing = await readDeepSeekConfig();
  const next = updateModelSettings(existing, body);
  await fsp.writeFile(DEEPSEEK_CONFIG, JSON.stringify(next, null, 2), "utf8");
  return publicModelSettings(next);
}

async function readAppSettings() {
  if (!fs.existsSync(APP_CONFIG)) return normalizeAppSettings({ appName: DEFAULT_APP_NAME });
  try {
    return normalizeAppSettings(await readJsonFile(APP_CONFIG));
  } catch {
    return normalizeAppSettings({ appName: DEFAULT_APP_NAME });
  }
}

async function writeAppSettings(body) {
  await fsp.mkdir(CONFIG_DIR, { recursive: true });
  const next = normalizeAppSettings({ appName: body.appName });
  await fsp.writeFile(APP_CONFIG, JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function listRuns() {
  await fsp.mkdir(RUNS_DIR, { recursive: true });
  const entries = await fsp.readdir(RUNS_DIR, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(RUNS_DIR, entry.name);
    const stat = await fsp.stat(full);
    let manifest = {};
    const manifestPath = path.join(full, "run-manifest.json");
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = await readJsonFile(manifestPath);
      } catch {
        manifest = {};
      }
    }
    runs.push({
      name: entry.name,
      updatedAt: stat.mtime.toISOString(),
      title: manifest.title || entry.name,
      route: manifest.route || manifest.suggestedRoute || "待判断",
      status: manifest.status || "unknown",
    });
  }
  runs.sort((a, b) => b.name.localeCompare(a.name, "zh-Hans-CN"));
  return runs;
}

async function listArtifacts(runName) {
  const runDir = resolveRun(runName);
  const entries = await fsp.readdir(runDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(runDir, entry.name);
    const stat = await fsp.stat(full);
    files.push({ name: entry.name, size: stat.size, updatedAt: stat.mtime.toISOString() });
  }
  files.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  return files;
}

async function getWorkbench(runName) {
  if (!runName) throw new Error("缺少运行目录");
  const files = await listArtifacts(runName);
  return buildWorkbenchState({ runName, files });
}

async function createRun(body) {
  const title = safeName(body.title);
  const route = body.route || "auto";
  const runName = `${timestamp()}-${title}`;
  const runDir = path.join(RUNS_DIR, runName);
  await fsp.mkdir(runDir, { recursive: true });
  const input = String(body.input || "").trim() || "待补充。";
  await fsp.writeFile(path.join(runDir, "input.md"), `# 输入材料\n\n${input}\n`, "utf8");
  const manifest = {
    title,
    route,
    status: "created",
    createdAt: new Date().toISOString(),
    source: "M7 local web",
  };
  await fsp.writeFile(path.join(runDir, "run-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fsp.writeFile(path.join(runDir, "README.md"), runReadme(title, route), "utf8");
  return { run: runName, title, route };
}

async function ensureConversationDirs() {
  await fsp.mkdir(CONVERSATIONS_DIR, { recursive: true });
  await fsp.mkdir(RUNS_DIR, { recursive: true });
  await fsp.mkdir(CANVASES_DIR, { recursive: true });
}

function conversationFile(id) {
  const target = path.resolve(CONVERSATIONS_DIR, `${id}.json`);
  if (!target.startsWith(CONVERSATIONS_DIR)) throw new Error("会话路径不合法");
  return target;
}

async function readProjects() {
  await ensureConversationDirs();
  if (!fs.existsSync(PROJECTS_FILE)) return normalizeProjects();
  try {
    return normalizeProjects(await readJsonFile(PROJECTS_FILE));
  } catch {
    return normalizeProjects();
  }
}

async function writeProjects(projects) {
  await ensureConversationDirs();
  const next = normalizeProjects(projects);
  await fsp.writeFile(PROJECTS_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function createProjectRecord(title) {
  const current = await readProjects();
  const result = createProject(current, title);
  await writeProjects(result.projects);
  return result.project;
}

async function renameProjectRecord(id, title) {
  const current = await readProjects();
  const result = renameProject(current, id, title);
  await writeProjects(result.projects);
  return result.project;
}

async function canvasFile(id) {
  await ensureConversationDirs();
  const target = path.resolve(CANVASES_DIR, `${id}.json`);
  if (!target.startsWith(CANVASES_DIR)) throw new Error("画布路径不合法");
  return target;
}

async function saveCanvas(canvas, options = {}) {
  let normalized = normalizeCanvas(canvas);
  const file = await canvasFile(normalized.id);
  if (!options.allowArchived && fs.existsSync(file)) {
    const existing = normalizeCanvas(await readJsonFile(file));
    if (existing.archivedAt) throw new Error("画布已归档，不能继续编辑。");
    if (existing.deletedAt) throw new Error("画布已在回收站，不能继续编辑。");
  }
  if (!options.skipStoryboardValidation) {
    normalized = normalizeCanvas(applyCanvasStoryboardValidation(normalized, {
      currentRulesUsed: await currentStoryboardRulesUsed(),
    }));
  }
  await fsp.writeFile(file, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

async function currentStoryboardRulesUsed() {
  try {
    const context = await buildCurrentRulesetContext(BUSINESS_ROOT, { capability: "storyboard" });
    return Array.isArray(context.currentRulesUsed) ? context.currentRulesUsed : [];
  } catch {
    return [];
  }
}

async function getCanvas(id) {
  if (!id) return saveCanvas(createCanvas("新画布"));
  const file = await canvasFile(id);
  if (!fs.existsSync(file)) throw new Error("找不到画布");
  return normalizeCanvas(await readJsonFile(file));
}

async function listCanvases(options = {}) {
  await ensureConversationDirs();
  const entries = await fsp.readdir(CANVASES_DIR, { withFileTypes: true });
  const canvases = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const canvas = normalizeCanvas(await readJsonFile(path.join(CANVASES_DIR, entry.name)));
      if (canvas.deletedAt && !options.includeDeleted) continue;
      canvases.push({
        id: canvas.id,
        title: canvas.title,
        updatedAt: canvas.updatedAt,
        archivedAt: canvas.archivedAt || "",
        deletedAt: canvas.deletedAt || "",
        nodeCount: canvas.nodes.length,
        edgeCount: canvas.edges.length,
      });
    } catch {
      continue;
    }
  }
  canvases.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return canvases;
}

function buildCanvasArchiveCheck(canvas) {
  const readiness = analyzeCanvasArchiveReadiness(canvas);
  const storyboardIssues = [];
  for (const node of canvas.nodes || []) {
    if (node.type !== "storyboard") continue;
    if (isStoryboardValidationResolved(node)) continue;
    const validation = validateStoryboardContent(node.content);
    if (!validation.ok) {
      storyboardIssues.push({
        nodeId: node.id,
        nodeTitle: node.title,
        issues: validation.issues,
      });
    }
  }
  return {
    ok: readiness.ok && storyboardIssues.length === 0,
    readiness,
    storyboardIssues,
  };
}

async function checkCanvasArchiveReadiness(body) {
  const canvas = await getCanvas(body.canvasId || body.id);
  return buildCanvasArchiveCheck(canvas);
}

async function archiveCanvasRecord(body) {
  const canvas = await getCanvas(body.canvasId || body.id);
  const archiveCheck = buildCanvasArchiveCheck(canvas);
  if (!archiveCheck.ok) {
    return { ok: false, canvas, archiveCheck };
  }
  const archivedAt = new Date().toISOString();
  const archived = await saveCanvas({
    ...canvas,
    archivedAt,
    archiveReadiness: archiveCheck,
  }, { allowArchived: true });
  const learningEvidence = await recordArchiveLearningEvidence(BUSINESS_ROOT, {
    canvas: archived,
    archiveCheck,
    outputId: body.outputId || "",
    sourceEventIds: body.sourceEventIds,
    archivedAt,
    createdAt: archivedAt,
  });
  return { ok: true, canvas: archived, archiveCheck, learningEvidence };
}

async function deleteCanvasRecord(body) {
  const canvas = await getCanvas(body.canvasId || body.id);
  const deletedAt = new Date().toISOString();
  const deleted = await saveCanvas({
    ...canvas,
    deletedAt,
  }, { allowArchived: true });
  return { ok: true, canvas: deleted };
}

async function restoreCanvasRecord(body) {
  const canvas = await getCanvas(body.canvasId || body.id);
  const restored = await saveCanvas({
    ...canvas,
    deletedAt: "",
  }, { allowArchived: true });
  return { ok: true, canvas: restored };
}

async function createCanvasRecord(title) {
  return saveCanvas(createCanvas(title || "新画布"));
}

async function createConversation(options = "新对话") {
  await ensureConversationDirs();
  const title = typeof options === "string" ? options : options.title;
  const projects = await readProjects();
  const id = conversationId();
  const safeTitle = safeName(title);
  const projectId = resolveProjectId(typeof options === "string" ? DEFAULT_PROJECT_ID : options.projectId, projects);
  const runName = `${timestamp()}-${id.slice(-6)}-web-chat-${safeTitle}`;
  const runDir = path.join(RUNS_DIR, runName);
  await fsp.mkdir(runDir, { recursive: true });
  const conversation = {
    id,
    title: safeTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runName,
    projectId,
    messages: [],
  };
  await saveConversation(conversation);
  await fsp.writeFile(path.join(runDir, "run-manifest.json"), JSON.stringify({
    title: safeTitle,
    route: "chat-orchestrator",
    status: "chatting",
    conversationId: id,
    projectId,
    createdAt: conversation.createdAt,
    source: "M7 local web chat",
  }, null, 2), "utf8");
  await writeConversationMarkdown(conversation);
  return conversation;
}

async function saveConversation(conversation) {
  await ensureConversationDirs();
  conversation.updatedAt = new Date().toISOString();
  await fsp.writeFile(conversationFile(conversation.id), JSON.stringify(conversation, null, 2), "utf8");
  await writeConversationMarkdown(conversation);
}

async function writeConversationMarkdown(conversation) {
  if (!conversation.runName) return;
  const runDir = path.join(RUNS_DIR, conversation.runName);
  await fsp.mkdir(runDir, { recursive: true });
  const lines = ["# 网页对话记录", "", `会话：${conversation.title}`, "", `会话ID：${conversation.id}`, ""];
  for (const message of conversation.messages) {
    const timeText = formatConversationTime(message.time || conversation.createdAt || conversation.updatedAt);
    lines.push(`## ${message.role === "user" ? "使用人员" : "助手"}${timeText ? `｜${timeText}` : ""}`);
    lines.push("");
    lines.push(message.content || "");
    if (Array.isArray(message.attachments) && message.attachments.length) {
      lines.push("");
      lines.push("### 附件");
      for (const attachment of message.attachments) {
        lines.push(`- ${attachment.name || "未命名附件"}（${attachment.extracted ? "已读取正文" : "已保存"}）`);
      }
    }
    lines.push("");
  }
  await fsp.writeFile(path.join(runDir, "chat.md"), lines.join("\r\n"), "utf8");
}

function formatConversationTime(time) {
  if (!time) return "";
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function saveMessageAttachments(conversation, attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  const runDir = conversation.runName ? path.join(RUNS_DIR, conversation.runName) : null;
  const uploadDir = runDir ? path.join(runDir, "uploads") : null;
  if (uploadDir) await fsp.mkdir(uploadDir, { recursive: true });
  const saved = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index] || {};
    const fileName = safeFileName(attachment.name || `attachment-${index + 1}`);
    const type = attachment.type || "application/octet-stream";
    const kind = String(type).startsWith("image/") || attachment.kind === "image" ? "image" : "file";
    const item = {
      name: fileName,
      type,
      size: Number(attachment.size || 0),
      kind,
      extracted: false,
    };

    let buffer = null;
    if (attachment.dataUrl) {
      const decoded = dataUrlToBuffer(attachment.dataUrl);
      if (decoded) {
        buffer = decoded.buffer;
        item.type = decoded.mime || type;
      }
    }
    if (attachment.text && !buffer) {
      buffer = Buffer.from(String(attachment.text), "utf8");
    }
    if (buffer && uploadDir) {
      const targetName = `${timestamp()}-${index + 1}-${fileName}`;
      const targetPath = path.join(uploadDir, targetName);
      await fsp.writeFile(targetPath, buffer);
      item.path = path.relative(BUSINESS_ROOT, targetPath).replace(/\\/g, "/");
      item.size = buffer.length;
    }

    const ext = path.extname(fileName).toLowerCase();
    if (typeof attachment.text === "string" && attachment.text.trim()) {
      item.text = attachment.text;
      item.extracted = true;
    } else if (buffer && isReadableTextAttachment(fileName, item.type)) {
      item.text = stripBom(buffer.toString("utf8"));
      item.extracted = true;
    } else if (buffer && ext === ".docx") {
      const text = extractDocxText(buffer);
      if (text) {
        item.text = text;
        item.extracted = true;
      }
    }
    if (kind === "image" && attachment.dataUrl) {
      item.dataUrl = attachment.dataUrl;
    }
    saved.push(item);
  }
  return saved;
}

function messageContentForModel(message) {
  const lines = [message.content || ""];
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length) {
    lines.push("");
    lines.push("【用户上传的附件】");
    for (const attachment of attachments) {
      lines.push(`文件：${attachment.name || "未命名附件"}，类型：${attachment.type || "未知"}`);
      if (attachment.text) {
        lines.push("正文：");
        lines.push(attachment.text);
      } else if (attachment.kind === "image") {
        lines.push("说明：这是图片附件，当前文本模型只能读取文件名和图片元数据。");
      } else {
        lines.push("说明：该附件已保存，但暂未提取正文。");
      }
    }
  }
  return lines.join("\n").trim() || "已上传附件。";
}

function skillRoutingText(message, attachments = []) {
  const lines = [message || ""];
  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    lines.push(attachment.name || "");
    if (attachment.text) lines.push(attachment.text.slice(0, 2000));
  }
  return lines.join("\n");
}

async function listConversations() {
  await ensureConversationDirs();
  const projects = await readProjects();
  const entries = await fsp.readdir(CONVERSATIONS_DIR, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const data = await readJsonFile(path.join(CONVERSATIONS_DIR, entry.name));
      items.push({
        id: data.id,
        title: data.title,
        updatedAt: data.updatedAt,
        runName: data.runName,
        projectId: resolveProjectId(data.projectId, projects),
        count: Array.isArray(data.messages) ? data.messages.length : 0,
      });
    } catch {
      continue;
    }
  }
  items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return items;
}

async function listConversationProjectGroups() {
  const [projects, conversations] = await Promise.all([readProjects(), listConversations()]);
  return groupConversationsByProject(conversations, projects);
}

function searchSnippet(text, index, queryLength) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return "";
  const start = Math.max(0, index - 28);
  const end = Math.min(source.length, index + queryLength + 46);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

async function searchConversations(query) {
  await ensureConversationDirs();
  const keyword = String(query || "").trim();
  if (!keyword) return [];
  const lowered = keyword.toLowerCase();
  const entries = await fsp.readdir(CONVERSATIONS_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    let data;
    try {
      data = await readJsonFile(path.join(CONVERSATIONS_DIR, entry.name));
    } catch {
      continue;
    }
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const title = data.title || "新对话";
    const titleIndex = String(title).toLowerCase().indexOf(lowered);
    if (titleIndex >= 0) {
      results.push({
        conversationId: data.id,
        title,
        messageIndex: messages.length ? 0 : null,
        role: "title",
        time: data.updatedAt || data.createdAt || "",
        snippet: `标题：${searchSnippet(title, titleIndex, keyword.length)}`,
      });
    }

    messages.forEach((message, messageIndex) => {
      const pieces = [{ source: "message", text: message.content || "" }];
      for (const attachment of Array.isArray(message.attachments) ? message.attachments : []) {
        pieces.push({ source: "attachment", text: attachment.name || "" });
        if (attachment.text) pieces.push({ source: "attachment", text: attachment.text });
      }
      for (const piece of pieces) {
        const text = String(piece.text || "");
        const found = text.toLowerCase().indexOf(lowered);
        if (found < 0) continue;
        results.push({
          conversationId: data.id,
          title,
          messageIndex,
          role: message.role || "",
          time: message.time || data.updatedAt || data.createdAt || "",
          snippet: searchSnippet(text, found, keyword.length),
          source: piece.source,
        });
        break;
      }
    });
  }

  return results
    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
    .slice(0, 50);
}

async function getConversation(id) {
  if (!id) return createConversation("新对话");
  const file = conversationFile(id);
  if (!fs.existsSync(file)) throw new Error("找不到会话");
  const conversation = await readJsonFile(file);
  conversation.projectId = resolveProjectId(conversation.projectId, await readProjects());
  return conversation;
}

async function renameConversation(id, title) {
  const conversation = await getConversation(id);
  const nextTitle = safeName(title);
  conversation.title = nextTitle;
  await saveConversation(conversation);

  if (conversation.runName) {
    const runDir = path.join(RUNS_DIR, conversation.runName);
    const manifestPath = path.join(runDir, "run-manifest.json");
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = await readJsonFile(manifestPath);
      } catch {
        manifest = {};
      }
    }
    await fsp.writeFile(manifestPath, JSON.stringify({ ...manifest, title: nextTitle, updatedAt: new Date().toISOString() }, null, 2), "utf8");
  }

  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    runName: conversation.runName,
  };
}

async function moveConversation(id, projectId) {
  const conversation = await getConversation(id);
  const resolvedProjectId = resolveProjectId(projectId, await readProjects());
  conversation.projectId = resolvedProjectId;
  await saveConversation(conversation);

  if (conversation.runName) {
    const runDir = path.join(RUNS_DIR, conversation.runName);
    const manifestPath = path.join(runDir, "run-manifest.json");
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = await readJsonFile(manifestPath);
      } catch {
        manifest = {};
      }
    }
    await fsp.writeFile(manifestPath, JSON.stringify({ ...manifest, projectId: resolvedProjectId, updatedAt: new Date().toISOString() }, null, 2), "utf8");
  }

  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    runName: conversation.runName,
    projectId: resolvedProjectId,
  };
}

function buildChatSystemPrompt(appName = DEFAULT_APP_NAME) {
  return [
    `你是本地项目《${appName}》的总控对话助手。`,
    `对用户介绍自己时，统一自称“${appName}”。`,
    "你只围绕两个核心产物工作：AI漫剧剧本、AI漫剧分镜。",
    "你需要像对话式AI一样自然回答，但内部必须保留 M6 技能路由：小说先输入整理，再剧本生成、剧本评审、分镜生成；剧本质量未知先评审；认可剧本可直接分镜；样例和反馈进入学习闭环。",
    "你必须保留 M5 学习原则：用户偏好、样例解释和质量反馈要可沉淀；质量下降时先止损，不把降质输出当正向样例；正式规则不能因为单次反馈静默修改。",
    "如果用户提供小说或剧本，可以直接产出对应阶段内容；如果信息不足，只问最必要的问题。",
    "输出中文。项目默认服务AI漫剧，不按传统影视拍摄逻辑输出。",
  ].join("\n");
}

function buildLightChatSystemPrompt(appName = DEFAULT_APP_NAME) {
  return [
    `你是${appName}。`,
    "用户在闲聊、发散灵感或讨论想法时，用自然、简短、有帮助的中文回复。",
    "不要主动输出完整剧本或分镜；如果用户需要正式产物，引导他在对话里明确发送生成要求，或去画布节点触发生成。",
  ].join("\n");
}

async function chatWithAssistant(body) {
  const message = String(body.message || "").trim();
  const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0;
  if (!message && !hasAttachments) throw new Error("消息不能为空");
  let conversation = body.conversationId
    ? await getConversation(body.conversationId)
    : await createConversation(message.slice(0, 24) || body.attachments?.[0]?.name || "新对话");

  if (!conversation.title || conversation.title === "新对话") {
    conversation.title = safeName(message.slice(0, 24) || body.attachments?.[0]?.name || "新对话");
  }

  const attachments = await saveMessageAttachments(conversation, body.attachments);
  const forcedSkillRoute = findLocalSkillRoute(body.skillRouteId);
  const chatIntent = classifyChatIntent({
    message,
    attachments,
    intent: body.intent || (forcedSkillRoute ? "script_analysis" : ""),
  });
  const explicitLearningMode = body.learningMode === true || String(body.intent || "").toLowerCase() === "learning";
  const skillRoute = chatIntent.mode === "skill"
    ? explicitLearningMode
      ? routeLocalSkill("样例 学习 入库 技能学习")
      : forcedSkillRoute || routeLocalSkill(skillRoutingText(message, attachments))
    : null;
  const userMessage = {
    role: "user",
    content: message || (attachments.length ? "已上传附件。" : ""),
    time: new Date().toISOString(),
    attachments,
  };
  if (explicitLearningMode) {
    userMessage.learningMode = true;
  }
  conversation.messages.push(userMessage);

  const workflowIntent = normalizeWorkflowIntent(body.workflowIntent);
  if (explicitLearningMode) {
    const learningResult = await handleLearningCompose({
      conversation,
      userMessage,
      chatIntent,
      skillRoute,
    });
    conversation.messages.push(learningResult.assistantMessage);
    await saveConversation(conversation);

    return {
      id: conversation.id,
      title: conversation.title,
      runName: conversation.runName,
      content: learningResult.assistantMessage.content,
      messages: conversation.messages,
      usage: null,
    };
  }

  if (workflowIntent) {
    const workflowResult = await runWorkflowChat({
      conversation,
      userMessage,
      workflowIntent,
      model: body.model,
      apiKey: body.apiKey,
    });
    const assistantMessage = buildAssistantMessage({
      content: workflowResult.content,
      model: workflowResult.model,
      usage: workflowResult.usage,
      chatIntent: workflowResult.chatIntent,
      skillRoute: workflowResult.skillRoute,
    });
    assistantMessage.workflow = workflowResult.workflow;
    try {
      await applyAutonomousConversationLearning({
        conversation,
        userMessage,
        assistantMessage,
      });
    } catch (error) {
      assistantMessage.learningError = error.message || String(error);
    }
    conversation.messages.push(assistantMessage);
    await saveConversation(conversation);

    return {
      id: conversation.id,
      title: conversation.title,
      runName: conversation.runName,
      content: workflowResult.content,
      messages: conversation.messages,
      usage: workflowResult.usage,
    };
  }

  const skillContext = skillRoute ? await loadLocalSkillContext(BUSINESS_ROOT, skillRoute) : null;
  const appSettings = await readAppSettings();
  const historyMessages = selectHistoryForIntent(
    conversation.messages.filter((item) => item.role === "user" || item.role === "assistant"),
    chatIntent,
  );
  const modelMessages = chatIntent.mode === "skill"
    ? [
        { role: "system", content: buildChatSystemPrompt(appSettings.appName) },
        { role: "system", content: skillContext.prompt },
        ...historyMessages.map((item) => ({ role: item.role, content: messageContentForModel(item) })),
      ]
    : [
        { role: "system", content: buildLightChatSystemPrompt(appSettings.appName) },
        ...historyMessages.map((item) => ({ role: item.role, content: messageContentForModel(item) })),
      ];
  const result = await deepseekChat({
    provider: body.provider,
    model: body.model,
    messages: modelMessages,
    temperature: 0.7,
  });
  const assistantMessage = buildAssistantMessage({
    ...result,
    chatIntent,
    skillRoute: skillContext
      ? {
          id: skillContext.id,
          name: skillContext.name,
          path: skillContext.path,
          files: skillContext.files,
          currentRulesUsed: skillContext.currentRulesUsed,
          currentRulesLoadError: skillContext.currentRulesLoadError,
        }
      : null,
  });
  try {
    await applyAutonomousConversationLearning({
      conversation,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    assistantMessage.learningError = error.message || String(error);
  }
  conversation.messages.push(assistantMessage);
  await saveConversation(conversation);

  return {
    id: conversation.id,
    title: conversation.title,
    runName: conversation.runName,
    content: result.content,
    messages: conversation.messages,
    usage: result.usage,
  };
}

async function handleLearningCompose({ conversation, userMessage, chatIntent, skillRoute }) {
  const assistantMessage = buildAssistantMessage({
    content: "正在写入本地学习资料库...",
    model: "local-learning",
    chatIntent,
    skillRoute,
  });
  try {
    const learningRecord = await writeConversationLearningRecord(BUSINESS_ROOT, {
      conversation,
      userMessage,
      assistantMessage,
    });
    if (learningRecord) {
      assistantMessage.learningRecord = learningRecord.relativePath;
    }
  } catch (error) {
    assistantMessage.learningError = error.message || String(error);
  }
  try {
    await applyAutonomousConversationLearning({
      conversation,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    assistantMessage.learningError = error.message || String(error);
  }

  const lines = ["已记录为技能学习材料。"];
  if (assistantMessage.learningRecord) {
    lines.push(`本地记录：${assistantMessage.learningRecord}`);
  }
  if (assistantMessage.learningEventStatus === "已生效") {
    lines.push("已同步到当前规则，后续技能调用会读取。");
  } else {
    lines.push("已记录到学习资料库。");
  }
  if (assistantMessage.learningError) {
    lines.push(`学习记录异常：${assistantMessage.learningError}`);
  }
  assistantMessage.content = lines.join("\n");
  return { assistantMessage };
}

async function applyAutonomousConversationLearning({ conversation, userMessage, assistantMessage }) {
  const learningInput = extractExplicitRuleLearningInput({
    conversation,
    userMessage,
    assistantMessage,
  });
  if (!learningInput) return null;
  const result = await learnExplicitRule(BUSINESS_ROOT, learningInput, {
    notifyOnFailure: true,
  });
  assistantMessage.learningEvent = result.event?.eventId || "";
  assistantMessage.learningEventStatus = result.event?.status || "";
  if (result.event?.ruleId) assistantMessage.learningRuleId = result.event.ruleId;
  return result;
}

function runReadme(title, route) {
  return `# 运行目录\n\n标题：${title}\n\n链路：${route}\n\n## 产物\n\n- input.md\n- input-analysis.md\n- generated-script.md\n- script-review.md\n- script.rewritten.md\n- generated-storyboard.md\n- storyboard-review.md\n- generated-storyboard.revised.md\n- coverage-check.md\n- feedback.md\n- run-manifest.json\n`;
}

function taskConfig(task) {
  const configs = {
    "input-analysis": {
      file: "input-analysis.md",
      title: "输入整理和正负分析",
      system: "你是AI漫剧小说改编项目的输入整理专家。输出必须中文，结构清晰，服务后续剧本和分镜生成。",
      instruction: "根据输入材料，整理小说大纲、每集大纲、每集2到4个爽点或剧情高潮点，并做单集与整体负面逻辑分析。重点检查时空跳跃、人物状态断裂、死亡后无解释复活、毒伤或伏笔遗忘、人物动机冲突。",
    },
    "script-generate": {
      file: "generated-script.md",
      title: "生成AI漫剧剧本",
      system: "你是AI漫剧短剧编剧。输出必须适合AI漫剧生产，冲突明确，场景可视化，不写传统影视拍摄说明。",
      instruction: "把输入材料改编成AI漫剧剧本。要求开场有冲突，每场有钩子，保留原著核心人物关系、爽点、伏笔和情绪推进。输出分场剧本，包含旁白、对白、动作、场景和改编说明。",
    },
    "script-review": {
      file: "script-review.md",
      title: "剧本评审",
      system: "你是AI漫剧剧本评审。你要判断剧本能否进入分镜，并给出明确去向。",
      instruction: "评审剧本是否可进入分镜。第一行必须写：评审结论：通过 / 轻改后通过 / 需要重写。检查忠实度、冲突、节奏、人物动机、对白、爽点、逻辑连续性、是否适合AI漫剧画面化。",
    },
    "storyboard-generate": {
      file: "generated-storyboard.md",
      title: "生成AI漫剧分镜",
      system: "你是AI漫剧分镜导演。输出必须使用中文标准分镜格式，字段完整，画面适合AI绘图和视频生成。",
      instruction: "根据剧本生成AI漫剧分镜。每镜包含镜号、场景、叙事目的、景别、运镜、构图、画面内容、角色动作、对白或旁白、时长、连贯性备注、制作备注。运镜服务剧情，不全固定，不乱运镜；人物对话避免连续正面怼脸。",
    },
    "storyboard-review": {
      file: "storyboard-review.md",
      title: "分镜评审",
      system: "你是AI漫剧分镜评审。你要判断分镜是否达标，并给出明确后续流程。",
      instruction: "评审分镜是否达标。第一行必须写：评审结论：通过 / 分镜小修 / 重新生成分镜 / 返回剧本评审。检查字段完整、剧情覆盖、镜头连续性、景别变化、运镜合理性、构图多样性、时长、是否继承历史格式噪声。",
    },
  };
  return configs[task] || configs["input-analysis"];
}

function normalizeWorkflowIntent(intent) {
  const value = String(intent || "").toLowerCase();
  return value === "script" || value === "storyboard" ? value : "";
}

function aggregateUsage(items) {
  const usageList = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!usageList.length) return null;
  const sum = (key) => usageList.reduce((total, item) => {
    const value = Number(item?.[key]);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
  return {
    prompt_tokens: sum("prompt_tokens"),
    completion_tokens: sum("completion_tokens"),
    total_tokens: sum("total_tokens"),
  };
}

function artifactPath(runDir, fileName) {
  return path.join(runDir, fileName);
}

function artifactExists(runDir, fileName) {
  return fs.existsSync(artifactPath(runDir, fileName));
}

async function writeWorkflowInput(runDir, userMessage) {
  const content = messageContentForModel(userMessage);
  const output = [
    "# 输入材料",
    "",
    `更新时间：${new Date().toISOString()}`,
    "",
    content || "已上传附件。",
    "",
  ].join("\n");
  await fsp.writeFile(artifactPath(runDir, "input.md"), output, "utf8");
  return content;
}

function materialLooksLikeScript(text) {
  const source = String(text || "");
  const dialogueMatches = source.match(/(^|\n)\s*[^：:\n]{1,12}(?:[（(][^）)\n]{0,12}[）)])?[：:]/g) || [];
  return dialogueMatches.length >= 3 || /(^|\n)\s*(内景|外景|内\/外|场景|镜号|旁白|△)/.test(source);
}

function reviewAllowsNextStage(text) {
  const source = String(text || "");
  const conclusion = source.match(/(?:评审结论|结论|去向)\s*[:：]\s*([^\n。]+)/);
  if (conclusion) {
    const line = conclusion[1];
    if (/轻改后通过|通过|可以进入|可进入|建议进入|进入分镜|进入下一步/.test(line)) return true;
    if (/不通过|未通过|需要重写|不能进入|不可进入|返回剧本|暂停|不建议进入|逻辑硬伤/.test(line)) return false;
  }
  const normalized = source.replace(/不需要重写/g, "无需重写");
  if (/不通过|未通过|需要重写|不能进入|不可进入|返回剧本|暂停|不建议进入|逻辑硬伤/.test(normalized)) {
    return false;
  }
  return /通过|轻改后通过|可以进入|可进入|建议进入|进入分镜|进入下一步/.test(normalized);
}

async function ensureUserScriptArtifact(runDir, materialText) {
  if (artifactExists(runDir, "generated-script.md") || artifactExists(runDir, "script.rewritten.md")) {
    return { file: "generated-script.md", reused: true, content: "" };
  }
  if (!materialLooksLikeScript(materialText)) return null;
  const output = [
    "# 用户提供剧本",
    "",
    "生成时间：" + new Date().toISOString(),
    "",
    "说明：该节点来自用户直接提供的剧本内容，用于进入剧本评审；并非系统改写产物。",
    "",
    "---",
    "",
    materialText || "已上传剧本附件。",
    "",
  ].join("\n");
  await fsp.writeFile(artifactPath(runDir, "generated-script.md"), output, "utf8");
  await appendManifest(runDir, { lastGenerated: "generated-script.md", scriptSource: "user-provided", updatedAt: new Date().toISOString() });
  return { file: "generated-script.md", reused: false, content: output };
}

async function runWorkflowTask({ runDir, task, model, apiKey, force = false }) {
  const config = taskConfig(task);
  const target = artifactPath(runDir, config.file);
  if (!force && fs.existsSync(target)) {
    const existing = await fsp.readFile(target, "utf8");
    return { ...config, content: existing, usage: null, model: "", reused: true };
  }
  const artifacts = await collectRunContext(runDir);
  const skillContext = await taskSkillContext(task);
  const skillPrompt = skillContext.prompt;
  const userContent = [
    `任务：${config.title}`,
    "",
    config.instruction,
    "",
    "当前运行材料：",
    artifacts || "暂无已有产物。",
  ].join("\n");
  const result = await deepseekChat({
    apiKey,
    provider: null,
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: config.system },
      ...(skillPrompt ? [{ role: "system", content: skillPrompt }] : []),
      { role: "user", content: userContent },
    ],
  });
  let finalContent = result.content;
  let hardRuleValidation = null;
  if (task === "storyboard-generate") {
    const hardRuleResult = applyStoryboardHardRuleValidation(result.content, {
      currentRulesUsed: skillContext.currentRulesUsed || [],
    });
    hardRuleValidation = hardRuleResult.hardRuleValidation;
    if (hardRuleValidation.checked && !hardRuleValidation.finalOk) {
      await recordStoryboardHardRuleFailure({
        canvasId: path.basename(runDir),
        outputId: config.file,
        currentRulesUsed: skillContext.currentRulesUsed || [],
        hardRuleValidation,
      });
      throw new Error("标准工作流分镜产物违反已命中的硬规则，自动拆分修复后仍未通过，已写入学习失败事件。");
    }
    finalContent = hardRuleResult.content;
  }
  const output = `# ${config.title}\n\n生成时间：${new Date().toISOString()}\n\n模型：${result.model}\n\n---\n\n${finalContent}\n`;
  await fsp.writeFile(target, output, "utf8");
  await appendManifest(runDir, {
    lastGenerated: config.file,
    lastModel: result.model,
    updatedAt: new Date().toISOString(),
    ...(task === "storyboard-generate" ? {
      currentRulesUsed: skillContext.currentRulesUsed || [],
      hardRuleValidation,
    } : {}),
  });
  return {
    ...config,
    content: finalContent,
    usage: result.usage,
    model: result.model,
    reused: false,
    ...(task === "storyboard-generate" ? {
      currentRulesUsed: skillContext.currentRulesUsed || [],
      hardRuleValidation,
    } : {}),
  };
}

async function runCanvasTask({ task, input, model, apiKey, skillPrompt = "" }) {
  const config = taskConfig(task);
  const resolvedSkillPrompt = skillPrompt || await taskSkillPrompt(task);
  const systemMessages = [{ role: "system", content: config.system }];
  if (resolvedSkillPrompt) {
    systemMessages.push({ role: "system", content: resolvedSkillPrompt });
  }
  const result = await deepseekChat({
    apiKey,
    provider: null,
    model,
    temperature: 0.7,
    messages: [
      ...systemMessages,
      {
        role: "user",
        content: [
          `任务：${config.title}`,
          "",
          config.instruction,
          "",
          "当前节点材料：",
          input || "暂无内容。",
        ].join("\n"),
      },
    ],
  });
  return {
    ...config,
    content: result.content,
    usage: result.usage,
    model: result.model,
  };
}

async function taskSkillPrompt(task) {
  if (task === "storyboard-generate") {
    return canvasStoryboardSkillPrompt();
  }
  return "";
}

async function taskSkillContext(task) {
  if (task === "storyboard-generate") {
    return canvasStoryboardSkillContext();
  }
  return {
    prompt: await taskSkillPrompt(task),
    currentRulesUsed: [],
  };
}

async function canvasStoryboardSkillPrompt() {
  return (await canvasStoryboardSkillContext()).prompt;
}

async function canvasStoryboardSkillContext() {
  const skillContext = await loadLocalSkillContext(BUSINESS_ROOT, findLocalSkillRoute("storyboard-generate") || routeLocalSkill("分镜"));
  const standardPath = "docs/分镜标准格式.md";
  const standardText = await fsp.readFile(path.join(ROOT, standardPath), "utf8");
  const prompt = [
    skillContext.prompt,
    "【画布分镜生成补充要求】",
    "每次调用只生成当前分集的分镜脚本，不要合并其他集数，不要输出表格。",
    "【硬性输出约束】",
    "1. 同一个镜号只能有一个说话人；如果出现两个人物对话，必须拆成连续镜号，每个镜号只保留一个人物的台词。",
    "2. 单条台词不得超过 20 个字；超过时必须拆成新的镜号或拆成多条台词，且每条都不超过 20 个字。",
    "3. 字段标签使用纯文本，不要使用 Markdown 加粗、表格、项目符号或把多个字段挤在同一行。",
    "4. 每个镜号必须按文本块输出：镜号、景别、运镜、情绪/动作、音效、台词、时长；人物对白只能放在台词字段，不要写进情绪/动作。",
    "5. 只输出分镜正文，不要寒暄、解释、标题、Markdown 分隔线或“好的，收到任务”等非分镜内容。",
    `## 分镜标准文档：${standardPath}\n\n${standardText}`,
  ].join("\n\n");
  return {
    prompt,
    currentRulesUsed: skillContext.currentRulesUsed || [],
  };
}

function findCanvasNode(canvas, nodeId) {
  const node = canvas.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error("找不到画布节点");
  return node;
}

function isRevisionCanvasNode(node) {
  return node?.meta?.variantKind === "revision";
}

function uniqueCanvasNodeTitle(canvas, baseTitle, excludeNodeId = "") {
  const cleanBase = String(baseTitle || "").trim() || "未命名节点";
  const used = new Set((canvas.nodes || [])
    .filter((node) => node.id !== excludeNodeId)
    .map((node) => String(node.title || "").trim())
    .filter(Boolean));
  if (!used.has(cleanBase)) return cleanBase;
  let index = 2;
  while (used.has(`${cleanBase} ${index}`)) index += 1;
  return `${cleanBase} ${index}`;
}

async function generateCanvasScript(body) {
  let canvas = await getCanvas(body.canvasId);
  const sourceNode = findCanvasNode(canvas, body.nodeId);
  if (sourceNode.type !== "novel") throw new Error("只有小说节点可以生成剧本");
  const result = await runCanvasTask({
    task: "script-generate",
    input: sourceNode.content,
    model: body.model,
    apiKey: body.apiKey,
  });
  const scriptNode = {
    id: `script-${conversationId()}`,
    type: "script",
    title: uniqueCanvasNodeTitle(canvas, `${sourceNode.title || "小说"} 生成剧本`),
    content: result.content,
    x: Number(sourceNode.x || 120) + 460,
    y: Number(sourceNode.y || 120),
    width: 380,
    height: 280,
    meta: {
      sourceNodeId: sourceNode.id,
      model: result.model,
      usage: result.usage,
      generatedAt: new Date().toISOString(),
    },
  };
  canvas = addCanvasNode(canvas, scriptNode);
  canvas = connectCanvasNodes(canvas, sourceNode.id, scriptNode.id, "生成剧本");
  canvas = await saveCanvas(canvas);
  return { canvas, node: scriptNode, model: result.model, usage: result.usage };
}

async function planCanvasStoryboards(body) {
  const canvas = await getCanvas(body.canvasId);
  const sourceNode = findCanvasNode(canvas, body.nodeId);
  if (sourceNode.type !== "script") throw new Error("只有剧本节点可以生成分镜");
  return {
    canvasId: canvas.id,
    scriptNodeId: sourceNode.id,
    episodes: splitScriptIntoEpisodes(sourceNode.content),
  };
}

async function generateCanvasStoryboards(body) {
  let canvas = await getCanvas(body.canvasId);
  const sourceNode = findCanvasNode(canvas, body.nodeId);
  if (sourceNode.type !== "script") throw new Error("只有剧本节点可以生成分镜");
  const selectedEpisodes = Array.isArray(body.episodes) && body.episodes.length
    ? body.episodes
    : splitScriptIntoEpisodes(sourceNode.content);
  const plan = buildStoryboardNodePlan({
    scriptNodeId: sourceNode.id,
    episodes: selectedEpisodes,
    origin: sourceNode,
  });
  const generatedNodes = [];
  const usages = [];
  let lastModel = "";
  const storyboardSkillContext = await canvasStoryboardSkillContext();

  for (let index = 0; index < selectedEpisodes.length; index += 1) {
    const episode = selectedEpisodes[index];
    const plannedNode = plan.nodes[index];
    const result = await runCanvasTask({
      task: "storyboard-generate",
      input: [
        `请只为以下分集生成分镜脚本：${episode.title || `第${episode.number || index + 1}集`}`,
        "",
        episode.content || sourceNode.content,
      ].join("\n"),
      model: body.model,
      apiKey: body.apiKey,
      skillPrompt: storyboardSkillContext.prompt,
    });
    usages.push(result.usage);
    lastModel = result.model || lastModel;
    const titleScope = { nodes: [...(canvas.nodes || []), ...generatedNodes] };
    const hardRuleResult = applyStoryboardHardRuleValidation(result.content, {
      currentRulesUsed: storyboardSkillContext.currentRulesUsed || [],
    });
    if (hardRuleResult.hardRuleValidation.checked && !hardRuleResult.hardRuleValidation.finalOk) {
      await recordStoryboardHardRuleFailure({
        canvasId: canvas.id,
        outputId: plannedNode.id,
        currentRulesUsed: storyboardSkillContext.currentRulesUsed || [],
        hardRuleValidation: hardRuleResult.hardRuleValidation,
      });
      throw new Error("分镜输出违反已命中的硬规则，自动拆分修复后仍未通过，已写入学习失败事件。");
    }
    generatedNodes.push({
      ...plannedNode,
      title: uniqueCanvasNodeTitle(titleScope, plannedNode.title),
      content: hardRuleResult.content,
      meta: {
        ...plannedNode.meta,
        model: result.model,
        usage: result.usage,
        generatedAt: new Date().toISOString(),
        currentRulesUsed: storyboardSkillContext.currentRulesUsed || [],
        validation: hardRuleResult.validation,
        hardRuleValidation: hardRuleResult.hardRuleValidation,
      },
    });
  }

  for (const node of generatedNodes) {
    canvas = addCanvasNode(canvas, node);
  }
  for (const edge of plan.edges) {
    canvas = connectCanvasNodes(canvas, edge.from, edge.to, edge.label);
  }
  canvas = await saveCanvas(canvas);
  return { canvas, nodes: generatedNodes, model: lastModel, usage: aggregateUsage(usages) };
}

async function recordStoryboardHardRuleFailure(input = {}) {
  const currentRulesUsed = Array.isArray(input.currentRulesUsed) ? input.currentRulesUsed : [];
  const appliedRules = Array.isArray(input.hardRuleValidation?.appliedRules)
    ? input.hardRuleValidation.appliedRules
    : [];
  const ruleRefs = appliedRules.map((rule) => rule.ruleId).filter(Boolean);
  const sourceEventIds = Array.from(new Set(appliedRules.flatMap((rule) =>
    Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : []
  ).map(String).filter(Boolean)));
  const firstRule = appliedRules[0] || currentRulesUsed[0] || {};
  const failedAt = new Date().toISOString();
  const eventId = `hard-rule-validation-failed-${safeEventSegment(input.canvasId)}-${safeEventSegment(input.outputId)}-${Date.now()}`;
  await appendLearningEvent(BUSINESS_ROOT, {
    eventId,
    internalStatus: "failed",
    jobStatus: "failed",
    learningMode: "evidence",
    landingType: "eval",
    sourceType: "generation",
    topicKey: firstRule.topicKey || "storyboard.dialogue.length",
    conflictKey: firstRule.conflictKey || firstRule.topicKey || "storyboard.dialogue.length",
    canvasId: input.canvasId,
    outputId: input.outputId,
    sourceEventIds,
    currentRulesUsedRefs: ruleRefs,
    summary: "分镜输出违反已影响生成的硬规则，自动修正后仍失败。",
    error: {
      stage: "storyboard-hard-rule-post-validation",
      code: "STORYBOARD_HARD_RULE_VALIDATION_FAILED",
      message: "自动台词拆分后仍存在硬规则违规。",
      issues: input.hardRuleValidation?.finalIssues || input.hardRuleValidation?.initialIssues || [],
    },
    generationProof: {
      proofStatus: "failed",
      currentRulesUsedRefs: ruleRefs,
      validationResultRefs: [String(input.outputId || "").trim()].filter(Boolean),
      failureEventIds: [eventId],
    },
    createdAt: failedAt,
    updatedAt: failedAt,
  });
}

function safeEventSegment(value) {
  return String(value || "output")
    .replace(/[^0-9A-Za-z_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "output";
}

function storyboardRevisionIssuesForPrompt(parentNode) {
  if (parentNode?.type !== "storyboard") return [];
  const savedValidation = parentNode.meta?.validation;
  if (savedValidation && !savedValidation.ok && Array.isArray(savedValidation.issues)) {
    return savedValidation.issues;
  }
  return validateStoryboardContent(parentNode.content).issues;
}

function formatStoryboardRevisionIssues(issues = []) {
  const validIssues = Array.isArray(issues) ? issues.filter(Boolean) : [];
  if (!validIssues.length) return "";
  const lines = [
    "已识别的分镜问题清单（必须逐条处理，不要忽略）：",
    "处理要求：不能只做换行、排版或解释；必须根据问题含义修改对应镜头结构、字段、镜号或台词，并输出完整修改后的分镜全文。",
  ];
  validIssues.forEach((issue, index) => {
    const parts = [];
    parts.push(`${index + 1}. ${String(issue.message || issue.type || "分镜问题")}`);
    if (issue.lineNumber) parts.push(`行号：${issue.lineNumber}`);
    if (issue.lineText) parts.push(`原文：${issue.lineText}`);
    if (issue.dialogue) parts.push(`需处理台词：${issue.dialogue}`);
    if (Array.isArray(issue.suggestedLines) && issue.suggestedLines.length) {
      parts.push(`建议拆分：${issue.suggestedLines.map((line) => line.text || line).join(" / ")}`);
    }
    lines.push(parts.join("\n"));
  });
  return lines.join("\n");
}

async function reviseCanvasNode(body) {
  let canvas = await getCanvas(body.canvasId);
  const node = findCanvasNode(canvas, body.nodeId);
  if (!isRevisionCanvasNode(node) || node.meta?.variantKind !== "revision") {
    throw new Error("只有通过修改功能创建的节点可以对话修改");
  }
  const parentNodeId = String(node.meta?.parentNodeId || "");
  if (!parentNodeId) throw new Error("修改节点缺少父级来源");
  const parentNode = findCanvasNode(canvas, parentNodeId);
  if (node.meta?.chatLocked) throw new Error("该修改节点已经完成一次对话，不能再次修改");
  const prompt = String(body.prompt || "").trim();
  if (!prompt) throw new Error("请输入修改要求");
  if (!["novel", "script", "storyboard"].includes(node.type)) {
    throw new Error("该节点类型暂不支持修改对话");
  }

  const storyboardSkillContext = node.type === "storyboard" ? await canvasStoryboardSkillContext() : null;
  const skillPrompt = storyboardSkillContext?.prompt || "";
  const storyboardIssueContext = formatStoryboardRevisionIssues(storyboardRevisionIssuesForPrompt(parentNode));
  const messages = [
    {
      role: "system",
      content: [
        "你是 AI 漫剧画布的节点修改助手。",
        "你只能根据父级节点内容和用户的修改要求，输出修改后的完整节点内容。",
        "不要输出解释、寒暄、总结或 Markdown 标题；不要只输出差异说明。",
      ].join("\n"),
    },
  ];
  if (skillPrompt) messages.push({ role: "system", content: skillPrompt });
  messages.push({
    role: "user",
    content: [
      `修改节点类型：${canvasTypeText(node.type)}`,
      `修改节点标题：${node.title || ""}`,
      `父级节点ID：${parentNodeId}`,
      `父级节点标题：${parentNode.title || node.meta?.parentTitleSnapshot || ""}`,
      "",
      "父级节点内容：",
      parentNode.content || "",
      storyboardIssueContext ? `\n${storyboardIssueContext}` : "",
      "",
      "用户修改要求：",
      prompt,
    ].join("\n"),
  });

  const result = await deepseekChat({
    apiKey: body.apiKey,
    provider: null,
    model: body.model,
    temperature: 0.55,
    messages,
  });
  const hardRuleResult = node.type === "storyboard"
    ? applyStoryboardHardRuleValidation(result.content, {
        currentRulesUsed: storyboardSkillContext?.currentRulesUsed || [],
      })
    : null;
  if (hardRuleResult?.hardRuleValidation?.checked && !hardRuleResult.hardRuleValidation.finalOk) {
    await recordStoryboardHardRuleFailure({
      canvasId: canvas.id,
      outputId: node.id,
      currentRulesUsed: storyboardSkillContext?.currentRulesUsed || [],
      hardRuleValidation: hardRuleResult.hardRuleValidation,
    });
    throw new Error("分镜修改结果违反已命中的硬规则，自动拆分修复后仍未通过，已写入学习失败事件。");
  }
  const revisedValidation = hardRuleResult?.validation || null;
  const revisedContent = hardRuleResult?.content || result.content;
  const revisedAt = new Date().toISOString();
  const latestCanvas = await getCanvas(body.canvasId);
  const latestNode = findCanvasNode(latestCanvas, node.id);
  if (!isRevisionCanvasNode(latestNode) || latestNode.meta?.variantKind !== "revision") {
    throw new Error("修改节点已不存在或类型已变化，无法回填结果");
  }
  if (latestNode.meta?.chatLocked) {
    throw new Error("该修改节点已经完成一次对话，不能再次修改");
  }
  const latestParentNode = findCanvasNode(latestCanvas, parentNodeId);
  latestCanvas.nodes = (latestCanvas.nodes || []).map((item) => item.id === node.id
      ? {
          ...item,
          content: revisedContent,
          meta: {
            ...(item.meta || {}),
            variantKind: "revision",
            parentNodeId,
            parentTitleSnapshot: latestParentNode.title || parentNode.title || item.meta?.parentTitleSnapshot || "",
            chatPrompt: prompt,
            chatResponse: revisedContent,
            chatLocked: true,
            revisedAt,
            model: result.model,
            usage: result.usage,
            currentRulesUsed: storyboardSkillContext?.currentRulesUsed || item.meta?.currentRulesUsed || [],
            ...(hardRuleResult ? { hardRuleValidation: hardRuleResult.hardRuleValidation } : {}),
            ...(revisedValidation ? { validation: revisedValidation } : {}),
          },
        }
      : item);
  canvas = await saveCanvas(latestCanvas);
  return {
    canvas,
    node: findCanvasNode(canvas, node.id),
    model: result.model,
    usage: result.usage,
  };
}

function canvasTypeText(type) {
  return {
    novel: "小说",
    script: "剧本",
    storyboard: "分镜脚本",
    label: "标识",
  }[type] || "节点";
}

function workflowSkillRoute(workflowIntent) {
  const files = [
    "skills/01-input-analysis/novel-intake/SKILL.md",
    "skills/02-script/script-generate/SKILL.md",
    "skills/02-script/script-review-rewrite/SKILL.md",
  ];
  if (workflowIntent === "storyboard") {
    files.push("skills/03-storyboard/storyboard-generate/SKILL.md");
  }
  return {
    id: workflowIntent === "storyboard" ? "workflow-storyboard" : "workflow-script",
    name: workflowIntent === "storyboard" ? "标准分镜流程" : "标准剧本流程",
    path: "skills/00-orchestrator/mbh-workflow",
    files,
  };
}

function formatWorkflowReply({ workflowIntent, steps, finalContent, stoppedReason }) {
  const title = workflowIntent === "storyboard"
    ? "已按标准流程处理分镜请求"
    : "已按标准流程处理剧本请求";
  const lines = [`# ${title}`, ""];
  lines.push("## 本次实际执行");
  lines.push("");
  for (const step of steps) {
    lines.push(`- ${step}`);
  }
  if (stoppedReason) {
    lines.push("");
    lines.push(`## 流程暂停原因`);
    lines.push("");
    lines.push(stoppedReason);
  }
  if (finalContent) {
    lines.push("");
    lines.push("## 当前产物");
    lines.push("");
    lines.push(finalContent);
  }
  return lines.join("\n");
}

async function runWorkflowChat({ conversation, userMessage, workflowIntent, model, apiKey }) {
  const runDir = conversation.runName ? path.join(RUNS_DIR, conversation.runName) : null;
  if (!runDir) throw new Error("当前会话缺少运行目录");
  await fsp.mkdir(runDir, { recursive: true });
  const materialText = await writeWorkflowInput(runDir, userMessage);
  const steps = ["已写入 input.md（输入材料）"];
  const usages = [];
  let lastModel = "";
  let finalContent = "";
  let stoppedReason = "";

  const runAndRemember = async (task, label, options = {}) => {
    const result = await runWorkflowTask({ runDir, task, model, apiKey, ...options });
    steps.push(result.reused ? `已存在 ${result.file}（${label}），本次复用` : `已生成 ${result.file}（${label}）`);
    if (result.usage) usages.push(result.usage);
    if (result.model) lastModel = result.model;
    return result;
  };

  await appendManifest(runDir, { updatedAt: new Date().toISOString() });
  await runAndRemember("input-analysis", "小说输入整理、正向爽点分析和负面逻辑检查");

  if (workflowIntent === "script") {
    const script = await runAndRemember("script-generate", "第一版 AI 漫剧剧本", { force: true });
    const review = await runAndRemember("script-review", "剧本评审，不跳过分镜前置检查", { force: true });
    finalContent = [
      "### 生成剧本",
      "",
      script.content,
      "",
      "### 剧本评审",
      "",
      review.content,
    ].join("\n");
    return {
      content: formatWorkflowReply({ workflowIntent, steps, finalContent }),
      model: lastModel,
      usage: aggregateUsage(usages),
      chatIntent: { intent: "script", mode: "skill", reason: "workflow-script" },
      skillRoute: workflowSkillRoute(workflowIntent),
      workflow: { intent: workflowIntent, steps },
    };
  }

  let scriptReady = artifactExists(runDir, "generated-script.md") || artifactExists(runDir, "script.rewritten.md");
  if (!scriptReady) {
    const userScript = await ensureUserScriptArtifact(runDir, materialText);
    if (userScript) {
      steps.push("已识别用户直接提供剧本，并写入 generated-script.md（待评审剧本）");
      scriptReady = true;
    }
  }
  if (!scriptReady) {
    await runAndRemember("script-generate", "由小说材料生成第一版 AI 漫剧剧本", { force: true });
  }

  const review = await runAndRemember("script-review", "剧本评审，不跳过分镜前置检查", { force: true });
  if (!reviewAllowsNextStage(review.content)) {
    stoppedReason = "剧本评审未明确通过，已停止在剧本评审节点；请先按评审意见修改剧本，暂不生成分镜。";
    finalContent = review.content;
    return {
      content: formatWorkflowReply({ workflowIntent, steps, finalContent, stoppedReason }),
      model: lastModel,
      usage: aggregateUsage(usages),
      chatIntent: { intent: "script_analysis", mode: "skill", reason: "workflow-script-review-gate" },
      skillRoute: workflowSkillRoute(workflowIntent),
      workflow: { intent: workflowIntent, steps, stoppedReason },
    };
  }

  const storyboard = await runAndRemember("storyboard-generate", "剧本评审通过后生成分镜", { force: true });
  const storyboardReview = await runAndRemember("storyboard-review", "分镜评审，不跳过分镜质量检查", { force: true });
  finalContent = [
    "### 生成分镜",
    "",
    storyboard.content,
    "",
    "### 分镜评审",
    "",
    storyboardReview.content,
  ].join("\n");
  return {
    content: formatWorkflowReply({ workflowIntent, steps, finalContent }),
    model: lastModel,
    usage: aggregateUsage(usages),
    chatIntent: { intent: "storyboard", mode: "skill", reason: "workflow-storyboard" },
    skillRoute: workflowSkillRoute(workflowIntent),
    workflow: { intent: workflowIntent, steps },
  };
}

async function deepseekChat({ apiKey, provider, baseUrl, model, messages, temperature = 0.7 }) {
  const config = await readDeepSeekConfig();
  const active = resolveActiveModelSettings(config, { apiKey, provider, baseUrl, model });
  const key = active.apiKey;
  if (!key) throw new Error(`缺少 ${active.providerLabel} API Key。请在网页设置里填写，或设置 ${active.apiKeyEnv}。`);
  const payload = {
    model: active.model,
    messages,
    temperature,
    stream: false,
  };
  const response = await fetch(`${active.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `${active.providerLabel} HTTP ${response.status}`;
    throw new Error(sanitizeProviderError(`${active.providerLabel} HTTP ${response.status}: ${message}`));
  }
  const result = data?.data && !data?.choices ? data.data : data;
  return {
    content: result.choices?.[0]?.message?.content || "",
    usage: result.usage || null,
    model: result.model || payload.model,
    provider: active.provider,
  };
}

function sanitizeProviderError(message) {
  return String(message || "")
    .replace(/sk-[A-Za-z0-9_*.-]{8,}/g, (value) => {
      const visibleStart = value.slice(0, 6);
      const visibleEnd = value.slice(-4);
      return `${visibleStart}***${visibleEnd}`;
    })
    .replace(/Bearer\s+[A-Za-z0-9_*./+=-]{8,}/gi, "Bearer ***");
}

async function generateWithDeepSeek(body) {
  const runName = body.run;
  if (!runName) throw new Error("缺少运行目录");
  const runDir = resolveRun(runName);
  const config = taskConfig(body.task);
  const artifacts = await collectRunContext(runDir);
  const input = String(body.input || "").trim();
  const skillContext = await taskSkillContext(body.task);
  const skillPrompt = skillContext.prompt;
  const userContent = [
    `任务：${config.title}`,
    "",
    config.instruction,
    "",
    "当前运行材料：",
    artifacts || "暂无已有产物。",
    "",
    input ? `补充要求：\n${input}` : "",
  ].join("\n");
  const result = await deepseekChat({
    apiKey: body.apiKey,
    provider: body.provider,
    model: body.model,
    temperature: Number(body.temperature || 0.7),
    messages: [
      { role: "system", content: config.system },
      ...(skillPrompt ? [{ role: "system", content: skillPrompt }] : []),
      { role: "user", content: userContent },
    ],
  });
  let finalContent = result.content;
  let hardRuleValidation = null;
  if (body.task === "storyboard-generate") {
    const hardRuleResult = applyStoryboardHardRuleValidation(result.content, {
      currentRulesUsed: skillContext.currentRulesUsed || [],
    });
    hardRuleValidation = hardRuleResult.hardRuleValidation;
    if (hardRuleValidation.checked && !hardRuleValidation.finalOk) {
      await recordStoryboardHardRuleFailure({
        canvasId: path.basename(runDir),
        outputId: config.file,
        currentRulesUsed: skillContext.currentRulesUsed || [],
        hardRuleValidation,
      });
      throw new Error("分镜产物违反已命中的硬规则，自动拆分修复后仍未通过，已写入学习失败事件。");
    }
    finalContent = hardRuleResult.content;
  }
  const target = path.join(runDir, config.file);
  const output = `# ${config.title}\n\n生成时间：${new Date().toISOString()}\n\n模型：${result.model}\n\n---\n\n${finalContent}\n`;
  await fsp.writeFile(target, output, "utf8");
  await appendManifest(runDir, {
    lastGenerated: config.file,
    lastModel: result.model,
    updatedAt: new Date().toISOString(),
    ...(body.task === "storyboard-generate" ? {
      currentRulesUsed: skillContext.currentRulesUsed || [],
      hardRuleValidation,
    } : {}),
  });
  return {
    file: config.file,
    content: finalContent,
    usage: result.usage,
    ...(body.task === "storyboard-generate" ? {
      currentRulesUsed: skillContext.currentRulesUsed || [],
      hardRuleValidation,
    } : {}),
  };
}

async function collectRunContext(runDir) {
  const priority = [
    "input.md",
    "input-analysis.md",
    "generated-script.md",
    "script.rewritten.md",
    "script-review.md",
    "generated-storyboard.md",
    "storyboard-review.md",
    "feedback.md",
  ];
  const parts = [];
  for (const name of priority) {
    const file = path.join(runDir, name);
    if (!fs.existsSync(file)) continue;
    const text = await fsp.readFile(file, "utf8");
    parts.push(`## ${name}\n\n${text.slice(0, 12000)}`);
  }
  return parts.join("\n\n");
}

async function appendManifest(runDir, patch) {
  const file = path.join(runDir, "run-manifest.json");
  let manifest = {};
  if (fs.existsSync(file)) {
    try {
      manifest = await readJsonFile(file);
    } catch {
      manifest = {};
    }
  }
  await fsp.writeFile(file, JSON.stringify({ ...manifest, ...patch }, null, 2), "utf8");
}

async function addFeedback(body) {
  const runDir = resolveRun(body.run);
  const feedback = String(body.feedback || "").trim();
  if (!feedback) throw new Error("反馈内容为空");
  const stage = body.stage || "未指定";
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const feedbackFile = path.join(runDir, "feedback.md");
  const block = `\n## ${stamp}\n\n阶段：${stage}\n\n${feedback}\n`;
  if (!fs.existsSync(feedbackFile)) {
    await fsp.writeFile(feedbackFile, `# 使用人员反馈\n${block}`, "utf8");
  } else {
    await fsp.appendFile(feedbackFile, block, "utf8");
  }
  const jsonl = JSON.stringify({ time: new Date().toISOString(), stage, feedback, source: "M7 local web" });
  await fsp.appendFile(path.join(runDir, "learnings.jsonl"), `${jsonl}\n`, "utf8");
  return { file: "feedback.md" };
}

async function rerunFromRun(body) {
  const sourceDir = resolveRun(body.run);
  const title = safeName(body.title || `复跑-${path.basename(sourceDir)}`);
  const runName = `${timestamp()}-${title}`;
  const runDir = path.join(RUNS_DIR, runName);
  await fsp.mkdir(runDir, { recursive: true });
  const names = ["input.md", "input-analysis.md", "generated-script.md", "script.rewritten.md", "generated-storyboard.md", "generated-storyboard.revised.md", "feedback.md"];
  for (const name of names) {
    const source = path.join(sourceDir, name);
    if (fs.existsSync(source)) {
      await fsp.copyFile(source, path.join(runDir, `previous-${name}`));
    }
  }
  await fsp.writeFile(path.join(runDir, "rerun.md"), `# 复跑说明\n\n来源运行：${path.basename(sourceDir)}\n\n请根据 previous-* 产物决定从剧本评审、分镜小修或重新生成开始。\n`, "utf8");
  await fsp.writeFile(path.join(runDir, "run-manifest.json"), JSON.stringify({ title, sourceRun: path.basename(sourceDir), status: "rerun-created", createdAt: new Date().toISOString() }, null, 2), "utf8");
  return { run: runName };
}

async function archiveLearningManually(body) {
  const runName = body.run;
  if (!runName) throw new Error("缺少运行目录");
  const selections = Array.isArray(body.selections) ? body.selections : [];
  if (!selections.length) throw new Error("请先加入至少一条采纳项");

  const runDir = resolveRun(runName);
  const createdAt = new Date().toISOString();
  const markdown = buildArchiveRecordMarkdown({ runName, selections, createdAt });
  const date = timestamp().slice(0, 8).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  const suffix = Math.random().toString(16).slice(2, 8);
  const archiveFile = `manual-learning-archive-${date}-${suffix}.md`;
  const learningDir = path.join(BUSINESS_ROOT, "learning", "conversation-records");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(path.join(learningDir, archiveFile), markdown, "utf8");
  await fsp.writeFile(path.join(runDir, archiveFile), markdown, "utf8");
  await appendManifest(runDir, { lastManualArchive: archiveFile, updatedAt: createdAt });
  return {
    file: archiveFile,
    learningRecord: `learning/conversation-records/${archiveFile}`,
    runRecord: `runs/${runName}/${archiveFile}`,
  };
}

async function learningStatus() {
  const countFiles = async (dir) => {
    const full = path.join(BUSINESS_ROOT, dir);
    if (!fs.existsSync(full)) return 0;
    const entries = await fsp.readdir(full, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name !== "README.md").length;
  };
  return {
    runs: (await listRuns()).length,
    conversationRecords: await countFiles("learning/conversation-records"),
    regressionReports: await countFiles("learning/regression-reports"),
    snapshots: await countFiles("learning/snapshots"),
    skillEvolutionReports: await countFiles("learning/skill-evolution-reports"),
  };
}

async function handleLearningCorrection(body = {}) {
  return applyLearningCorrectionRequest(BUSINESS_ROOT, body, {
    appendLearningEvent,
    updateCurrentRuleStatus,
    buildLearningLibrary,
  });
}

async function runLearningCycle() {
  const script = path.join(ROOT, "tools", "Invoke-AutoLearningCycle.ps1");
  if (!fs.existsSync(script)) {
    throw new Error("未找到 M5 学习闭环脚本：tools/Invoke-AutoLearningCycle.ps1");
  }
  const result = await runCommand("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-Root",
    BUSINESS_ROOT,
    "-Date",
    new Date().toISOString().slice(0, 10),
    "-Force",
  ]);
  return { output: result.stdout.trim(), error: result.stderr.trim() };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/status") {
    const config = await readDeepSeekConfig();
    const modelSettings = publicModelSettings(config);
    const appSettings = await readAppSettings();
    return sendJson(res, 200, {
      ok: true,
      acceptanceMode: ACCEPTANCE_MODE,
      acceptanceRoot: ACCEPTANCE_ROOT,
      appName: appSettings.appName,
      provider: modelSettings.provider,
      providerLabel: modelSettings.providerLabel,
      deepseekConfigured: modelSettings.provider === "deepseek" && (modelSettings.hasEnvApiKey || modelSettings.hasStoredApiKey),
      modelConfigured: modelSettings.hasEnvApiKey || modelSettings.hasStoredApiKey,
      defaultModel: modelSettings.model,
      baseUrl: modelSettings.baseUrl,
      docs: modelSettings.provider === "openai" ? "https://platform.openai.com/docs/" : "https://api-docs.deepseek.com/",
    });
  }
  if (req.method === "GET" && url.pathname === "/api/config") {
    const config = await readDeepSeekConfig();
    const appSettings = await readAppSettings();
    return sendJson(res, 200, {
      appName: appSettings.appName,
      ...publicModelSettings(config),
    });
  }
  if (req.method === "GET" && url.pathname === "/api/runs") {
    return sendJson(res, 200, { runs: await listRuns() });
  }
  if (req.method === "GET" && url.pathname === "/api/conversations") {
    const [projects, conversations, projectGroups] = await Promise.all([
      readProjects(),
      listConversations(),
      listConversationProjectGroups(),
    ]);
    return sendJson(res, 200, { projects, conversations, projectGroups });
  }
  if (req.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(res, 200, { projects: await readProjects() });
  }
  if (req.method === "GET" && url.pathname === "/api/canvases") {
    return sendJson(res, 200, { canvases: await listCanvases({ includeDeleted: url.searchParams.get("includeDeleted") === "1" }) });
  }
  if (req.method === "GET" && url.pathname === "/api/canvas") {
    return sendJson(res, 200, await getCanvas(url.searchParams.get("id")));
  }
  if (req.method === "GET" && url.pathname === "/api/conversation-search") {
    return sendJson(res, 200, { results: await searchConversations(url.searchParams.get("q")) });
  }
  if (req.method === "GET" && url.pathname === "/api/conversation") {
    return sendJson(res, 200, await getConversation(url.searchParams.get("id")));
  }
  if (req.method === "GET" && url.pathname === "/api/artifacts") {
    return sendJson(res, 200, { files: await listArtifacts(url.searchParams.get("run")) });
  }
  if (req.method === "GET" && url.pathname === "/api/workbench") {
    return sendJson(res, 200, await getWorkbench(url.searchParams.get("run")));
  }
  if (req.method === "GET" && url.pathname === "/api/artifact") {
    const file = resolveArtifact(url.searchParams.get("run"), url.searchParams.get("file"));
    return sendText(res, 200, await fsp.readFile(file, "utf8"), MIME[path.extname(file)] || "text/plain; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/api/learning-status") {
    return sendJson(res, 200, await learningStatus());
  }
  if (req.method === "GET" && url.pathname === "/api/learning-library") {
    return sendJson(res, 200, await buildLearningLibrary(BUSINESS_ROOT));
  }
  if (req.method === "GET" && url.pathname === "/api/notifications") {
    return sendJson(res, 200, { notifications: await listNotifications(BUSINESS_ROOT) });
  }
  if (req.method === "GET" && url.pathname === "/api/product-completeness") {
    return sendJson(res, 200, { milestones: buildCompletenessMatrix() });
  }
  if (req.method === "GET" && url.pathname === "/api/route-doc") {
    const file = path.join(ROOT, "docs", "技能路由说明.md");
    return sendJson(res, 200, { content: fs.existsSync(file) ? await fsp.readFile(file, "utf8") : "未找到技能路由说明。" });
  }

  const body = await readBody(req);
  if (req.method === "POST" && url.pathname === "/api/projects") {
    return sendJson(res, 200, { project: await createProjectRecord(body.title), projects: await readProjects() });
  }
  if (req.method === "POST" && url.pathname === "/api/projects/rename") {
    const project = await renameProjectRecord(body.id, body.title);
    return sendJson(res, 200, { project, projects: await readProjects() });
  }
  if (req.method === "POST" && url.pathname === "/api/runs") {
    return sendJson(res, 200, await createRun(body));
  }
  if (req.method === "POST" && url.pathname === "/api/learning-rules/status") {
    const result = await updateCurrentRuleStatus(BUSINESS_ROOT, body);
    return sendJson(res, 200, { ...result, library: await buildLearningLibrary(BUSINESS_ROOT) });
  }
  if (req.method === "POST" && url.pathname === "/api/learning-corrections") {
    return sendJson(res, 200, await handleLearningCorrection(body));
  }
  if (req.method === "POST" && url.pathname === "/api/conversations") {
    let projectId = body.projectId;
    if (body.newProjectTitle) {
      const project = await createProjectRecord(body.newProjectTitle);
      projectId = project.id;
    }
    return sendJson(res, 200, await createConversation({ title: body.title || "新对话", projectId }));
  }
  if (req.method === "POST" && url.pathname === "/api/conversation/rename") {
    return sendJson(res, 200, await renameConversation(body.id, body.title));
  }
  if (req.method === "POST" && url.pathname === "/api/conversation/move") {
    return sendJson(res, 200, await moveConversation(body.id, body.projectId));
  }
  if (req.method === "POST" && url.pathname === "/api/canvases") {
    return sendJson(res, 200, await createCanvasRecord(body.title || "新画布"));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/save") {
    return sendJson(res, 200, await saveCanvas(body.canvas || body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/archive-check") {
    return sendJson(res, 200, await checkCanvasArchiveReadiness(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/archive") {
    return sendJson(res, 200, await archiveCanvasRecord(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/delete") {
    return sendJson(res, 200, await deleteCanvasRecord(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/restore") {
    return sendJson(res, 200, await restoreCanvasRecord(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/generate-script") {
    return sendJson(res, 200, await generateCanvasScript(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/plan-storyboards") {
    return sendJson(res, 200, await planCanvasStoryboards(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/generate-storyboards") {
    return sendJson(res, 200, await generateCanvasStoryboards(body));
  }
  if (req.method === "POST" && url.pathname === "/api/canvas/revise-node") {
    return sendJson(res, 200, await reviseCanvasNode(body));
  }
  if (req.method === "POST" && url.pathname === "/api/chat") {
    return sendJson(res, 200, await chatWithAssistant(body));
  }
  if (req.method === "POST" && url.pathname === "/api/config") {
    const [deepseek, appSettings] = await Promise.all([
      writeDeepSeekConfig(body),
      writeAppSettings(body),
    ]);
    return sendJson(res, 200, { ...deepseek, ...appSettings });
  }
  if (req.method === "POST" && url.pathname === "/api/feedback") {
    return sendJson(res, 200, await addFeedback(body));
  }
  if (req.method === "POST" && url.pathname === "/api/rerun") {
    return sendJson(res, 200, await rerunFromRun(body));
  }
  if (req.method === "POST" && url.pathname === "/api/deepseek-test") {
    const result = await deepseekChat({
      apiKey: body.apiKey,
      provider: body.provider,
      baseUrl: body.baseUrl,
      model: body.model,
      temperature: 0,
      messages: [
        { role: "system", content: "你只回答：连接成功。" },
        { role: "user", content: "测试连接" },
      ],
    });
    return sendJson(res, 200, result);
  }
  if (req.method === "POST" && url.pathname === "/api/generate") {
    return sendJson(res, 200, await generateWithDeepSeek(body));
  }
  if (req.method === "POST" && url.pathname === "/api/archive-learning") {
    return sendJson(res, 200, await archiveLearningManually(body));
  }
  if (req.method === "POST" && url.pathname === "/api/learning-cycle") {
    return sendJson(res, 200, await runLearningCycle());
  }
  if (req.method === "POST" && url.pathname === "/api/notifications/handle") {
    const notification = await handleNotification(BUSINESS_ROOT, body.id);
    return sendJson(res, 200, { notification, notifications: await listNotifications(BUSINESS_ROOT) });
  }
  sendJson(res, 404, { error: "接口不存在" });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const target = path.resolve(PUBLIC_DIR, "." + pathname);
  if (!target.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return sendText(res, 404, "Not Found");
  }
  const ext = path.extname(target);
  sendText(res, 200, await fsp.readFile(target), MIME[ext] || "application/octet-stream");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`M7 local web is running at http://127.0.0.1:${PORT}`);
});
