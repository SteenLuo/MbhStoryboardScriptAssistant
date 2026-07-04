const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const { listLearningEvents, readCurrentRuleset } = require("./autonomousLearning");
const { mapLearningDisplayRecord } = require("./learningStatusMapper");
const { FALLBACK_ROUTE, SKILL_ROUTES } = require("./localSkills");

async function buildLearningLibrary(root) {
  const [events, ruleset, evidenceRecords, sampleRecords] = await Promise.all([
    listLearningEvents(root, { includeCovered: true }),
    readCurrentRuleset(root),
    readMaterialRecords(path.join(root, "learning", "evidence"), "evidenceId"),
    readMaterialRecords(path.join(root, "learning", "samples"), "sampleId"),
  ]);
  return {
    records: [
      ...events.map(publicLearningRecord),
      ...evidenceRecords.map(publicEvidenceRecord),
      ...sampleRecords.map(publicSampleRecord),
    ]
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))),
    currentRules: (ruleset.rules || []).map(publicRule),
    skills: skillRoutes(root).map((route) => publicSkill(root, route)),
  };
}

function publicLearningRecord(event) {
  const displayRecord = mapLearningDisplayRecord(event);
  return {
    ...displayRecord,
    status: displayRecord.displayStatus,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function publicEvidenceRecord(evidence) {
  const evidenceId = normalizeString(evidence.evidenceId);
  const canvasId = normalizeString(evidence.canvasId || evidence.location?.canvasId);
  const outputId = normalizeString(evidence.outputId || evidence.location?.outputId);
  const createdAt = normalizeString(evidence.createdAt || evidence.archivedAt);
  return savedMaterialRecord({
    recordId: `evidence:${evidenceId}`,
    learnedText: normalizeString(evidence.summary) || `画布归档证据：${canvasId || evidenceId}`,
    sourceText: canvasId ? `归档：${canvasId}` : "归档",
    usedWhereText: "学习资料库：证据包",
    nextStepText: "无需处理，可在需要时作为资料回看。",
    createdAt,
    updatedAt: normalizeString(evidence.updatedAt || evidence.archivedAt || createdAt),
    advanced: {
      ...evidence,
      evidenceId,
      canvasId,
      outputId,
      sourceEventIds: normalizeStringArray(evidence.sourceEventIds),
    },
  });
}

function publicSampleRecord(sample) {
  const sampleId = normalizeString(sample.sampleId);
  const canvasId = normalizeString(sample.canvasId || sample.location?.canvasId);
  const createdAt = normalizeString(sample.createdAt);
  return savedMaterialRecord({
    recordId: `sample:${sampleId}`,
    learnedText: normalizeString(sample.summary || sample.content) || `学习样例：${sampleId}`,
    sourceText: canvasId ? `样例：${canvasId}` : "样例",
    usedWhereText: "学习资料库：样例",
    nextStepText: "无需处理，可在需要时作为资料回看。",
    createdAt,
    updatedAt: normalizeString(sample.updatedAt || createdAt),
    advanced: {
      ...sample,
      sampleId,
      canvasId,
      outputId: normalizeString(sample.outputId || sample.location?.outputId),
      sourceEventIds: normalizeStringArray(sample.sourceEventIds),
    },
  });
}

function savedMaterialRecord(input) {
  return {
    recordId: input.recordId,
    displayStatus: "已保存",
    status: "已保存",
    actionLabel: "不用管",
    affectsGeneration: false,
    generationImpactText: "已保存为学习资料，不会直接改变生成。",
    learnedText: input.learnedText,
    sourceText: input.sourceText,
    usedWhereText: input.usedWhereText,
    nextStepText: input.nextStepText,
    generationProof: {
      proofStatus: "not_applicable",
      claimText: "这个学习资料没有进入生成落点，不需要生成命中证据。",
    },
    advanced: input.advanced,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
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

async function readMaterialRecords(dir, idField) {
  if (!fs.existsSync(dir)) return [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") continue;
    try {
      const parsed = JSON.parse(await fsp.readFile(path.join(dir, entry.name), "utf8"));
      if (isValidMaterialRecord(parsed, idField)) records.push(parsed);
    } catch {
      continue;
    }
  }
  return records;
}

function isValidMaterialRecord(record, idField) {
  return Boolean(
    record &&
    typeof record === "object" &&
    !Array.isArray(record) &&
    normalizeString(record[idField]),
  );
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

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : [];
}

module.exports = {
  buildLearningLibrary,
};
