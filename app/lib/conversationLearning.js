const fsp = require("fs/promises");
const path = require("path");

function classifyConversationLearning({ userMessage, skillRoute, conversation }) {
  const text = String(userMessage?.content || "");
  const attachmentNames = (userMessage?.attachments || []).map((item) => item.name || "").join(" ");
  const forcedLearning = userMessage?.learningMode === true;
  const repeatedSignal = forcedLearning ? null : findRepeatedLearningSignal(conversation, userMessage);
  const allText = [text, attachmentNames, repeatedSignal?.text].filter(Boolean).join("\n");
  if (!forcedLearning && !hasLearningSignal(allText) && !repeatedSignal) return null;

  const qualitySignal = /变差|下降|退步|不好|不行|翻车|回退/.test(allText)
    ? "变差"
    : /变好|更好|通过|满意|有效/.test(allText)
      ? "变好"
      : "无明显变化";
  const learningAction = qualitySignal === "变差"
    ? "降质记录"
    : !forcedLearning && /跳过|不要学习|别学/.test(allText)
      ? "跳过"
      : "学习记录";

  return {
    title: makeTitle(text || repeatedSignal?.text || attachmentNames || skillRoute?.name || "技能学习"),
    needLearning: learningAction === "跳过" ? "否" : "是",
    materialType: inferMaterialType(allText),
    accepted: "未判断",
    qualitySignal,
    learningAction,
    triggerReason: repeatedSignal ? "重复强调" : forcedLearning ? "手动学习" : "明确规则",
  };
}

async function writeConversationLearningRecord(root, { conversation, userMessage, assistantMessage }, now = () => new Date()) {
  const classification = classifyConversationLearning({
    conversation,
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
    "- 如果学习动作是[学习记录]，该内容进入学习资料库；用户主动点击技能学习且内容属于可执行生成约束时，才可能写入对应正式技能，下一次相关生成会读取。",
    "",
  ];
  await fsp.writeFile(outPath, lines.join("\r\n"), "utf8");
  return {
    path: outPath,
    relativePath: path.relative(root, outPath).replace(/\\/g, "/"),
    classification,
  };
}

function hasLearningSignal(text) {
  return /以后|默认|必须|一定要|重要|完整|缺失|记住|偏好|规则|学习|样例|质量|变差|回退|无感|skill|技能|流程|机制|白瞎|正常运行|learning|preference|from now on|remember|always|avoid|M0|M1|M2|M3|M4|M5|M6/i.test(text);
}

function findRepeatedLearningSignal(conversation, userMessage) {
  const currentText = String(userMessage?.content || "").trim();
  if (!isRepeatLearningCandidate(currentText)) return null;
  const current = normalizeRepeatText(currentText);
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  let bestMatch = "";
  let bestScore = 0;

  for (const message of messages) {
    if (message === userMessage || message?.role !== "user") continue;
    const previousText = String(message.content || "").trim();
    if (!isRepeatLearningCandidate(previousText)) continue;
    const previous = normalizeRepeatText(previousText);
    const score = repeatedLearningSimilarity(current, previous, currentText, previousText);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = previousText;
    }
  }

  if (bestScore < 0.66) return null;
  return {
    text: currentText.length >= bestMatch.length ? currentText : bestMatch,
    count: 2,
    similarity: bestScore,
  };
}

function isRepeatLearningCandidate(text) {
  const raw = String(text || "");
  return normalizeRepeatText(raw).length >= 10
    && hasLearningDomain(raw)
    && hasLearningConstraint(raw)
    && !isLearningOptOut(raw);
}

function hasLearningDomain(text) {
  return /分镜|镜头|镜号|台词|对白|景别|运镜|剧本|小说|原文|章节|评审|漫剧|画布|归档|技能|skill|规则|格式|流程|生成|拆镜|人物动机/.test(String(text || ""));
}

function hasLearningConstraint(text) {
  return /不能|不要|不允许|必须|一定要|应该|应当|需要|默认|保持|避免|超过|超出|以内|拆|拆分|统一|格式|规则|约束|优先|禁止|连续|每次|全部|完整|输出|返回/.test(String(text || ""));
}

