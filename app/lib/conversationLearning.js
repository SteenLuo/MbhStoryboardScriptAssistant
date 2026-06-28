const fsp = require("fs/promises");
const path = require("path");

function classifyConversationLearning({ userMessage, skillRoute }) {
  const text = String(userMessage?.content || "");
  const attachmentNames = (userMessage?.attachments || []).map((item) => item.name || "").join(" ");
  const allText = `${text}\n${attachmentNames}`;
  if (!hasLearningSignal(allText)) return null;

  const qualitySignal = /变差|下降|退步|不好|不行|翻车|回退/.test(allText)
    ? "变差"
    : /变好|更好|通过|满意|有效/.test(allText)
      ? "变好"
      : "无明显变化";
  const learningAction = qualitySignal === "变差"
    ? "降质记录"
    : /跳过|不要学习|别学/.test(allText)
      ? "跳过"
      : "候选规则";

  return {
    title: makeTitle(text || attachmentNames || skillRoute?.name || "网页对话学习"),
    needLearning: learningAction === "跳过" ? "否" : "是",
    materialType: inferMaterialType(allText),
    accepted: "未判断",
    qualitySignal,
    learningAction,
  };
}

async function writeConversationLearningRecord(root, { conversation, userMessage, assistantMessage }, now = () => new Date()) {
  const classification = classifyConversationLearning({
    userMessage,
    skillRoute: assistantMessage?.skillRoute,
  });
  if (!classification) return null;

  const date = dateStamp(now());
  const outDir = path.join(root, "learning", "conversation-records");
  await fsp.mkdir(outDir, { recursive: true });
  const fileName = `${date}-${safeName(classification.title)}-${String(conversation.id || "chat").slice(-6)}.md`;
  const outPath = path.join(outDir, fileName);
  const relatedFiles = relatedFilesFor(conversation, assistantMessage?.skillRoute);
  const lines = [
    "# 对话学习记录",
    "",
    `生成日期：${date}`,
    "",
    "## 一、判断结论",
    "",
    "| 项目 | 内容 |",
    "| --- | --- |",
    `| 标题 | ${classification.title} |`,
    `| 是否需要学习 | ${classification.needLearning} |`,
    `| 材料类型 | ${classification.materialType} |`,
    `| 是否已采纳 | ${classification.accepted} |`,
    `| 质量信号 | ${classification.qualitySignal} |`,
    `| 学习动作 | ${classification.learningAction} |`,
    `| 关联文件 | ${relatedFiles || "无"} |`,
    "",
    "## 二、可学习内容",
    "",
    summarizeUserSignal(userMessage, assistantMessage),
    "",
    "## 三、证据",
    "",
    evidenceFor(userMessage, assistantMessage),
    "",
    "## 四、下一步",
    "",
    nextActionFor(classification, assistantMessage),
    "",
    "## 五、处理原则",
    "",
    "- 如果是否需要学习为[否]，本记录仅作为跳过依据，不进入规则升级。",
    "- 如果质量信号为[变差]，必须优先生成或关联降质和回退记录。",
    "- 如果学习动作是[候选规则]，仍需经过样例评测或用户反馈验证，不能直接写入正式 skill。",
    "",
  ];
  await fsp.writeFile(outPath, lines.join("\r\n"), "utf8");
  return {
    path: outPath,
    relativePath: path.relative(root, outPath).replace(/\\/g, "/"),
    classification,
    suggestion: {
      status: "pending",
      summary: suggestionSummary(userMessage, assistantMessage),
      source: path.relative(root, outPath).replace(/\\/g, "/"),
      title: classification.title,
    },
  };
}

function hasLearningSignal(text) {
  return /以后|默认|必须|一定要|重要|完整|缺失|记住|偏好|规则|学习|样例|质量|变差|回退|无感|skill|技能|流程|机制|白瞎|正常运行|learning|preference|from now on|remember|always|avoid|M0|M1|M2|M3|M4|M5|M6/i.test(text);
}

function inferMaterialType(text) {
  if (/质量|变差|回退|退步/.test(text)) return "质量问题";
  if (/样例|参考样本|入库|投喂/.test(text)) return "反馈";
  if (/流程|机制|无感|默认|必须|一定要|重要|完整|缺失|skill|技能|learning|preference|from now on|remember|always|avoid|M0|M1|M2|M3|M4|M5|M6/i.test(text)) return "流程偏好";
  if (/分镜|镜头|拆镜/.test(text)) return "分镜";
  if (/剧本/.test(text)) return "剧本";
  if (/小说|原文|章节/.test(text)) return "小说";
  return "反馈";
}

function makeTitle(text) {
  return String(text || "网页对话学习").replace(/\s+/g, " ").slice(0, 28) || "网页对话学习";
}

function summarizeUserSignal(userMessage, assistantMessage) {
  const skillText = assistantMessage?.skillRoute
    ? `本轮命中本地技能：${assistantMessage.skillRoute.name}（${assistantMessage.skillRoute.id}）。`
    : "本轮未记录命中技能。";
  return [
    "网页对话中出现可沉淀的偏好、流程要求、质量反馈或学习机制调整信号。",
    skillText,
    `用户原话摘要：${snippet(userMessage?.content || "用户上传了附件或材料。", 320)}`,
  ].join("\r\n\r\n");
}

function suggestionSummary(userMessage, assistantMessage) {
  const text = snippet(userMessage?.content || "用户上传了附件或材料。", 120);
  const skill = assistantMessage?.skillRoute?.name;
  if (skill) return `${text}（适用于${skill}）`;
  return text;
}

function evidenceFor(userMessage, assistantMessage) {
  const lines = [`用户消息：${snippet(userMessage?.content || "已上传附件。", 600)}`];
  if (assistantMessage?.skillRoute?.files?.length) {
    lines.push(`本轮技能文件：${assistantMessage.skillRoute.files.join("; ")}`);
  }
  return lines.join("\r\n\r\n");
}

function nextActionFor(classification, assistantMessage) {
  if (classification.learningAction === "降质记录") {
    return "进入降质记录和回归评测任务，暂停把本轮输出作为正向样例。";
  }
  if (classification.learningAction === "跳过") {
    return "保留记录作为跳过依据，不进入候选规则。";
  }
  const skill = assistantMessage?.skillRoute?.name || "相关技能";
  return `进入对话候选规则草案，并由 ${skill} / skill-evolution 复核后再决定是否修改正式规则。`;
}

function relatedFilesFor(conversation, skillRoute) {
  const files = [];
  if (conversation?.runName) files.push(`runs/${conversation.runName}/chat.md`);
  if (skillRoute?.path) files.push(`${skillRoute.path}/SKILL.md`);
  return files.join("; ");
}

function safeName(name) {
  const cleaned = String(name || "网页对话学习").replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "网页对话学习";
}

function dateStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function snippet(text, maxLength) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}...`;
}

module.exports = {
  classifyConversationLearning,
  writeConversationLearningRecord,
};
