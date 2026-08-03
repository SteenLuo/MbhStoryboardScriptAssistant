function decodeBasicHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function plainTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => plainInlineText(cell.trim()))
    .filter(Boolean)
    .join("；");
}

function isMarkdownTableRow(line) {
  const text = String(line || "").trim();
  return text.startsWith("|") && text.endsWith("|") && text.split("|").length >= 4;
}

function isMarkdownTableDivider(line) {
  if (!isMarkdownTableRow(line)) return false;
  const cells = String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function plainInlineText(value) {
  let text = String(value || "");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1（$2）");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(?:span|mark|strong|em|b|i|p|div|h[1-6]|ul|ol|li|blockquote)(?:\s[^>]*)?>/gi, "");
  text = text.replace(/~~([^~\n]+)~~/g, "$1");
  text = text.replace(/`([^`\n]+)`/g, "$1");
  for (let index = 0; index < 3; index += 1) {
    text = text
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/(?<![\w_])__([^_\n]+)__(?![\w_])/g, "$1")
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
      .replace(/(?<![\w_])_([^_\n]+)_(?![\w_])/g, "$1");
  }
  text = text.replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1");
  return decodeBasicHtmlEntities(text);
}

function markdownToModelPlainText(value) {
  const source = String(value || "").replace(/\r\n?/g, "\n");
  if (!source) return "";
  const inputLines = source.split("\n");
  const output = [];

  for (let index = 0; index < inputLines.length; index += 1) {
    const rawLine = inputLines[index];
    const trimmed = rawLine.trim();
    if (/^```|^~~~/.test(trimmed)) continue;
    if (/^(?:-{3,}|\*{3,}|_{3,}|={3,})$/.test(trimmed)) continue;

    if (isMarkdownTableRow(rawLine) && isMarkdownTableDivider(inputLines[index + 1])) {
      output.push(plainTableRow(rawLine));
      index += 1;
      while (index + 1 < inputLines.length && isMarkdownTableRow(inputLines[index + 1])) {
        index += 1;
        output.push(plainTableRow(inputLines[index]));
      }
      continue;
    }

    let line = rawLine
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s{0,3}>\s?/, "")
      .replace(/^\s*[-+*]\s+/, "")
      .replace(/^\s*(\d+)[.)、]\s+/, "$1：");
    line = plainInlineText(line).replace(/[ \t]+$/g, "");
    output.push(line);
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function modelMessagesToPlainText(messages = []) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (typeof message?.content === "string") {
      return { ...message, content: markdownToModelPlainText(message.content) };
    }
    if (Array.isArray(message?.content)) {
      return {
        ...message,
        content: message.content.map((part) => (
          part?.type === "text" && typeof part.text === "string"
            ? { ...part, text: markdownToModelPlainText(part.text) }
            : part
        )),
      };
    }
    return { ...message };
  });
}

module.exports = {
  markdownToModelPlainText,
  modelMessagesToPlainText,
  plainInlineText,
};