function repeatedLearningSimilarity(leftNormalized, rightNormalized, leftRaw, rightRaw) {
  if (!leftNormalized || !rightNormalized) return 0;
  if (leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized)) return 1;
  const conceptScore = repeatedLearningConceptScore(leftRaw, rightRaw);
  const gramScore = ngramSimilarity(leftNormalized, rightNormalized);
  return Math.max(conceptScore, gramScore);
}

function repeatedLearningConceptScore(leftRaw, rightRaw) {
  const left = learningConcepts(leftRaw);
  const right = learningConcepts(rightRaw);
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((item) => right.has(item)).length;
  if (overlap >= 3) return 0.75;
  if (overlap === 2 && (left.has("limit20") && right.has("limit20"))) return 0.7;
  return overlap / Math.max(left.size, right.size);
}

function learningConcepts(text) {
  const raw = String(text || "");
  const concepts = new Set();
  if (/分镜|镜头|镜号|拆镜|storyboard/i.test(raw)) concepts.add("storyboard");
  if (/台词|对白/.test(raw)) concepts.add("dialogue");
  if (/20|二十/.test(raw)) concepts.add("limit20");
  if (/超过|超出|以内|不能/.test(raw)) concepts.add("limit");
  if (/拆|拆分|新分镜|分镜头/.test(raw)) concepts.add("split");
  if (/同一个镜号|同镜号|镜号里/.test(raw)) concepts.add("shotNumber");
  if (/景别|同景别|相同景别/.test(raw)) concepts.add("shotSize");
  if (/连续|三个|3个/.test(raw)) concepts.add("sequence");
  if (/剧本|script/i.test(raw)) concepts.add("script");
  if (/评审|审查/.test(raw)) concepts.add("review");
  if (/人物动机|动机/.test(raw)) concepts.add("motivation");
  if (/漫剧/.test(raw)) concepts.add("manju");
  if (/格式|输出|返回/.test(raw)) concepts.add("format");
  if (/技能|skill/i.test(raw)) concepts.add("skill");
  return concepts;
}

function ngramSimilarity(left, right) {
  const leftGrams = charNgrams(left);
  const rightGrams = charNgrams(right);
  if (!leftGrams.size || !rightGrams.size) return 0;
  let overlap = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) overlap += 1;
  }
  return overlap / Math.min(leftGrams.size, rightGrams.size);
}

function charNgrams(text) {
  const grams = new Set();
  const raw = String(text || "");
  for (let index = 0; index < raw.length - 1; index += 1) {
    grams.add(raw.slice(index, index + 2));
  }
  return grams;
}

function normalizeRepeatText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：:,.!?;"'“”‘’`（）()【】\[\]《》<>]/g, "");
}

function inferMaterialType(text) {
  if (/质量|变差|回退|退步/.test(text)) return "质量问题";
  if (/流程|机制|无感|默认|必须|一定要|重要|完整|缺失|skill|技能|learning|preference|from now on|remember|always|avoid|M0|M1|M2|M3|M4|M5|M6/i.test(text)) return "流程偏好";
  if (/分镜|镜头|拆镜/.test(text)) return "分镜";
  if (/剧本/.test(text)) return "剧本";
  if (/小说|原文|章节/.test(text)) return "小说";
  if (/样例|参考样本|入库|投喂/.test(text)) return "反馈";
  return "反馈";
}

function makeTitle(text) {
  return String(text || "网页对话学习").replace(/\s+/g, " ").slice(0, 28) || "网页对话学习";
}

function summarizeUserSignal(userMessage, assistantMessage) {
  const skillText = assistantMessage?.skillRoute
    ? `本轮命中本地技能：${assistantMessage.skillRoute.name}（${assistantMessage.skillRoute.id}）。`
    : "本轮未记录命中技能。";
  const attachmentText = attachmentSummary(userMessage?.attachments);
  return [
    "网页对话中出现可沉淀的偏好、流程要求、质量反馈或学习机制调整信号。",
    skillText,
    `用户原话摘要：${snippet(userMessage?.content || "用户上传了附件或材料。", 320)}`,
    attachmentText,
  ].join("\r\n\r\n");
}

function evidenceFor(userMessage, assistantMessage) {
  const lines = [`用户消息：${snippet(userMessage?.content || "已上传附件。", 600)}`];
  const attachments = attachmentEvidence(userMessage?.attachments);
  if (attachments) lines.push(attachments);
  if (assistantMessage?.skillRoute?.files?.length) {
    lines.push(`本轮技能文件：${assistantMessage.skillRoute.files.join("; ")}`);
  }
  return lines.join("\r\n\r\n");
}

