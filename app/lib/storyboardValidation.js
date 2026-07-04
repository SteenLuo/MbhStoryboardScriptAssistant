const DIALOGUE_PREFIX = /^\s*(台词|对白|dialogue)\s*[:：]\s*(.+)$/i;
const MAX_DIALOGUE_CHARS = 20;
const PROGRAMMATIC_HARD_RULES = [
  {
    hardRuleId: "storyboard.dialogue.length",
    topicKeys: new Set(["storyboard.dialogue.length"]),
  },
];

function validateStoryboardContent(content, options = {}) {
  const maxChars = Number(options.maxDialogueChars || MAX_DIALOGUE_CHARS);
  const lines = String(content || "").split(/\r?\n/);
  const issues = [];
  lines.forEach((line, index) => {
    const match = line.match(DIALOGUE_PREFIX);
    if (!match) return;
    const dialogue = extractSpokenDialogue(match[2]);
    if (displayLength(dialogue) <= maxChars) return;
    issues.push({
      type: "dialogue-too-long",
      severity: "error",
      lineNumber: index + 1,
      lineText: line,
      dialogue,
      message: `台词超过 ${maxChars} 字，需拆成新的分镜或拆分台词。`,
      suggestedLines: splitDialogueLine(dialogue, maxChars),
    });
  });
  return {
    ok: issues.length === 0,
    issues,
  };
}

function getApplicableStoryboardHardRules(currentRulesUsed = []) {
  const rules = Array.isArray(currentRulesUsed) ? currentRulesUsed : [];
  return rules
    .map(normalizeRuleRef)
    .filter(Boolean)
    .filter((rule) => rule.status === "" || rule.status === "active")
    .map((rule) => {
      const registry = PROGRAMMATIC_HARD_RULES.find((item) =>
        item.topicKeys.has(rule.topicKey) || item.topicKeys.has(rule.conflictKey)
      );
      return registry ? { ...rule, hardRuleId: registry.hardRuleId } : null;
    })
    .filter(Boolean);
}

function validateStoryboardHardRules(content, options = {}) {
  const appliedRules = getApplicableStoryboardHardRules(options.currentRulesUsed);
  if (!appliedRules.length) {
    return {
      ok: true,
      issues: [],
      appliedRules,
      checked: false,
    };
  }

  const validation = validateStoryboardContent(content, options);
  const currentRulesUsedRefs = appliedRules.map((rule) => rule.ruleId).filter(Boolean);
  const sourceEventIds = collectRuleSourceEventIds(appliedRules);
  const issues = validation.issues.map((issue) => ({
    ...issue,
    hardRuleId: "storyboard.dialogue.length",
    currentRulesUsedRefs,
    sourceEventIds,
  }));
  return {
    ok: issues.length === 0,
    issues,
    appliedRules,
    checked: true,
  };
}

function applyStoryboardHardRuleValidation(content, options = {}) {
  const initial = validateStoryboardHardRules(content, options);
  if (!initial.checked || initial.ok) {
    return {
      content,
      validation: initial.checked ? initial : validateStoryboardContent(content, options),
      hardRuleValidation: {
        checked: initial.checked,
        repaired: false,
        finalOk: initial.ok,
        appliedRules: initial.appliedRules,
        initialIssues: initial.issues,
        finalIssues: initial.issues,
      },
    };
  }

  const repair = repairStoryboardDialogueIssues(content, initial.issues, options);
  const finalValidation = repair.repaired
    ? validateStoryboardHardRules(repair.content, options)
    : initial;
  return {
    content: repair.content,
    validation: finalValidation,
    hardRuleValidation: {
      checked: true,
      repaired: repair.repaired,
      repairStrategy: repair.repaired ? "splitDialogueLine" : "",
      finalOk: finalValidation.ok,
      appliedRules: initial.appliedRules,
      initialIssues: initial.issues,
      finalIssues: finalValidation.issues,
    },
  };
}

function repairStoryboardDialogueIssues(content, issues = [], options = {}) {
  const maxChars = Number(options.maxDialogueChars || MAX_DIALOGUE_CHARS);
  const issueByLine = new Map(
    (Array.isArray(issues) ? issues : [])
      .filter((issue) => issue?.type === "dialogue-too-long" && Number(issue.lineNumber) > 0)
      .map((issue) => [Number(issue.lineNumber), issue]),
  );
  if (!issueByLine.size) return { content, repaired: false };

  let repaired = false;
  const lines = String(content || "").split(/\r?\n/);
  const nextLines = [];
  lines.forEach((line, index) => {
    const issue = issueByLine.get(index + 1);
    if (!issue) {
      nextLines.push(line);
      return;
    }
    const parsedLine = parseDialogueLine(line);
    const dialogueBody = parsedLine?.body || issue.dialogue || line;
    const splitLines = splitDialogueLine(dialogueBody, maxChars);
    if (splitLines.length <= 1) {
      nextLines.push(line);
      return;
    }
    repaired = true;
    const fieldPrefix = parsedLine?.fieldPrefix || "台词：";
    const speakerMarker = parsedLine?.speakerMarker || "";
    for (const splitLine of splitLines) {
      nextLines.push(`${fieldPrefix}${speakerMarker}${splitLine.text || splitLine}`);
    }
  });
  return {
    content: nextLines.join("\n"),
    repaired,
  };
}

