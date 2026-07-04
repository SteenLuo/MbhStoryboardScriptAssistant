const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const { listLearningEvents, readCurrentRuleset } = require("./autonomousLearning");
const { buildCorrectionAction } = require("./learningCorrection");
const { mapLearningDisplayRecord } = require("./learningStatusMapper");
const { FALLBACK_ROUTE, SKILL_ROUTES } = require("./localSkills");

async function buildLearningLibrary(root) {
  const accessIssues = [];
  const [events, ruleset, evidenceResult, sampleResult, evalResult] = await Promise.all([
    safeReadEvents(root, accessIssues),
    safeReadRuleset(root, accessIssues),
    readMaterialRecords(path.join(root, "learning", "evidence"), "evidenceId", "evidence", accessIssues),
    readMaterialRecords(path.join(root, "learning", "samples"), "sampleId", "samples", accessIssues),
    readEvalRecords(path.join(root, "learning", "evals"), accessIssues),
  ]);

  const eventRecords = events.map(publicLearningRecord).filter(hasUsableRecordId);
  const evidenceRecords = evidenceResult.records.map(publicEvidenceRecord).filter(hasUsableRecordId);
  const sampleRecords = sampleResult.records.map(publicSampleRecord).filter(hasUsableRecordId);
  const evalRecords = evalResult.records.map(publicEvalRecord).filter(hasUsableRecordId);
  const materialRecords = [...evidenceRecords, ...sampleRecords];
  const records = sortLearningRecords([...eventRecords, ...materialRecords, ...evalRecords]);
  const impactItems = sortLearningRecords([
    ...(ruleset.rules || []).map(publicRule).filter(hasUsableRecordId),
    ...eventRecords.filter((record) => record.affectsGeneration || record.recordId.startsWith("rule:")),
  ]);
  const sampleItems = sortLearningRecords([
    ...materialRecords,
    ...eventRecords.filter((record) => record.recordId.startsWith("sample:") || record.recordId.startsWith("evidence:")),
  ]);
  const evalItems = sortLearningRecords([
    ...evalRecords,
    ...eventRecords.filter((record) =>
      record.recordId.startsWith("eval:") ||
      record.recordId.startsWith("eval-result:") ||
      ["sample-insufficient", "eval", "eval-result"].includes(record.advanced?.landingType)
    ),
  ]);
  const skillItems = skillRoutes(root, accessIssues)
    .map((route) => publicSkill(root, route, accessIssues))
    .filter(hasUsableRecordId);

  return {
    records: records,
    impactItems: impactItems,
    sampleItems: sampleItems,
    evalItems: evalItems,
    skillItems: skillItems,
    accessIssues: accessIssues,
    currentRules: impactItems.filter((item) => item.ruleId),
    skills: skillItems,
  };
}

async function safeReadEvents(root, accessIssues) {
  try {
    return await listLearningEvents(root, { includeCovered: true });
  } catch (error) {
    accessIssues.push(accessIssue("events", error, path.join(root, "learning", "events.jsonl")));
    return [];
  }
}

async function safeReadRuleset(root, accessIssues) {
  try {
    return await readCurrentRuleset(root);
  } catch (error) {
    accessIssues.push(accessIssue("rules", error, path.join(root, "learning", "current-ruleset.json")));
    return { version: 0, lastGoodVersion: 0, updatedAt: "", rules: [] };
  }
}

function publicLearningRecord(event) {
  const displayRecord = mapLearningDisplayRecord(event);
  const record = {
    ...displayRecord,
    recordId: learningEventRecordId(event),
    status: displayRecord.status || displayRecord.displayStatus,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    advanced: {
      ...displayRecord.advanced,
      evalTaskId: normalizeString(event.evalTaskId),
      evalResultId: normalizeString(event.evalResultId),
      skillId: normalizeString(event.skillId),
    },
  };
  return {
    ...record,
    correctionAction: buildCorrectionAction(record),
  };
}

function learningEventRecordId(event = {}) {
  const landingType = normalizeString(event.landingType);
  const ruleId = normalizeString(event.ruleId || firstString(event.landingIds));
  if (landingType === "current-rule" && ruleId) return prefixedId("rule", ruleId);
  if ((landingType === "sample" || landingType === "sample-pool") && normalizeString(event.sampleId)) {
    return prefixedId("sample", event.sampleId);
  }
  if ((landingType === "evidence" || landingType === "archive") && normalizeString(event.evidenceId)) {
    return prefixedId("evidence", event.evidenceId);
  }
  if (landingType === "eval-result" || normalizeString(event.evalResultId)) {
    return prefixedId("eval-result", event.evalResultId || event.eventId);
  }
  if (landingType === "eval" || landingType === "sample-insufficient" || normalizeString(event.evalTaskId)) {
    return prefixedId("eval", event.evalTaskId || event.reevaluationTaskId || event.eventId);
  }
  if ((landingType === "formal-skill" || landingType === "callable-skill" || landingType === "skill-draft") && normalizeString(event.skillId)) {
    return prefixedId("skill", event.skillId);
  }
  return prefixedId("event", event.eventId);
}

