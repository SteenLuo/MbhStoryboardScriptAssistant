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
const { appendLearningEvent } = require("./lib/autonomousLearning");
const {
  CHANGE_SUMMARY_BEGIN,
  CHANGE_SUMMARY_END,
  readTargetSkillMarkdown,
  UPDATED_SKILL_BEGIN,
  UPDATED_SKILL_END,
  VALIDATION_NOTES_BEGIN,
  VALIDATION_NOTES_END,
  writeSkillCreatorUpdatedSkill,
} = require("./lib/skillCreatorLearning");
const { recordArchiveLearningEvidence } = require("./lib/learningEvidence");
const { analyzeCanvasArchiveReadiness } = require("./lib/canvasArchive");
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

function readReleaseVersion() {
  const versionFile = path.join(ROOT, "VERSION.txt");
  if (!fs.existsSync(versionFile)) return "";
  return stripBom(fs.readFileSync(versionFile, "utf8")).trim().replace(/^v/i, "");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function errorResponse(error) {
  const payload = { error: error.message || String(error) };
  if (error.code) payload.code = error.code;
  if (error.details && typeof error.details === "object") payload.details = error.details;
  return payload;
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

function sendStatic(res, status, body, contentType = "application/octet-stream") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.end(body);
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
    const storyboardValidationOptions = options.storyboardValidationOptions || await currentStoryboardValidationOptions();
    normalized = normalizeCanvas(applyCanvasStoryboardValidation(normalized, storyboardValidationOptions));
  }
  await fsp.writeFile(file, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

async function getCanvas(id) {
  if (!id) return saveCanvas(createCanvas("新画布"));
  const file = await canvasFile(id);
  if (!fs.existsSync(file)) throw new Error("找不到画布");
  const storyboardValidationOptions = await currentStoryboardValidationOptions();
  return normalizeCanvas(applyCanvasStoryboardValidation(await readJsonFile(file), storyboardValidationOptions));
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

async function buildCanvasArchiveCheck(canvas) {
  const storyboardValidationOptions = await currentStoryboardValidationOptions();
  const readiness = analyzeCanvasArchiveReadiness(canvas);
  const storyboardIssues = [];
  for (const node of canvas.nodes || []) {
    if (node.type !== "storyboard") continue;
    if (isStoryboardValidationResolved(node)) continue;
    const hardRuleResult = applyStoryboardHardRuleValidation(node.content, storyboardValidationOptions);
    const validation = hardRuleResult.validation || validateStoryboardContent(node.content, { checkDialogueLength: false });
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
  const archiveCheck = await buildCanvasArchiveCheck(canvas);
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
  const skillCreatorRoute = findLocalSkillRoute("skill-creator");
  const skillRoute = chatIntent.mode === "skill"
    ? explicitLearningMode
      ? skillCreatorRoute || routeLocalSkill("创建技能 修改技能 skill-creator")
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
  // Keep the user's sent message durable before any long model or workflow call starts.
  await saveConversation(conversation);

  const workflowIntent = normalizeWorkflowIntent(body.workflowIntent);
  if (explicitLearningMode) {
    const learningResult = await handleLearningCompose({
      conversation,
      userMessage,
      chatIntent,
      skillRoute,
      provider: body.provider,
      model: body.model,
    });
    conversation.messages.push(learningResult.assistantMessage);
    await saveConversation(conversation);

    return {
      id: conversation.id,
      title: conversation.title,
      runName: conversation.runName,
      content: learningResult.assistantMessage.content,
      messages: conversation.messages,
      usage: learningResult.assistantMessage.usage || null,
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
          skillRulesUsed: skillContext.skillRulesUsed || [],
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

async function handleLearningCompose({ conversation, userMessage, chatIntent, skillRoute, provider, model }) {
  const learningInput = extractExplicitRuleLearningInput({
    conversation,
    userMessage,
    assistantMessage: {
      skillRoute: skillRoute || findLocalSkillRoute("skill-creator"),
    },
  }) || {
    rawTrigger: String(userMessage?.content || ""),
    summary: String(userMessage?.content || "").slice(0, 240),
    capability: inferCapabilityForSkillCreatorTask(String(userMessage?.content || "")),
    sourceType: "conversation",
    sourceEventIds: [],
    landingIds: [],
    outputId: "",
    projectId: String(conversation?.projectId || ""),
    canvasId: String(conversation?.canvasId || userMessage?.canvasId || ""),
    conversationId: String(conversation?.id || ""),
    learningMode: "overall",
    tokenUsage: null,
  };
  const targetSkillId = inferTargetSkillIdForLearning(learningInput);
  const targetRoute = findLocalSkillRoute(targetSkillId) || findLocalSkillRoute("skill-creator");
  const skillContext = await loadLocalSkillContext(BUSINESS_ROOT, targetRoute);
  const skillCreatorRoute = findLocalSkillRoute("skill-creator") || routeLocalSkill("创建技能 修改技能 skill-creator");
  const skillCreatorContext = await loadLocalSkillContext(BUSINESS_ROOT, skillCreatorRoute);
  const targetSkill = await readTargetSkillMarkdown(BUSINESS_ROOT, targetSkillId);
  const appSettings = await readAppSettings();
  const now = new Date().toISOString();
  const eventId = `skill-creator-learning-${conversationId()}`;

  const result = await deepseekChat({
    provider,
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: buildChatSystemPrompt(appSettings.appName) },
      { role: "system", content: skillCreatorContext.prompt },
      { role: "system", content: buildSkillCreatorApplySystemPrompt() },
      {
        role: "user",
        content: buildSkillCreatorApplyUserPrompt({
          learningInput,
          targetSkillId,
          targetSkill,
        }),
      },
    ],
  });

  const skillUpdate = await writeSkillCreatorUpdatedSkill(BUSINESS_ROOT, {
    ...learningInput,
    eventId,
    learningId: eventId,
    skillId: targetSkillId,
    creatorOutput: result.content,
    createdAt: now,
  });

  const assistantMessage = buildAssistantMessage({
    content: "",
    model: result.model,
    usage: result.usage,
    chatIntent,
    skillRoute: {
      id: skillContext.id,
      name: skillContext.name,
      path: skillContext.path,
      files: Array.from(new Set([skillUpdate.relativePath, ...(skillContext.files || [])])),
      skillRulesUsed: skillContext.skillRulesUsed || [],
    },
  });

  try {
    const learningEvent = await appendLearningEvent(BUSINESS_ROOT, {
      ...learningInput,
      eventId,
      internalStatus: "validated",
      jobStatus: "completed",
      landingType: "formal-skill",
      landingIds: [skillUpdate.relativePath],
      skillId: targetSkillId,
      generationProof: {
        proofStatus: "pending_first_hit",
        claimText: "已由 skill-creator 修改正式 SKILL.md；后续对应生成会读取，命中效果需要看下一次输出校验。",
        skillRulesUsedRefs: [skillUpdate.relativePath],
      },
      createdAt: now,
      updatedAt: now,
    });
    assistantMessage.learningEvent = learningEvent.eventId;
    assistantMessage.learningEventStatus = "已影响生成";
    assistantMessage.skillReferencePath = skillUpdate.relativePath;
  } catch (error) {
    assistantMessage.learningError = error.message || String(error);
  }

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

  const lines = ["已通过 skill-creator 修改正式技能。"];
  lines.push(`目标技能：${skillContext.name}（${targetSkillId}）`);
  lines.push(`已修改文件：${skillUpdate.relativePath}`);
  lines.push(`修改摘要：${skillUpdate.changeSummary}`);
  lines.push(`校验说明：${skillUpdate.validationNotes}`);
  lines.push("影响生成：下一次对应生成会读取更新后的正式 skill。");
  lines.push("状态：学习资料库会显示为“已影响生成”。");
  if (assistantMessage.learningRecord) {
    lines.push(`学习记录：${assistantMessage.learningRecord}`);
  }
  if (assistantMessage.learningError) {
    lines.push(`学习记录异常：${assistantMessage.learningError}`);
  }
  lines.push("如果这条学错了，可以从学习资料库点“带引用去纠正”来覆盖、停用或收窄。");
  assistantMessage.content = lines.join("\n");
  return { assistantMessage };
}

function buildSkillCreatorApplySystemPrompt() {
  return [
    "你正在作为 skill-creator 修改一个已存在的正式 skill。",
    "铁律：所有 skill 的创建和修改都必须由 skill-creator 产出修改结果；不得把用户原话整段粘贴到 SKILL.md。",
    "本次不是审批任务，也不是生成待办草案。用户已经主动点击“技能学习”，所以你需要直接产出可写入目标 skill 的完整新版 SKILL.md。",
    "请把用户学习材料提炼成可复用、可执行、不会污染其他能力边界的技能说明，合并到目标 SKILL.md 的合适位置。",
    "必须保留原 frontmatter.name；必须保留或改进 frontmatter.description；不要新增 README、CHANGELOG 或其它辅助说明文件。",
    "只按指定分隔标记输出，不要输出额外解释，不要包裹 ```。",
    `输出格式必须是：${UPDATED_SKILL_BEGIN}、完整新版 SKILL.md、${UPDATED_SKILL_END}、${CHANGE_SUMMARY_BEGIN}、修改摘要、${CHANGE_SUMMARY_END}、${VALIDATION_NOTES_BEGIN}、校验说明、${VALIDATION_NOTES_END}。`,
  ].join("\n");
}

function buildSkillCreatorApplyUserPrompt({ learningInput = {}, targetSkillId, targetSkill }) {
  const learningText = String(learningInput.rawTrigger || learningInput.summary || "").trim();
  return [
    `目标 skill id：${targetSkillId}`,
    `目标文件：${targetSkill.relativePath}`,
    "",
    "用户通过“技能学习”提交的材料：",
    "<<<USER_LEARNING_MATERIAL_BEGIN",
    learningText || "未填写学习内容",
    "USER_LEARNING_MATERIAL_END>>>",
    "",
    "当前 SKILL.md：",
    "<<<CURRENT_SKILL_MD_BEGIN",
    targetSkill.markdown,
    "CURRENT_SKILL_MD_END>>>",
    "",
    "输出要求：",
    `- 在 ${UPDATED_SKILL_BEGIN} 和 ${UPDATED_SKILL_END} 之间返回完整新版 SKILL.md，不要只返回 diff。`,
    `- 在 ${CHANGE_SUMMARY_BEGIN} 和 ${CHANGE_SUMMARY_END} 之间返回一句修改摘要。`,
    `- 在 ${VALIDATION_NOTES_BEGIN} 和 ${VALIDATION_NOTES_END} 之间返回一句校验说明。`,
    "- 不要创建“技能学习沉淀”“用户学习规则（自动写入）”等追加区块。",
    "- 不要把用户原文原封不动塞进去；要用 skill-creator 的判断整合成清晰规则。",
    "- 如果用户材料与目标 skill 的边界冲突，优先用收窄表述合并，避免破坏原技能格式。",
  ].join("\n");
}

async function applyAutonomousConversationLearning({ conversation, userMessage, assistantMessage }) {
  const learningInput = extractExplicitRuleLearningInput({
    conversation,
    userMessage,
    assistantMessage,
  });
  if (!learningInput) return null;
  const targetSkillId = inferTargetSkillIdForLearning(learningInput);
  const now = new Date().toISOString();
  const event = await appendLearningEvent(BUSINESS_ROOT, {
    ...learningInput,
    eventId: `skill-learn-${conversationId()}`,
    topicKey: inferSkillLearningTopicKey(learningInput),
    conflictKey: inferSkillLearningConflictKey(learningInput),
    internalStatus: "landed",
    jobStatus: "completed",
    landingType: "skill-draft",
    landingIds: [],
    skillId: targetSkillId,
    generationProof: {
      proofStatus: "not_applicable",
      claimText: "已保存为 skill-creator 候选任务；未修改和验证正式技能前不会影响生成。",
    },
    createdAt: now,
    updatedAt: now,
  });
  assistantMessage.learningEvent = event.eventId;
  assistantMessage.learningEventStatus = "已保存";
  return { event };
}

function inferTargetSkillIdForLearning(learningInput = {}) {
  const capability = String(learningInput.capability || "");
  if (capability === "storyboard") return "storyboard-generate";
  if (capability === "script") return "script-generate";
  if (capability === "novel") return "novel-intake";
  return "skill-creator";
}

function inferCapabilityForSkillCreatorTask(text) {
  const raw = String(text || "");
  if (/分镜|镜头|镜号|拆镜|storyboard/i.test(raw)) return "storyboard";
  if (/剧本|script/i.test(raw)) return "script";
  if (/小说|原文|章节|novel/i.test(raw)) return "novel";
  return "general";
}

function inferSkillLearningTopicKey(learningInput) {
  const text = `${learningInput?.summary || ""}\n${learningInput?.rawTrigger || ""}`;
  if (String(learningInput?.capability || "") === "storyboard") {
    if (/镜号/.test(text) && /台词/.test(text) && /一行|多行|第二行/.test(text)) return "storyboard.dialogue.line-count";
    if (/台词|对白/.test(text) && /20|二十|字|长度|超过|超出/.test(text)) return "storyboard.dialogue.length";
    return "storyboard.general";
  }
  return String(learningInput?.capability || "general") || "general";
}

function inferSkillLearningConflictKey(learningInput) {
  const topicKey = inferSkillLearningTopicKey(learningInput);
  if (topicKey === "storyboard.dialogue.line-count") return "storyboard.dialogue.line-count.single-line";
  if (topicKey === "storyboard.dialogue.length") return "storyboard.dialogue.length.max-chars";
  return topicKey;
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
      useStableSkillRules: hasStoryboardDialogueHardRules(skillPrompt),
    });
    hardRuleValidation = hardRuleResult.hardRuleValidation;
    finalContent = hardRuleResult.content;
  }
  const output = `# ${config.title}\n\n生成时间：${new Date().toISOString()}\n\n模型：${result.model}\n\n---\n\n${finalContent}\n`;
  await fsp.writeFile(target, output, "utf8");
  await appendManifest(runDir, {
    lastGenerated: config.file,
    lastModel: result.model,
    updatedAt: new Date().toISOString(),
    ...(task === "storyboard-generate" ? {
      skillRulesUsed: hardRuleValidation?.appliedRules || [],
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
      skillRulesUsed: hardRuleValidation?.appliedRules || [],
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
    skillRulesUsed: [],
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
    "1. 字段标签使用纯文本，不要使用 Markdown 加粗、表格、项目符号或把多个字段挤在同一行。",
    "2. 每个镜号必须按文本块输出：镜号、景别、运镜、情绪/动作、音效、台词、时长；人物对白只能放在台词字段，不要写进情绪/动作。",
    "3. 景别字段必须同时承载必要的构图角度和拍摄视角，例如“景别：低角度侧面中景”“景别：正三四仰拍近景”“景别：侧面俯拍中景”；只有正面平视镜头才可只写“中景”“近景”等基础景别。",
    "4. 运动镜头占比必须控制在总镜数的 30% 到 40% 之间，且禁止连续 3 个及以上运动镜头。",
    "5. 正面平视镜头占比必须控制在总镜数的 30% 到 40% 之间。",
    "6. 只输出分镜正文，不要寒暄、解释、标题、Markdown 分隔线或“好的，收到任务”等非分镜内容。",
    `## 分镜标准文档：${standardPath}\n\n${standardText}`,
  ].join("\n\n");
  return {
    prompt,
    skillRulesUsed: [],
    enforceStableHardRules: hasStoryboardDialogueHardRules(prompt),
  };
}

const STORYBOARD_GENERATION_MAX_ATTEMPTS = 3;
const STORYBOARD_DIALOGUE_HARD_RULE_PATTERN = /每个镜号只能有一行|同一镜号下不得出现第二行|单条台词不得超过\s*20|台词超过\s*20|不得超过20|不能超过20|同一个镜号只能有一个说话人|只允许存在一个人物的台词|台词.*说话人|说话人.*台词|声音来源|人物台词必须保真|不得改写.*人物台词|禁止.*人物台词.*改动|拼回.*剧本原台词|同一说话人.*短台词|连续短台词.*合并|相邻短句.*合并|运动镜头占比|正面平视镜头占比|相同景别|相同.*构图|连续.*同构图|连续.*双人中景|连续\s*3\s*个及以上运动镜头|30%\s*到\s*40%/;

function hasStoryboardDialogueHardRules(prompt) {
  return STORYBOARD_DIALOGUE_HARD_RULE_PATTERN.test(String(prompt || ""));
}

async function currentStoryboardValidationOptions() {
  const storyboardSkillContext = await canvasStoryboardSkillContext();
  return {
    useStableSkillRules: storyboardSkillContext.enforceStableHardRules === true,
  };
}

async function generateStoryboardEpisodeWithValidation(input = {}) {
  const usages = [];
  let result = null;
  let hardRuleResult = null;
  let retryFeedback = "";

  for (let attempt = 1; attempt <= STORYBOARD_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    result = await runCanvasTask({
      task: "storyboard-generate",
      input: buildStoryboardEpisodeGenerationInput(input, retryFeedback),
      model: input.model,
      apiKey: input.apiKey,
      skillPrompt: input.skillPrompt,
    });
    usages.push(result.usage);
    hardRuleResult = applyStoryboardHardRuleValidation(result.content, {
      useStableSkillRules: input.enforceStableHardRules === true,
      sourceScript: input.episode?.content || input.sourceNode?.content || "",
    });
    if (!hardRuleResult.hardRuleValidation.checked || hardRuleResult.hardRuleValidation.finalOk) {
      return { result, hardRuleResult, usages, attempts: attempt };
    }
    retryFeedback = buildStoryboardHardRuleRetryFeedback(hardRuleResult.hardRuleValidation.finalIssues);
  }

  return {
    result,
    hardRuleResult,
    usages,
    attempts: STORYBOARD_GENERATION_MAX_ATTEMPTS,
  };
}

function buildStoryboardEpisodeGenerationInput(input = {}, retryFeedback = "") {
  const episode = input.episode || {};
  const sourceNode = input.sourceNode || {};
  const index = Number(input.index || 0);
  const title = episode.title || `第${episode.number || index + 1}集`;
  const lines = [
    `请只为以下分集生成分镜脚本：${title}`,
    "",
  ];
  if (input.enforceStableHardRules === true) {
    lines.push(
      "【已命中的分镜 skill 硬规则】",
      "1. 一个镜号只能有一个“台词”字段，不能在同一镜号内写多行台词。",
      "2. 一个镜号只允许一个说话人；多人对话必须拆成连续镜号。",
      "3. 非空台词必须在台词内容前标注说话人或声音来源，格式为“台词：说话人：原文台词”，例如“台词：陈建军：秀娥，你今天真好看。”；不能写成“台词：秀娥，你今天真好看。”。",
      "4. 任意一行台词不得超过 20 个字；超过 20 个字时必须拆成新的连续镜号，不要把长台词留在同一个镜号里。",
      "5. 按台词总字数决定拆镜数量：20-40 字拆 2 个镜号，40-60 字拆 3 个镜号，以此类推；拆完后逐条自查每行台词是否都在 20 字以内。",
      "6. 同一说话人的连续台词总字数不超过 20 字时，禁止仅为了变化景别、角度、运镜或画面描述而拆成多个分镜；相邻短句应合并到同一镜头。",
      "7. 例如“林秀娥：您言重了。”和“林秀娥：您以前也是按规矩办事。”合并后不超过 20 字，必须写在同一个镜号的台词字段中，不得拆成两个镜号。",
      "8. 人物台词必须保真：不得改写、润色、同义替换、删减、扩写或新增剧本中的人物台词；长台词拆镜只能按原文切段，所有片段按顺序拼回必须与剧本原台词完全一致。",
      "9. 运动镜头占比必须在总镜数的 30% 到 40% 之间；运镜字段不含“固定”的镜头按运动镜头计入，含“固定”的镜头按固定镜头计入。",
      "10. 禁止连续 3 个及以上运动镜头；连续两个运动镜头后，下一个镜头必须使用固定类运镜。",
      "11. 正面平视镜头占比必须在总镜数的 30% 到 40% 之间；只有基础景别且未注明构图/视角的镜头按正面平视计入。",
      "12. 禁止连续使用相同景别/角度/构图拍摄同一画面内容；“双人中景”和“正面平视双人中景”这类只差默认正面平视省略词的写法视为同构图；如果写了“维持上一镜”“继续上一镜”“接上一镜”“同一构图”“同一机位”“画面不变”，下一镜必须更换构图或景别，或合并同一画面。",
      "13. 例如连续多个“景别：双人中景”拍同一段对坐对白，且情绪/动作写“维持上一镜”“继续上一镜”“接上一镜”，必须改为反打、过肩、近景/特写、手部/物品/反应镜头，不能连续照抄双人中景。",
      "",
    );
  }
  if (retryFeedback) {
    lines.push(
      "【上一版未通过，请重新生成完整分镜】",
      "不要解释原因，不要只改局部片段；必须输出完整分镜正文。",
      retryFeedback,
      "处理原则：宁可增加连续镜号，也不能让任意一行台词超过 20 个字；按 20 字上限决定拆镜数量，拆完后逐条自查；非空台词必须写成“台词：说话人：原文台词”；同一说话人相邻短台词合并后不超过 20 字时必须合并回同一镜号；同一个镜号只能有一行台词字段；人物台词只能原文切段，不能改写；同时把运动镜头占比和正面平视镜头占比都调整到 30% 到 40%，打断连续 3 个及以上运动镜头，并修正连续相同景别/角度/构图拍同一画面的镜头。",
      "",
    );
  }
  lines.push(episode.content || sourceNode.content || "");
  return lines.join("\n");
}

function buildStoryboardHardRuleRetryFeedback(issues = []) {
  const normalized = (Array.isArray(issues) ? issues : []).slice(0, 12).map((issue, index) => {
    const lineNumber = issue.lineNumber ? `第 ${issue.lineNumber} 行` : `问题 ${index + 1}`;
    const lineText = String(issue.lineText || issue.dialogue || "").trim();
    const reason = issue.message || issue.type || "硬规则未通过";
    return `- ${lineNumber}：${reason}${lineText ? `\n  原文：${lineText}` : ""}`;
  });
  if (!normalized.length) {
    return "- 上一版存在分镜硬规则违规，请逐镜号检查台词长度、台词字段数量、说话人标注、说话人数量、同一说话人短台词是否被碎片化拆镜、运动镜头占比、连续运动镜头、正面平视镜头占比，以及是否连续相同景别/角度/构图拍同一画面。";
  }
  return [
    "上一版存在以下硬规则违规，必须在新一版中全部消除：",
    ...normalized,
  ].join("\n");
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
  const scriptContent = canvasScriptNodeContentForStoryboard(sourceNode);
  return {
    canvasId: canvas.id,
    scriptNodeId: sourceNode.id,
    episodes: splitScriptIntoEpisodes(scriptContent),
  };
}

function canvasScriptNodeContentForStoryboard(sourceNode) {
  const scriptContent = String(sourceNode?.content || "").trim();
  if (!scriptContent) {
    const error = new Error("剧本节点内容为空，无法识别分集。请先把剧本保存到该节点。");
    error.code = "CANVAS_SCRIPT_EMPTY";
    throw error;
  }
  return scriptContent;
}

async function generateCanvasStoryboards(body) {
  let canvas = await getCanvas(body.canvasId);
  const sourceNode = findCanvasNode(canvas, body.nodeId);
  if (sourceNode.type !== "script") throw new Error("只有剧本节点可以生成分镜");
  const scriptContent = canvasScriptNodeContentForStoryboard(sourceNode);
  const selectedEpisodes = Array.isArray(body.episodes) && body.episodes.length
    ? body.episodes
    : splitScriptIntoEpisodes(scriptContent);
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
    const generation = await generateStoryboardEpisodeWithValidation({
      episode,
      sourceNode,
      index,
      body,
      model: body.model,
      apiKey: body.apiKey,
      skillPrompt: storyboardSkillContext.prompt,
      enforceStableHardRules: storyboardSkillContext.enforceStableHardRules,
    });
    usages.push(...generation.usages);
    const result = generation.result;
    lastModel = result.model || lastModel;
    const titleScope = { nodes: [...(canvas.nodes || []), ...generatedNodes] };
    const hardRuleResult = generation.hardRuleResult;
    generatedNodes.push({
      ...plannedNode,
      title: uniqueCanvasNodeTitle(titleScope, plannedNode.title),
      content: hardRuleResult.content,
      meta: {
        ...plannedNode.meta,
        model: result.model,
        usage: result.usage,
        generatedAt: new Date().toISOString(),
        generationAttempts: generation.attempts,
        skillRulesUsed: hardRuleResult.hardRuleValidation.appliedRules || [],
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
  const appliedRules = Array.isArray(input.hardRuleValidation?.appliedRules)
    ? input.hardRuleValidation.appliedRules
    : [];
  const ruleRefs = appliedRules.map((rule) => rule.ruleId).filter(Boolean);
  const skillId = "storyboard-generate";
  const skillFileRef = "skills/03-storyboard/storyboard-generate/SKILL.md";
  const skillRuleFileRefs = Array.from(new Set(appliedRules
    .map((rule) => String(rule.sourceFile || "").trim())
    .filter(Boolean)
    .concat(skillFileRef)));
  const sourceEventIds = Array.from(new Set(appliedRules.flatMap((rule) =>
    Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : []
  ).map(String).filter(Boolean)));
  const firstRule = appliedRules[0] || {};
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
    skillId,
    landingIds: [skillFileRef],
    skillRulesUsedRefs: Array.from(new Set([...ruleRefs, ...skillRuleFileRefs])),
    summary: "分镜输出未按稳定分镜 skill 硬规则生成，已标识。",
    error: {
      stage: "storyboard-hard-rule-post-validation",
      code: "STORYBOARD_HARD_RULE_VALIDATION_FAILED",
      message: "生成结果仍存在硬规则违规，已保留输出并标识问题。",
      issues: input.hardRuleValidation?.finalIssues || input.hardRuleValidation?.initialIssues || [],
    },
    generationProof: {
      proofStatus: "failed",
      skillRulesUsedRefs: Array.from(new Set([...ruleRefs, ...skillRuleFileRefs])),
      validationResultRefs: [String(input.outputId || "").trim()].filter(Boolean),
      failureEventIds: [eventId],
    },
    createdAt: failedAt,
    updatedAt: failedAt,
  });
  return {
    eventId,
    skillId,
    skillFileRef,
    skillRulesUsedRefs: Array.from(new Set([...ruleRefs, ...skillRuleFileRefs])),
  };
}

function createStoryboardHardRuleError(message, hardRuleValidation, failure = {}) {
  const issues = Array.isArray(hardRuleValidation?.finalIssues)
    ? hardRuleValidation.finalIssues
    : Array.isArray(hardRuleValidation?.initialIssues)
      ? hardRuleValidation.initialIssues
      : [];
  const compactIssues = issues.slice(0, 8).map((issue) => ({
    type: String(issue.type || ""),
    hardRuleId: String(issue.hardRuleId || ""),
    severity: String(issue.severity || "error"),
    lineNumber: Number(issue.lineNumber || 0),
    message: String(issue.message || "硬规则未通过"),
    lineText: String(issue.lineText || "").trim(),
    dialogue: String(issue.dialogue || "").trim(),
    suggestedLines: Array.isArray(issue.suggestedLines)
      ? issue.suggestedLines.map((item) => String(item.text || item || "").trim()).filter(Boolean)
      : [],
  }));
  const error = new Error(appendStoryboardHardRuleSummary(message, compactIssues, issues.length));
  error.code = "STORYBOARD_HARD_RULE_VALIDATION_FAILED";
  error.details = {
    kind: "storyboard-hard-rule-validation",
    skillId: failure.skillId || "storyboard-generate",
    skillFile: failure.skillFileRef || "skills/03-storyboard/storyboard-generate/SKILL.md",
    failureEventId: failure.eventId || "",
    issueCount: issues.length,
    issues: compactIssues,
    truncated: issues.length > compactIssues.length,
  };
  return error;
}

function appendStoryboardHardRuleSummary(message, issues = [], total = 0) {
  const issueCount = Number(total || issues.length || 0);
  if (!issues.length) return message;
  const first = issues[0] || {};
  const position = first.lineNumber ? `第 ${first.lineNumber} 行` : "具体行号见学习资料库";
  const reason = first.message || "硬规则未通过";
  const lineText = first.lineText ? `：${first.lineText}` : "";
  const suggested = Array.isArray(first.suggestedLines) && first.suggestedLines.length
    ? `；建议拆为：${first.suggestedLines.slice(0, 3).join(" / ")}`
    : "";
  return `${message}（共 ${issueCount || "至少 1"} 处，${position}：${reason}${lineText}${suggested}）`;
}

function safeEventSegment(value) {
  return String(value || "output")
    .replace(/[^0-9A-Za-z_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "output";
}

function storyboardRevisionIssuesForPrompt(parentNode, storyboardValidationOptions = {}) {
  if (parentNode?.type !== "storyboard") return [];
  const hardRuleResult = applyStoryboardHardRuleValidation(parentNode.content, storyboardValidationOptions);
  const validation = hardRuleResult.validation || validateStoryboardContent(parentNode.content, { checkDialogueLength: false });
  return validation.ok ? [] : validation.issues;
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
  const storyboardValidationOptions = {
    useStableSkillRules: storyboardSkillContext?.enforceStableHardRules === true,
  };
  const storyboardIssueContext = formatStoryboardRevisionIssues(storyboardRevisionIssuesForPrompt(parentNode, storyboardValidationOptions));
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
    ? applyStoryboardHardRuleValidation(result.content, storyboardValidationOptions)
    : null;
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
            skillRulesUsed: hardRuleResult?.hardRuleValidation?.appliedRules || item.meta?.skillRulesUsed || [],
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
      useStableSkillRules: hasStoryboardDialogueHardRules(skillPrompt),
    });
    hardRuleValidation = hardRuleResult.hardRuleValidation;
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
      skillRulesUsed: hardRuleValidation?.appliedRules || [],
      hardRuleValidation,
    } : {}),
  });
  return {
    file: config.file,
    content: finalContent,
    usage: result.usage,
    ...(body.task === "storyboard-generate" ? {
      skillRulesUsed: hardRuleValidation?.appliedRules || [],
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
    skillCreatorTasks: await countFiles("learning/skill-creator-tasks"),
  };
}

async function handleLearningCorrection(body = {}) {
  return applyLearningCorrectionRequest(BUSINESS_ROOT, body, {
    appendLearningEvent,
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
      version: readReleaseVersion(),
      rootPath: ROOT,
      businessRoot: BUSINESS_ROOT,
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
  sendStatic(res, 200, await fsp.readFile(target), MIME[ext] || "application/octet-stream");
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
    sendJson(res, 500, errorResponse(error));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`M7 local web is running at http://127.0.0.1:${PORT}`);
});