function attachmentSummary(attachments = []) {
  const items = Array.isArray(attachments) ? attachments : [];
  if (!items.length) return "附件：无";
  return [
    "附件：",
    ...items.map((item) => `- ${item.name || "未命名附件"}${item.extracted ? "（已读取正文）" : ""}`),
  ].join("\r\n");
}

function attachmentEvidence(attachments = []) {
  const items = Array.isArray(attachments) ? attachments : [];
  if (!items.length) return "";
  const lines = ["附件证据："];
  for (const item of items) {
    lines.push(`- ${item.name || "未命名附件"}｜${item.type || "未知类型"}｜${item.extracted ? "已读取正文" : "未读取正文"}`);
    if (item.path) lines.push(`  保存位置：${item.path}`);
    if (item.text) lines.push(`  正文摘要：${snippet(item.text, 800)}`);
  }
  return lines.join("\r\n");
}

function nextActionFor(classification, assistantMessage) {
  if (classification.learningAction === "降质记录") {
    return "进入降质记录和回归评测任务，暂停把本轮输出作为正向样例。";
  }
  if (classification.learningAction === "跳过") {
    return "保留记录作为跳过依据，不进入规则沉淀。";
  }
  const skill = assistantMessage?.skillRoute?.name || "相关技能";
  return `进入学习资料库；如果本轮由用户主动点击技能学习触发且内容属于可执行生成约束，则写入对应正式技能，供 ${skill} 后续调用读取。`;
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

function extractExplicitRuleLearningInput({ conversation, userMessage, assistantMessage } = {}) {
  const text = String(userMessage?.content || "").trim();
  const forcedLearning = userMessage?.learningMode === true;
  if (!text || isLearningOptOut(text)) return null;
  const repeatedSignal = forcedLearning ? null : findRepeatedLearningSignal(conversation, userMessage);
  if (!forcedLearning && !isExplicitFastLearningRule(text) && !repeatedSignal) return null;
  const ruleText = repeatedSignal && !isExplicitFastLearningRule(text) ? repeatedSignal.text : text;
  return {
    rawTrigger: repeatedSignal ? `${text}\n重复强调依据：${repeatedSignal.text}` : text,
    summary: summarizeExplicitRule(ruleText),
    capability: inferCapabilityForExplicitRule(`${ruleText}\n${text}`, assistantMessage?.skillRoute),
    sourceType: "conversation",
    sourceEventIds: [],
    landingIds: [],
    outputId: String(assistantMessage?.outputId || assistantMessage?.id || ""),
    projectId: String(conversation?.projectId || ""),
    canvasId: String(conversation?.canvasId || userMessage?.canvasId || ""),
    conversationId: String(conversation?.id || ""),
    learningMode: "overall",
    tokenUsage: assistantMessage?.usage || null,
  };
}

function isExplicitFastLearningRule(text) {
  if (!text) return false;
  if (isLearningOptOut(text)) return false;
  return /以后|往后|后续|默认|必须|一定要|记住|from now on|always|remember/i.test(text);
}

function isLearningOptOut(text) {
  return /不要学习|别学|跳过|不要记|不记|do not learn|ignore/i.test(String(text || ""));
}

function summarizeExplicitRule(text) {
  return String(text || "")
    .replace(/^\s*(请)?(你)?(帮我)?(记住|学习一下|以后|往后|后续|默认|必须|一定要)[，,:：\s]*/i, "")
    .trim()
    .slice(0, 240);
}

function inferCapabilityForExplicitRule(text, skillRoute = {}) {
  const id = String(skillRoute?.id || "").toLowerCase();
  const raw = String(text || "").toLowerCase();
  if (id.includes("storyboard") || /分镜|镜头|镜号|拆镜|storyboard/.test(raw)) return "storyboard";
  if (id.includes("script") || /剧本|script/.test(raw)) return "script";
  if (id.includes("novel") || /小说|原文|章节/.test(raw)) return "novel";
  return "general";
}

module.exports = {
  classifyConversationLearning,
  extractExplicitRuleLearningInput,
  writeConversationLearningRecord,
};
