const MAX_DIALOGUE_CHARS = 20;
const DIALOGUE_LINE_PATTERN = /^(\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:(?:\*\*|__)\s*)?(?:台词|对白|dialogue)\s*[:：]\s*(?:(?:\*\*|__)\s*)?)(.+)$/i;
const SPEAKER_MARKER_PATTERN = /^((?:[（(][^）)]{1,20}[）)]\s*)?(?:(?:[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_-]{0,20}(?:OS|VO)?)|旁白|画外音|男声|女声)\s*[:：])\s*(.+)$/;
const FIELD_LINE_PATTERN = /^(\s*)(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:(?:\*\*|__)\s*)?([^：:\n]{1,40})\s*[:：]\s*(?:(?:\*\*|__)\s*)?(.*)$/;
const STORYBOARD_FIELD_LABELS = new Set([
  "场次",
  "地点",
  "时间",
  "人物",
  "镜号",
  "画面内容与构图叙事",
  "景别",
  "运镜",
  "情绪/动作",
  "音效",
  "台词",
  "对白",
  "时长",
  "字幕",
]);
const STABLE_STORYBOARD_SKILL_RULES = [
  {
    ruleId: "stable-skill-storyboard-dialogue-length",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length.max-chars",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.length",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-single-speaker",
    topicKey: "storyboard.dialogue.speaker-count",
    conflictKey: "storyboard.dialogue.speaker-count.single-speaker",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.speaker-count",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
];
const PROGRAMMATIC_HARD_RULES = [
  {
    hardRuleId: "storyboard.dialogue.length",
    topicKeys: new Set(["storyboard.dialogue.length", "storyboard.dialogue.length.max-chars"]),
  },
  {
    hardRuleId: "storyboard.dialogue.speaker-count",
    topicKeys: new Set(["storyboard.dialogue.speaker-count", "storyboard.dialogue.speaker-count.single-speaker"]),
  },
];

function validateStoryboardContent(content, options = {}) {
  const maxChars = Number(options.maxDialogueChars || MAX_DIALOGUE_CHARS);
  const lines = String(content || "").split(/\r?\n/);
  const issues = [];
  lines.forEach((line, index) => {
    const parsedLine = parseDialogueLine(line);
    if (!parsedLine) return;
    const dialogue = trimDialogueQuotes(parsedLine.body);
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
  const appliedRules = getStoryboardValidationRules(options);
  if (!appliedRules.length) {
    return {
      ok: true,
      issues: [],
      appliedRules,
      checked: false,
    };
  }

  const issues = [];
  const ruleGroups = groupRulesByHardRuleId(appliedRules);
  if (ruleGroups.has("storyboard.dialogue.length")) {
    const rules = ruleGroups.get("storyboard.dialogue.length");
    const validation = validateStoryboardContent(content, options);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.length"));
  }
  if (ruleGroups.has("storyboard.dialogue.speaker-count")) {
    const rules = ruleGroups.get("storyboard.dialogue.speaker-count");
    const validation = validateStoryboardSpeakerCount(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.speaker-count"));
  }
  return {
    ok: issues.length === 0,
    issues,
    appliedRules,
    checked: true,
  };
}

function getStoryboardValidationRules(options = {}) {
  const stableRules = options.useStableSkillRules === false ? [] : getStableStoryboardSkillRules();
  const currentRules = options.includeCurrentRules
    ? getApplicableStoryboardHardRules(options.currentRulesUsed)
    : [];
  return [...stableRules, ...currentRules];
}

function getStableStoryboardSkillRules() {
  return STABLE_STORYBOARD_SKILL_RULES.map((rule) => ({
    ...rule,
    sourceEventIds: [...rule.sourceEventIds],
  }));
}

function applyStoryboardHardRuleValidation(content, options = {}) {
  const normalizedContent = normalizeStoryboardFieldLabels(content);
  const initial = validateStoryboardHardRules(normalizedContent, options);
  if (!initial.checked || initial.ok) {
    return {
      content: normalizedContent,
      validation: initial.checked ? initial : validateStoryboardContent(normalizedContent, options),
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

  const repair = repairStoryboardDialogueIssues(normalizedContent, initial.issues, options);
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

function validateStoryboardSpeakerCount(content) {
  const shots = parseStoryboardShots(content);
  const issues = [];
  for (const shot of shots) {
    const speakers = new Map();
    let firstDialogueLineNumber = 0;
    for (const line of shot.lines) {
      const parsedLine = parseDialogueLine(line.text);
      if (!parsedLine) continue;
      const dialogue = trimDialogueQuotes(parsedLine.body);
      if (isEmptyDialogue(dialogue)) continue;
      if (!firstDialogueLineNumber) firstDialogueLineNumber = line.lineNumber;
      const speakerName = normalizeSpeakerName(parsedLine.speakerMarker);
      if (speakerName) speakers.set(speakerName, speakerName);
      for (const embeddedSpeaker of extractEmbeddedSpeakerNames(dialogue, shot.sceneSpeakers)) {
        speakers.set(embeddedSpeaker, embeddedSpeaker);
      }
    }
    if (speakers.size <= 1) continue;
    const speakerList = Array.from(speakers.values());
    issues.push({
      type: "dialogue-multiple-speakers",
      severity: "error",
      lineNumber: firstDialogueLineNumber || shot.lineNumber,
      shotNumber: shot.shotNumber,
      speakers: speakerList,
      message: `同一个镜号只允许一个说话人，当前镜号出现：${speakerList.join("、")}。`,
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function parseStoryboardShots(content) {
  const lines = String(content || "").split(/\r?\n/);
  const shots = [];
  let current = null;
  let sceneSpeakers = new Set();
  lines.forEach((line, index) => {
    const field = matchStoryboardFieldLine(line);
    if (field?.label === "人物") {
      sceneSpeakers = parseSceneSpeakers(field.value);
    }
    const shotNumber = parseShotNumberLine(line);
    if (shotNumber) {
      current = {
        shotNumber,
        lineNumber: index + 1,
        sceneSpeakers: new Set(sceneSpeakers),
        lines: [],
      };
      shots.push(current);
    }
    if (current) {
      current.lines.push({ lineNumber: index + 1, text: line });
    }
  });
  if (shots.length) return shots;
  return [{
    shotNumber: "",
    lineNumber: 1,
    lines: lines.map((line, index) => ({ lineNumber: index + 1, text: line })),
  }];
}

function parseShotNumberLine(line) {
  const field = matchStoryboardFieldLine(line);
  if (!field || field.label !== "镜号") return "";
  const match = field.value.match(/\d+/);
  return match ? match[0] : field.value.trim();
}

function normalizeStoryboardFieldLabels(content) {
  const normalizedLines = String(content || "")
    .split(/\r?\n/)
    .map(normalizeStoryboardFieldLabelLine);
  return stripNonStoryboardScaffolding(normalizedLines).join("\n").trim();
}

function normalizeStoryboardFieldLabelLine(line) {
  const field = matchStoryboardFieldLine(line);
  if (!field || !STORYBOARD_FIELD_LABELS.has(field.label)) return line;
  return `${field.indent}${field.label}：${field.value}`;
}

function stripNonStoryboardScaffolding(lines = []) {
  const withoutMarkdownChrome = lines.filter((line) =>
    !isMarkdownStoryboardHeading(line) && !isMarkdownSeparator(line)
  );
  const startIndex = withoutMarkdownChrome.findIndex(isStoryboardStartLine);
  if (startIndex <= 0) return withoutMarkdownChrome;
  return withoutMarkdownChrome.slice(startIndex);
}

function isMarkdownStoryboardHeading(line) {
  return /^\s*#{1,6}\s*第.+分镜/.test(String(line || "").trim());
}

function isMarkdownSeparator(line) {
  return /^\s*-{3,}\s*$/.test(String(line || ""));
}

function isStoryboardStartLine(line) {
  const field = matchStoryboardFieldLine(line);
  return !!field && ["场次", "地点", "时间", "人物", "镜号"].includes(field.label);
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
  const match = matchDialogueLine(line);
  if (!match) return null;
  const rawDialogue = String(match.body || "").trim();
  const markerMatch = rawDialogue.match(SPEAKER_MARKER_PATTERN);
  if (markerMatch) {
    return {
      fieldPrefix: match.fieldPrefix,
      speakerMarker: markerMatch[1],
      body: markerMatch[2],
    };
  }
  const fallbackMarker = firstDialogueMarker(rawDialogue);
  if (!fallbackMarker) {
    return {
      fieldPrefix: match.fieldPrefix,
      speakerMarker: "",
      body: rawDialogue,
    };
  }
  return {
    fieldPrefix: match.fieldPrefix,
    speakerMarker: fallbackMarker.marker,
    body: fallbackMarker.body,
  };
}

function matchDialogueLine(line) {
  const match = String(line || "").match(DIALOGUE_LINE_PATTERN);
  if (!match) return null;
  return {
    fieldPrefix: match[1],
    body: match[2],
  };
}

function firstDialogueMarker(rawDialogue) {
  const text = String(rawDialogue || "").trim();
  const colonMatch = [...text.matchAll(/[：:]/g)].find((match) => match.index > 0 && match.index <= 40);
  if (!colonMatch) return null;
  return {
    marker: text.slice(0, colonMatch.index + 1),
    body: text.slice(colonMatch.index + 1).trim(),
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

function trimDialogueQuotes(text) {
  return String(text || "")
    .replace(/^[“"「『]+/, "")
    .replace(/[”"」』]+$/, "")
    .trim();
}

function isEmptyDialogue(text) {
  return /^(无|暂无|没有|空|-|—|--)?$/.test(String(text || "").trim());
}

function matchStoryboardFieldLine(line) {
  const match = String(line || "").match(FIELD_LINE_PATTERN);
  if (!match) return null;
  return {
    indent: match[1] || "",
    label: normalizeFieldLabel(match[2]),
    value: stripClosingMarkdown(match[3]).trimStart(),
  };
}

function normalizeFieldLabel(label) {
  return String(label || "")
    .replace(/[*_#\s]/g, "")
    .trim();
}

function stripClosingMarkdown(value) {
  return String(value || "")
    .replace(/\s*(?:\*\*|__)\s*$/, "")
    .trimEnd();
}

function normalizeSpeakerName(marker) {
  let speaker = String(marker || "")
    .replace(/[：:]\s*$/, "")
    .trim();
  speaker = speaker.replace(/^[（(][^）)]{1,20}[）)]\s*/, "").trim();
  speaker = speaker.replace(/[（(]\s*(?:os|vo|旁白|画外音)\s*[）)]$/i, "").trim();
  speaker = speaker.replace(/(?:OS|VO)$/i, "").trim();
  return speaker;
}

function parseSceneSpeakers(value) {
  const speakers = new Set();
  for (const part of String(value || "").split(/[、,，/／;；\s]+/)) {
    const name = normalizeSpeakerName(part)
      .replace(/[（(].*?[）)]/g, "")
      .trim();
    if (name) speakers.add(name);
  }
  return speakers;
}

function extractEmbeddedSpeakerNames(text, allowedSpeakers = new Set()) {
  const allowed = allowedSpeakers instanceof Set ? allowedSpeakers : new Set();
  if (!allowed.size) return [];
  const names = [];
  const pattern = /(?:^|[，。！？；,.!?;\s])((?:[（(][^）)]{1,20}[）)]\s*)?(?:(?:[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_-]{0,20}(?:OS|VO)?)|旁白|画外音|男声|女声))\s*[:：]/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const name = normalizeSpeakerName(match[1]);
    if (name && allowed.has(name)) names.push(name);
  }
  return names;
}

function groupRulesByHardRuleId(rules = []) {
  const groups = new Map();
  for (const rule of Array.isArray(rules) ? rules : []) {
    const hardRuleId = String(rule?.hardRuleId || "").trim();
    if (!hardRuleId) continue;
    if (!groups.has(hardRuleId)) groups.set(hardRuleId, []);
    groups.get(hardRuleId).push(rule);
  }
  return groups;
}

function attachHardRuleMeta(issues = [], rules = [], hardRuleId = "") {
  const skillRulesUsedRefs = rules
    .filter((rule) => rule.origin === "stable-skill")
    .map((rule) => rule.ruleId)
    .filter(Boolean);
  const currentRulesUsedRefs = rules
    .filter((rule) => rule.origin !== "stable-skill")
    .map((rule) => rule.ruleId)
    .filter(Boolean);
  const sourceEventIds = collectRuleSourceEventIds(rules);
  return (Array.isArray(issues) ? issues : []).map((issue) => ({
    ...issue,
    hardRuleId,
    skillRulesUsedRefs,
    currentRulesUsedRefs,
    sourceEventIds,
  }));
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
  getStableStoryboardSkillRules,
  isStoryboardValidationResolved,
  MAX_DIALOGUE_CHARS,
  normalizeStoryboardFieldLabels,
  repairStoryboardDialogueIssues,
  storyboardContentFingerprint,
  splitDialogueLine,
  validateStoryboardHardRules,
  validateStoryboardContent,
  validateStoryboardSpeakerCount,
};
