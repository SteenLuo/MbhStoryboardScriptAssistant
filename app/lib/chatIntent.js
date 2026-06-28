const EXPLICIT_INTENTS = new Set(["chat", "inspiration", "script", "script_analysis", "storyboard", "storyboard_analysis", "learning"]);

function classifyChatIntent({ message = "", attachments = [], intent = "" } = {}) {
  const explicit = String(intent || "").toLowerCase();
  if (EXPLICIT_INTENTS.has(explicit)) {
    return intentToRoute(explicit, "explicit");
  }

  const text = String(message || "").trim();
  const normalized = text.toLowerCase();
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (isLearningRequest(normalized)) return intentToRoute("learning", "learning-signal");
  if (isStoryboardAnalysisRequest(normalized)) return intentToRoute("storyboard_analysis", "storyboard-analysis");
  if (isScriptAnalysisRequest(normalized)) return intentToRoute("script_analysis", "script-analysis");
  if (isStoryboardGenerationRequest(normalized)) return intentToRoute("storyboard", "storyboard-generation");
  if (isScriptGenerationRequest(normalized)) return intentToRoute("script", "script-generation");
  if (hasAttachments && isUploadOnlyMaterialRequest(normalized)) return intentToRoute("script_analysis", "attachment-analysis");
  if (hasAttachments && isMaterialProcessingRequest(normalized)) return intentToRoute("script", "attachment-processing");
  if (isInspirationRequest(normalized)) return intentToRoute("inspiration", "story-inspiration");
  if (isProjectDomainRequest(normalized)) return intentToRoute("script_analysis", "domain-material");

  return intentToRoute("chat", "light-chat");
}

function intentToRoute(intent, reason) {
  if (intent === "script" || intent === "script_analysis" || intent === "storyboard" || intent === "storyboard_analysis" || intent === "inspiration" || intent === "learning") {
    return { intent, mode: "skill", reason };
  }
  return { intent, mode: "light", reason };
}

function isLearningRequest(text) {
  return /以后|默认|必须|一定要|记住|偏好|学习|样例|质量下降|变差|回退|无感|skill|技能|from now on|remember|always|preference|learning/.test(text);
}

function isStoryboardGenerationRequest(text) {
  return /(生成|输出|制作|转成|拆成|拆|写|做|generate|create|make).{0,12}(分镜|镜头|storyboard)|((分镜|镜头|storyboard).{0,12}(生成|输出|制作|拆|generate|create|make))/.test(text);
}

function isScriptGenerationRequest(text) {
  return /(生成|输出|写|改编|转成|制作|generate|create|write|make).{0,12}(剧本|script)|((小说|原文|章节|正文|novel|chapter).{0,12}(生成|改编|转成|generate|create|write).{0,8}(剧本|script))/.test(text);
}

function isScriptAnalysisRequest(text) {
  return /(剧本|剧情|情节|对白|角色|人物|爽点|高潮点|伏笔).{0,24}(分析|评审|检查|诊断|判断|修改建议|建议|优化|问题|漏洞|冲突|合理性|爽点|高潮|节奏|拖沓|逻辑|伏笔|人设)|((分析|评审|检查|诊断|判断|修改建议|建议|优化|问题|漏洞|冲突|合理性|爽点|高潮|节奏|拖沓|逻辑|伏笔|人设).{0,24}(剧本|剧情|情节|对白|角色|人物|爽点|高潮点|伏笔))/.test(text);
}

function isStoryboardAnalysisRequest(text) {
  return /(分镜|镜头|运镜|构图|景别|画面|视角|storyboard).{0,24}(分析|评审|检查|诊断|判断|修改建议|建议|优化|问题|漏洞|规则|标准|节奏|连贯|穿帮)|((分析|评审|检查|诊断|判断|修改建议|建议|优化|问题|漏洞|规则|标准|节奏|连贯|穿帮).{0,24}(分镜|镜头|运镜|构图|景别|画面|视角|storyboard))/.test(text);
}

function isMaterialProcessingRequest(text) {
  return /生成|输出|改编|整理|分析|分镜|剧本|学习|样例/.test(text);
}

function isUploadOnlyMaterialRequest(text) {
  return /^(已上传附件|上传附件|已上传文件|上传文件|附件|文件|已上传|uploaded attachment|uploaded file)[。.!！\s]*$/.test(text);
}

function isInspirationRequest(text) {
  return /灵感|发散|想法|方向|创意|设定|人物关系|冲突|爽点|开头|钩子|能不能|够不够|怎么样|brainstorm|idea/.test(text);
}

function isProjectDomainRequest(text) {
  return /小说|原文|章节|大纲|分集|剧本|剧情|情节|对白|角色|人物|人设|爽点|高潮|伏笔|逻辑|冲突|分镜|镜头|运镜|构图|景别|画面|视角|漫剧|ai漫剧|storyboard|script|novel/.test(text);
}

function selectHistoryForIntent(messages, intent) {
  const items = Array.isArray(messages) ? messages : [];
  if (intent?.mode === "light") {
    return items.slice(-6);
  }
  return items;
}

module.exports = {
  classifyChatIntent,
  selectHistoryForIntent,
};