function publicEvidenceRecord(evidence) {
  const evidenceId = normalizeString(evidence.evidenceId);
  const canvasId = normalizeString(evidence.canvasId || evidence.location?.canvasId);
  const outputId = normalizeString(evidence.outputId || evidence.location?.outputId);
  const createdAt = normalizeString(evidence.createdAt || evidence.archivedAt);
  return savedMaterialRecord({
    recordId: prefixedId("evidence", evidenceId),
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
    recordId: prefixedId("sample", sampleId),
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

function publicEvalRecord(item) {
  const evalTaskId = normalizeString(item.evalTaskId);
  const evalResultId = normalizeString(item.evalResultId);
  const isResult = Boolean(evalResultId);
  const id = isResult ? evalResultId : evalTaskId;
  return savedMaterialRecord({
    recordId: prefixedId(isResult ? "eval-result" : "eval", id),
    learnedText: normalizeString(item.summary || item.title || item.name) || `评测记录：${id}`,
    sourceText: "评测",
    usedWhereText: "学习资料库：评测",
    nextStepText: "无需处理，可在需要时作为评测资料回看。",
    createdAt: normalizeString(item.createdAt),
    updatedAt: normalizeString(item.updatedAt || item.createdAt),
    advanced: {
      ...item,
      evalTaskId,
      evalResultId,
      sourceEventIds: normalizeStringArray(item.sourceEventIds),
      relatedRecordIds: normalizeStringArray(item.relatedRecordIds),
    },
  });
}

function savedMaterialRecord(input) {
  const record = {
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
  return {
    ...record,
    correctionAction: buildCorrectionAction(record),
  };
}

function publicRule(rule) {
  return {
    recordId: prefixedId("rule", rule.ruleId),
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
    advanced: {
      topicKey: rule.topicKey,
      conflictKey: rule.conflictKey,
      sourceEventIds: normalizeStringArray(rule.sourceEventIds),
    },
  };
}

function skillRoutes(root, accessIssues) {
  const configuredRoutes = [...SKILL_ROUTES, FALLBACK_ROUTE].map((route) => ({
    ...route,
    path: normalizeSkillPath(route.path),
    configured: true,
  }));
  const configuredByPath = new Map(configuredRoutes.map((route) => [route.path, route]));
  const discoveredRoutes = discoverSkillRoutes(root, accessIssues);
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

function discoverSkillRoutes(root, accessIssues) {
  const skillsRoot = path.join(root, "skills");
  if (!fs.existsSync(skillsRoot)) return [];
  const routes = [];
  try {
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
  } catch (error) {
    accessIssues.push(accessIssue("skills", error, skillsRoot));
  }
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

async function readMaterialRecords(dir, idField, area, accessIssues) {
  if (!fs.existsSync(dir)) return { records: [] };
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    accessIssues.push(accessIssue(area, error, dir));
    return { records: [] };
  }

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
  return { records };
}

async function readEvalRecords(dir, accessIssues) {
  if (!fs.existsSync(dir)) return { records: [] };
  const files = [];
  try {
    collectJsonFiles(dir, files);
  } catch (error) {
    accessIssues.push(accessIssue("evals", error, dir));
    return { records: [] };
  }

  const records = [];
  for (const file of files) {
    try {
      const parsed = JSON.parse(await fsp.readFile(file, "utf8"));
      if (isValidEvalRecord(parsed)) records.push(parsed);
    } catch {
      continue;
    }
  }
  return { records };
}

function collectJsonFiles(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsonFiles(fullPath, files);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") {
      files.push(fullPath);
    }
  }
}

function isValidMaterialRecord(record, idField) {
  return Boolean(
    record &&
    typeof record === "object" &&
    !Array.isArray(record) &&
    normalizeString(record[idField]),
  );
}

function isValidEvalRecord(record) {
  return Boolean(
    record &&
    typeof record === "object" &&
    !Array.isArray(record) &&
    (normalizeString(record.evalTaskId) || normalizeString(record.evalResultId)),
  );
}

function publicSkill(root, route, accessIssues) {
  const skillFile = path.join(root, route.path, "SKILL.md");
  const exists = fs.existsSync(skillFile);
  const raw = exists ? readSkillMarkdown(skillFile, accessIssues) : "";
  const metadata = parseSkillMarkdown(raw, skillFile, accessIssues);
  const record = {
    recordId: prefixedId("skill", route.id),
    id: route.id,
    skillId: route.id,
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
    advanced: {
      path: route.path,
      configured: Boolean(route.configured),
      discovered: Boolean(route.discovered),
    },
  };
  return record;
}

function readSkillMarkdown(skillFile, accessIssues) {
  try {
    return fs.readFileSync(skillFile, "utf8").slice(0, 12000);
  } catch (error) {
    accessIssues.push(accessIssue("skills", error, skillFile));
    return "";
  }
}

function parseSkillMarkdown(raw, skillFile, accessIssues) {
  try {
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
  } catch (error) {
    accessIssues.push(accessIssue("skills", error, skillFile));
    return { description: "", body: "", title: "" };
  }
}

function sortLearningRecords(records) {
  return records
    .filter(hasUsableRecordId)
    .sort((a, b) => {
      const time = String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
      if (time !== 0) return time;
      return String(a.recordId).localeCompare(String(b.recordId));
    });
}

function hasUsableRecordId(record) {
  const recordId = normalizeString(record?.recordId);
  return Boolean(recordId && !/^[a-z-]+:$/.test(recordId));
}

function prefixedId(prefix, id) {
  const value = normalizeString(id);
  return value ? `${prefix}:${value}` : "";
}

function accessIssue(area, error, filePath) {
  return {
    area,
    message: error?.message || String(error),
    ...(filePath ? { path: filePath } : {}),
  };
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : [];
}

function firstString(value) {
  return Array.isArray(value) ? normalizeString(value[0]) : "";
}

module.exports = {
  buildLearningLibrary,
};
