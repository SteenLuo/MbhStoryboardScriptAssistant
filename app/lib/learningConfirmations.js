const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

async function applyLearningDecision(root, { conversation, messageIndex, action }, now = () => new Date()) {
  const index = Number(messageIndex);
  const message = conversation?.messages?.[index];
  if (!message?.learningSuggestion) {
    throw new Error("找不到可确认的学习建议");
  }
  const normalized = action === "remember" ? "remembered" : "skipped";
  message.learningSuggestion.status = normalized;
  message.learningSuggestion.decidedAt = now().toISOString();

  if (normalized === "remembered") {
    const confirmedPath = await appendConfirmedPreference(root, message.learningSuggestion, now);
    await appendDecisionToRecord(root, message.learningSuggestion, "已记住");
    return {
      status: normalized,
      confirmedPreferencePath: path.relative(root, confirmedPath).replace(/\\/g, "/"),
    };
  }

  await appendDecisionToRecord(root, message.learningSuggestion, "不记");
  return { status: normalized };
}

async function appendConfirmedPreference(root, suggestion, now) {
  const outDir = path.join(root, "learning", "accepted-rules");
  await fsp.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, "web-confirmed-preferences.md");
  if (!fs.existsSync(file)) {
    await fsp.writeFile(file, "# 网页确认偏好\n\n这些偏好来自网页对话中的轻量确认卡。后续本地 skill 调用会自动读取本文件。\n\n", "utf8");
  }
  const date = dateStamp(now());
  const line = `- ${date}｜${sanitizeLine(suggestion.summary || "未命名偏好")}｜来源：${suggestion.source || "网页对话"}\n`;
  await fsp.appendFile(file, line, "utf8");
  return file;
}

async function appendDecisionToRecord(root, suggestion, decision) {
  if (!suggestion.source) return;
  const target = path.resolve(root, suggestion.source);
  const base = path.resolve(root);
  if (!target.startsWith(base) || !fs.existsSync(target)) return;
  const block = `\r\n## 六、轻量确认\r\n\r\n- 操作：${decision}\r\n- 时间：${new Date().toISOString()}\r\n`;
  await fsp.appendFile(target, block, "utf8");
}

function dateStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sanitizeLine(text) {
  return String(text || "").replace(/\s+/g, " ").replace(/\|/g, "/").trim();
}

module.exports = {
  applyLearningDecision,
};
