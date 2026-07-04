const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { normalizeRuleset, validateRuleset } = require("./autonomousLearning");

async function buildCurrentRulesetContext(root, input = {}) {
  const currentFile = path.join(root, "learning", "current-ruleset.json");
  const capability = capabilityForInput(input);

  if (!fs.existsSync(currentFile)) {
    return emptyResult();
  }

  let ruleset;
  let sourceFile = currentFile;
  let loadError = null;

  try {
    ruleset = await readRulesetFileStrict(currentFile);
  } catch (error) {
    loadError = error.message || String(error);
    const fallback = await loadLastGoodRuleset(root, error.lastGoodVersion);
    if (!fallback) {
      return emptyResult({ ok: false, loadError });
    }
    ruleset = fallback.ruleset;
    sourceFile = fallback.file;
    loadError = `${loadError}；已改用 last-good 快照 ${relativePath(root, sourceFile)}`;
  }

  const rules = selectActiveRules(ruleset, capability);
  const currentRulesUsed = rules.map(traceRule);
  return {
    ok: true,
    rules,
    promptText: buildPromptText(root, sourceFile, rules),
    currentRulesUsed,
    loadError,
    sourceFile: rules.length ? relativePath(root, sourceFile) : "",
  };
}

async function readRulesetFileStrict(file) {
  let parsed;
  try {
    parsed = JSON.parse(await fsp.readFile(file, "utf8"));
  } catch (error) {
    const wrapped = new Error(`${path.basename(file)} 读取失败：${error.message || String(error)}`);
    wrapped.lastGoodVersion = null;
    throw wrapped;
  }

  const ruleset = normalizeRuleset(parsed);
  try {
    validateRuleset(ruleset);
  } catch (error) {
    const wrapped = new Error(`${path.basename(file)} 校验失败：${error.message || String(error)}`);
    wrapped.lastGoodVersion = Number(parsed.lastGoodVersion || 0) || null;
    throw wrapped;
  }
  return ruleset;
}

async function loadLastGoodRuleset(root, preferredVersion = null) {
  const historyDir = path.join(root, "learning", "ruleset-history");
  if (!fs.existsSync(historyDir)) return null;

  const candidates = [];
  if (preferredVersion) {
    candidates.push(path.join(historyDir, `v${Number(preferredVersion)}.json`));
  }

  const entries = await fsp.readdir(historyDir, { withFileTypes: true });
  const versionFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(/^v(\d+)\.json$/);
      return match ? { file: path.join(historyDir, entry.name), version: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.version - a.version)
    .map((entry) => entry.file);

  for (const file of versionFiles) {
    if (!candidates.includes(file)) candidates.push(file);
  }

  for (const file of candidates) {
    try {
      return { file, ruleset: await readRulesetFileStrict(file) };
    } catch {
      // Try the next snapshot. A bad snapshot must not leak into generation prompts.
    }
  }
  return null;
}

function selectActiveRules(ruleset, capability) {
  return (ruleset.rules || []).filter((rule) =>
    rule &&
    rule.status === "active" &&
    (capability === "all" || rule.capability === capability || rule.capability === "general")
  );
}

function buildPromptText(root, sourceFile, rules) {
  if (!rules.length) return "";
  const relative = relativePath(root, sourceFile);
  const lines = rules.map((rule) => `- [${rule.topicKey} / ${rule.conflictKey}] ${rule.content}`);
  return `## 当前规则层：${relative}\n\n${lines.join("\n")}`;
}

function traceRule(rule) {
  return {
    ruleId: rule.ruleId,
    topicKey: rule.topicKey,
    conflictKey: rule.conflictKey,
    capability: rule.capability,
    sourceEventIds: Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : [],
    content: rule.content,
  };
}

function capabilityForInput(input = {}) {
  const direct = String(input.capability || "").trim();
  if (direct) return direct;
  const route = input.route || input.skillRoute || input;
  const id = String(route?.id || "").toLowerCase();
  if (id.includes("storyboard")) return "storyboard";
  if (id.includes("script")) return "script";
  if (id.includes("novel")) return "novel";
  return "all";
}

function emptyResult(overrides = {}) {
  return {
    ok: true,
    rules: [],
    promptText: "",
    currentRulesUsed: [],
    loadError: null,
    ...overrides,
  };
}

function relativePath(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

module.exports = {
  buildCurrentRulesetContext,
};