function parseDialogueLine(line) {
  const match = String(line || "").match(/^(\s*(?:台词|对白|dialogue)\s*[:：]\s*)(.+)$/i);
  if (!match) return null;
  const rawDialogue = String(match[2] || "").trim();
  const markerMatch = rawDialogue.match(/^((?:旁白VO|角色OS|画外音|[A-Za-z][A-Za-z0-9_-]*)\s*[:：])\s*(.+)$/);
  if (!markerMatch) {
    return {
      fieldPrefix: match[1],
      speakerMarker: "",
      body: rawDialogue,
    };
  }
  return {
    fieldPrefix: match[1],
    speakerMarker: markerMatch[1],
    body: markerMatch[2],
  };
}

function splitDialogueLine(dialogue, maxChars = MAX_DIALOGUE_CHARS) {
  const clean = String(dialogue || "").replace(/\s+/g, "").trim();
  if (!clean) return [];
  if (displayLength(clean) <= maxChars) return [{ text: clean }];
  const parts = clean.match(/[^，。！？；,.!?;]+[，。！？；,.!?;]?/g) || [clean];
  const lines = [];
  let current = "";
  for (const part of parts) {
    if (displayLength(current + part) <= maxChars) {
      current += part;
      continue;
    }
    if (current) {
      lines.push({ text: current });
      current = "";
    }
    if (displayLength(part) <= maxChars) {
      current = part;
      continue;
    }
    for (const chunk of chunkByDisplayLength(part, maxChars)) {
      lines.push({ text: chunk });
    }
  }
  if (current) lines.push({ text: current });
  return lines;
}

function extractSpokenDialogue(rawDialogue) {
  const text = String(rawDialogue || "").trim();
  const colonMatch = [...text.matchAll(/[：:]/g)].find((match) => match.index > 0 && match.index <= 40);
  if (!colonMatch) return trimDialogueQuotes(text);
  return trimDialogueQuotes(text.slice(colonMatch.index + 1).trim());
}

function trimDialogueQuotes(text) {
  return String(text || "")
    .replace(/^[“"「『]+/, "")
    .replace(/[”"」』]+$/, "")
    .trim();
}

function chunkByDisplayLength(text, maxChars) {
  const chars = Array.from(String(text || ""));
  const chunks = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    chunks.push(chars.slice(index, index + maxChars).join(""));
  }
  return chunks;
}

function displayLength(text) {
  return Array.from(String(text || "")).filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
}

function storyboardContentFingerprint(content) {
  const text = String(content || "");
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function normalizeRuleRef(rule) {
  if (!rule || typeof rule !== "object") return null;
  const topicKey = String(rule.topicKey || "").trim();
  const conflictKey = String(rule.conflictKey || topicKey).trim();
  if (!topicKey && !conflictKey) return null;
  return {
    ruleId: String(rule.ruleId || "").trim(),
    topicKey,
    conflictKey,
    status: String(rule.status || "").trim(),
    sourceEventIds: Array.isArray(rule.sourceEventIds)
      ? rule.sourceEventIds.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
}

function collectRuleSourceEventIds(rules = []) {
  const ids = new Set();
  for (const rule of Array.isArray(rules) ? rules : []) {
    for (const id of Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : []) {
      const value = String(id || "").trim();
      if (value) ids.add(value);
    }
  }
  return Array.from(ids);
}

function isStoryboardValidationResolved(node) {
  const resolution = node?.meta?.validationResolution;
  if (!["acknowledged", "adopted"].includes(resolution?.action)) return false;
  return resolution.contentFingerprint === storyboardContentFingerprint(node?.content);
}

module.exports = {
  applyStoryboardHardRuleValidation,
  getApplicableStoryboardHardRules,
  isStoryboardValidationResolved,
  MAX_DIALOGUE_CHARS,
  repairStoryboardDialogueIssues,
  storyboardContentFingerprint,
  splitDialogueLine,
  validateStoryboardHardRules,
  validateStoryboardContent,
};
