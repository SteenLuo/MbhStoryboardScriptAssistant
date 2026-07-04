const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { normalizeRuleset, validateRuleset } = require("./autonomousLearning");

async function buildCurrentRulesetContext(root, input = {}) {
  const capability = capabilityForInput(input);

  const rulesetLoad = await loadCurrentRulesetForPrompt(root);
  if (!rulesetLoad.ok) {
    return emptyResult({ ok: false, loadError: rulesetLoad.loadError });
  }

  const ruleset = rulesetLoad.ruleset;
  const sourceFile = rulesetLoad.sourceFile;
  const rules = selectActiveRules(ruleset, capability);
  const sourceFileRef = rules.length ? relativePath(root, sourceFile) : "";
  const currentRulesUsed = rules.map((rule) => traceRule(rule, {
    sourceFile: sourceFileRef,
    version: ruleset.version,
  }));
  return {
    ok: true,
    rules,
    promptText: buildPromptText(root, sourceFile, rules),
    currentRulesUsed,
    loadError: rulesetLoad.loadError,
    sourceFile: sourceFileRef,
  };
}

async function loadCurrentRulesetForPrompt(root) {
  const currentFile = path.join(root, "learning", "current-ruleset.json");
  if (!fs.existsSync(currentFile)) {
    return {
      ok: true,
      ruleset: emptyRuleset(),
      sourceFile: "",
      loadError: null,
    };
  }

  try {
    return {
      ok: true,
      ruleset: await readRulesetFileStrict(currentFile),
      sourceFile: currentFile,
      loadError: null,
    };
  } catch (error) {
    const loadError = error.message || String(error);
    const fallback = await loadLastGoodRuleset(root, error.lastGoodVersion);
    if (!fallback) {
      return {
        ok: false,
        ruleset: emptyRuleset(),
        sourceFile: "",
        loadError,
      };
    }
    return {
      ok: true,
      ruleset: fallback.ruleset,
      sourceFile: fallback.file,
      loadError: `${loadError}；已改用 last-good 快照 ${relativePath(root, fallback.file)}`,
    };
  }
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
    validateRawRulesetForPrompt(parsed);
    validateRuleset(ruleset);
  } catch (error) {
    const wrapped = new Error(`${path.basename(file)} 校验失败：${error.message || String(error)}`);
    wrapped.lastGoodVersion = Number(parsed.lastGoodVersion || 0) || null;
    throw wrapped;
  }
  return ruleset;
}

function validateRawRulesetForPrompt(raw) {
  if (!raw || typeof raw !== "object") throw new Error("ruleset 结构不合法");
  validateFiniteVersion(raw.version, "version");
  validateFiniteVersion(raw.lastGoodVersion ?? raw.version, "lastGoodVersion");
  if (!Array.isArray(raw.rules)) throw new Error("rules 缺失或不合法");
  for (const rule of raw.rules) {
    if (!rule || typeof rule !== "object") throw new Error("rule 结构不合法");
    if (typeof rule.conflictKey !== "string" || !rule.conflictKey.trim()) {
      throw new Error("rule 缺少 conflictKey");
    }
  }
}

function validateFiniteVersion(value, field) {
  const version = Number(value);
  if (!Number.isFinite(version) || !Number.isInteger(version) || version < 0) {
    throw new Error(`${field} 不合法`);
  }
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

function traceRule(rule, context = {}) {
  return {
    ruleId: rule.ruleId,
    topicKey: rule.topicKey,
    conflictKey: rule.conflictKey,
    capability: rule.capability,
    sourceEventIds: Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : [],
    sourceFile: context.sourceFile || "",
    version: Number(context.version || 0),
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

function emptyRuleset() {
  return {
    version: 0,
    lastGoodVersion: 0,
    updatedAt: "",
    rules: [],
  };
}

function relativePath(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

module.exports = {
  buildCurrentRulesetContext,
  loadCurrentRulesetForPrompt,
};
