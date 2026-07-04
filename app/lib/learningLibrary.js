const fs = require("node:fs");
const path = require("node:path");

const { listLearningEvents, readCurrentRuleset } = require("./autonomousLearning");
const { mapLearningDisplayRecord } = require("./learningStatusMapper");
const { FALLBACK_ROUTE, SKILL_ROUTES } = require("./localSkills");

async function buildLearningLibrary(root) {
  const [events, ruleset] = await Promise.all([
    listLearningEvents(root, { includeCovered: true }),
    readCurrentRuleset(root),
  ]);
  return {
    records: events.map(publicLearningRecord)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))),
    currentRules: (ruleset.rules || []).map(publicRule),
    skills: skillRoutes(root).map((route) => publicSkill(root, route)),
  };
}

function publicLearningRecord(event) {
  const displayRecord = mapLearningDisplayRecord(event);
  return {
    ...displayRecord,
    eventId: displayRecord.recordId,
    status: displayRecord.displayStatus,
    summary: event.summary,
    rawTrigger: event.rawTrigger,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    ruleId: event.ruleId,
    coveredByEventId: event.coveredByEventId,
    error: displayRecord.displayStatus === "失败" ? event.error : null,
    sourceType: event.sourceType,
    topicKey: event.topicKey,
    tokenUsage: event.tokenUsage,
  };
}

function publicRule(rule) {
  return {
    ruleId: rule.ruleId,
    topicKey: rule.topicKey,
    capability: rule.capability,
    content: rule.content,
    priority: rule.priority,
    sourceEventIds: rule.sourceEventIds,
    status: rule.status,
    coveredByRuleId: rule.coveredByRuleId,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function skillRoutes(root) {
  const configuredRoutes = [...SKILL_ROUTES, FALLBACK_ROUTE].map((route) => ({
    ...route,
    path: normalizeSkillPath(route.path),
    configured: true,
  }));
  const configuredByPath = new Map(configuredRoutes.map((route) => [route.path, route]));
  const discoveredRoutes = discoverSkillRoutes(root);
  const discoveredPaths = new Set(discoveredRoutes.map((route) => route.path));
  const mergedRoutes = discoveredRoutes.map((route) => ({
    ...route,
    ...(configuredByPath.get(route.path) || {}),
    discovered: true,
  }));
  const missingConfiguredRoutes = configuredRoutes
    .filter((route) => !discoveredPaths.has(route.path))
    .map((route) => ({ ...route, discovered: false }));
  return [...mergedRoutes, ...missingConfiguredRoutes]
    .sort((a, b) => String(a.path).localeCompare(String(b.path), "zh-Hans-CN"));
}

function discoverSkillRoutes(root) {
  const skillsRoot = path.join(root, "skills");
  if (!fs.existsSync(skillsRoot)) return [];
  const routes = [];
  walkSkills(skillsRoot, (skillFile) => {
    const skillDir = path.dirname(skillFile);
    const relativePath = normalizeSkillPath(path.relative(root, skillDir));
    routes.push({
      id: path.basename(skillDir),
      name: "",
      path: relativePath,
      keywords: [],
      configured: false,
      discovered: true,
    });
  });
  return routes;
}

function walkSkills(dir, onSkill) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSkills(fullPath, onSkill);
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      onSkill(fullPath);
    }
  }
}

function normalizeSkillPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function publicSkill(root, route) {
  const skillFile = path.join(root, route.path, "SKILL.md");
  const exists = fs.existsSync(skillFile);
  const raw = exists ? readSkillMarkdown(skillFile) : "";
  const metadata = parseSkillMarkdown(raw);
  return {
    id: route.id,
    name: route.name || metadata.title || route.id,
    path: route.path,
    category: route.path.split(/[\\/]/).slice(0, 2).join("/"),
    description: metadata.description || route.keywords?.slice(0, 4).join("、") || "",
    instructions: metadata.body,
    keywordHints: route.keywords || [],
    exists,
    configured: Boolean(route.configured),
    discovered: Boolean(route.discovered),
    readonly: true,
  };
}

function readSkillMarkdown(skillFile) {
  try {
    return fs.readFileSync(skillFile, "utf8").slice(0, 12000);
  } catch {
    return "";
  }
}

function parseSkillMarkdown(raw) {
  const text = String(raw || "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = match ? match[1] : "";
  const body = match ? text.slice(match[0].length).trim() : text.trim();
  const descriptionLine = frontmatter
    .split(/\r?\n/)
    .find((line) => /^description\s*:/.test(line.trim()));
  const description = descriptionLine
    ? descriptionLine.replace(/^description\s*:\s*/, "").replace(/^["']|["']$/g, "").trim()
    : "";
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "";
  return { description, body, title };
}

module.exports = {
  buildLearningLibrary,
};
