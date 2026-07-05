const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const SKILL_ROUTES = [
  {
    id: "skill-creator",
    name: "技能创建",
    path: "skills/05-evolution/skill-creator",
    keywords: [
      "skill creator",
      "skill-creator",
      "创建 skill",
      "创建skill",
      "创建技能",
      "生成 skill",
      "生成skill",
      "生成技能",
      "修改 skill",
      "修改skill",
      "修改技能",
      "更新 skill",
      "更新skill",
      "更新技能",
      "改 skill",
      "改skill",
      "改技能",
      "改进技能",
      "优化规则",
      "补进技能",
      "规则补进技能",
      "这个规则补进技能里",
      "质量下降",
      "学习后质量下降",
      "回退技能",
      "技能进化",
      "SKILL.md",
      "references",
      "scripts",
      "assets",
      "技能学习",
      "技能沉淀",
      "沉淀到技能",
    ],
  },
  {
    id: "sample-ingest",
    name: "样例学习",
    path: "skills/04-learning/sample-ingest",
    keywords: ["样例", "学习", "入库", "投喂", "参考样本", "历史剧本", "历史分镜", "规则提炼"],
  },
  {
    id: "storyboard-generate",
    name: "分镜生成",
    path: "skills/03-storyboard/storyboard-generate",
    keywords: ["分镜", "镜头", "拆镜", "镜号", "storyboard", "运镜", "景别", "构图", "画面", "视角", "正反打", "特写", "穿帮"],
  },
  {
    id: "script-hard-issue-review",
    name: "剧本评审",
    path: "skills/02-script/script-hard-issue-review",
    keywords: ["剧本评审", "硬伤", "硬伤评审", "逻辑漏洞", "问题清单", "返修意见", "全量硬伤", "语言表达质量", "画面可呈现性"],
  },
  {
    id: "script-manju-adaptation-analysis",
    name: "漫剧适配分析",
    path: "skills/02-script/script-manju-adaptation-analysis",
    keywords: ["漫剧适配", "适配分析", "立项分析", "是否适合做漫剧", "是否值得立项", "市场适配", "受众适配", "AIGC制作", "制作可控", "改编策略"],
  },
  {
    id: "script-review-rewrite",
    name: "剧本评审和改写",
    path: "skills/02-script/script-review-rewrite",
    keywords: ["评审", "改写", "修改剧本", "优化剧本", "剧本质量", "可分镜性", "重写", "剧本分析", "剧情分析", "剧情", "情节", "对白", "角色", "人物", "人设", "爽点", "高潮点", "伏笔", "节奏", "拖沓", "剧情问题", "修改建议", "逻辑不通", "剧情冲突", "冲突方向", "人物关系", "开头", "钩子"],
  },
  {
    id: "novel-intake",
    name: "输入整理",
    path: "skills/01-input-analysis/novel-intake",
    keywords: ["小说", "原文", "章节", "大纲", "输入整理", "负面分析", "剧情梳理"],
  },
  {
    id: "script-generate",
    name: "剧本生成",
    path: "skills/02-script/script-generate",
    keywords: ["生成剧本", "写剧本", "改编成剧本", "剧本生成", "分场剧本"],
  },
];

const FALLBACK_ROUTE = {
  id: "mbh-workflow",
  name: "总控路由",
  path: "skills/00-orchestrator/mbh-workflow",
  keywords: [],
};

function routeLocalSkill(text) {
  const input = String(text || "").toLowerCase();
  const skillCreatorRoute = SKILL_ROUTES.find((route) => route.id === "skill-creator");
  if (skillCreatorRoute && isSkillCreatorRequest(input)) {
    return { ...skillCreatorRoute };
  }
  for (const route of SKILL_ROUTES) {
    if (route.keywords.some((keyword) => input.includes(keyword.toLowerCase()))) {
      return { ...route };
    }
  }
  return { ...FALLBACK_ROUTE };
}

function isSkillCreatorRequest(input) {
  const text = String(input || "");
  const mentionsSkillFile = /skill\.md|references\/|scripts\/|assets\//i.test(text);
  const mentionsSkill = /\bskill\b|技能创建器|技能学习|技能沉淀|正式技能|技能进化|改技能|改进技能|创建技能|修改技能|更新技能|补进技能/.test(text);
  const asksSkillAction = /创建|生成|修改|更新|改|重构|沉淀|学习|验证|校验|优化|补进|回退/.test(text);
  return (mentionsSkill || mentionsSkillFile) && asksSkillAction;
}

function findLocalSkillRoute(id) {
  const value = String(id || "").trim();
  if (!value) return null;
  const route = SKILL_ROUTES.find((item) => item.id === value);
  return route ? { ...route } : null;
}

async function loadLocalSkillContext(root, route, options = {}) {
  const selected = route || FALLBACK_ROUTE;
  const limitPerFile = Number(options.limitPerFile || 12000);
  const skillDir = safeResolve(root, selected.path);
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    throw new Error(`找不到本地技能：${selected.path}/SKILL.md`);
  }

  const sections = [];
  const files = [];
  await addFileSection(sections, files, root, skillFile, "主技能", limitPerFile);

  const referencesDir = path.join(skillDir, "references");
  if (fs.existsSync(referencesDir)) {
    const entries = await fsp.readdir(referencesDir, { withFileTypes: true });
    const mdFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => path.join(referencesDir, entry.name))
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    for (const file of mdFiles) {
      await addFileSection(sections, files, root, file, "参考规则", limitPerFile);
    }
  }

  return {
    id: selected.id,
    name: selected.name,
    path: selected.path,
    files,
    prompt: [
      `【本轮本地技能】${selected.name}（${selected.id}）`,
      "以下内容来自本项目本地 skills 目录。你必须优先遵守这些技能说明；如果与普通聊天习惯冲突，以本地技能为准。",
      sections.join("\n\n"),
    ].join("\n\n"),
  };
}

async function addFileSection(sections, files, root, file, title, limitPerFile) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  const text = await fsp.readFile(file, "utf8");
  files.push(relative);
  sections.push(`## ${title}：${relative}\n\n${text.slice(0, limitPerFile)}`);
}

function safeResolve(root, relativePath) {
  const base = path.resolve(root);
  const target = path.resolve(base, relativePath);
  if (!target.startsWith(base)) {
    throw new Error("本地技能路径不合法");
  }
  return target;
}

module.exports = {
  FALLBACK_ROUTE,
  SKILL_ROUTES,
  findLocalSkillRoute,
  loadLocalSkillContext,
  routeLocalSkill,
};
