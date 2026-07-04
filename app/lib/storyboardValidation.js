const DIALOGUE_PREFIX = /^\s*(台词|对白)\s*[:：]\s*(.+)$/;
const MAX_DIALOGUE_CHARS = 20;

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

function isStoryboardValidationResolved(node) {
  const resolution = node?.meta?.validationResolution;
  if (!["acknowledged", "adopted"].includes(resolution?.action)) return false;
  return resolution.contentFingerprint === storyboardContentFingerprint(node?.content);
}

module.exports = {
  isStoryboardValidationResolved,
  MAX_DIALOGUE_CHARS,
  storyboardContentFingerprint,
  splitDialogueLine,
  validateStoryboardContent,
};
