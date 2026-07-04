(function initMarkdownFormat(root) {
  const allowedLinkPattern = /^(https?:\/\/|mailto:|\/|#)/i;

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let list = null;
    let quote = [];
    let code = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push(`<p>${renderInline(paragraph.join("\n"))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!list) return;
      html.push(`<${list.type}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    }

    function flushQuote() {
      if (!quote.length) return;
      html.push(`<blockquote>${quote.map((item) => `<p>${renderInline(item)}</p>`).join("")}</blockquote>`);
      quote = [];
    }

    function closeFlow() {
      flushParagraph();
      flushList();
      flushQuote();
    }

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      const fenceMatch = line.match(/^```/);
      if (fenceMatch) {
        if (code) {
          html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
          code = null;
        } else {
          closeFlow();
          code = { lines: [] };
        }
        continue;
      }

      if (code) {
        code.lines.push(rawLine);
        continue;
      }

      if (!line.trim()) {
        closeFlow();
        continue;
      }

      if (/^---+$/.test(line.trim())) {
        closeFlow();
        html.push("<hr>");
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        closeFlow();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }

      const unordered = line.match(/^\s*[-*]\s+(.+)$/);
      if (unordered) {
        flushParagraph();
        flushQuote();
        if (!list || list.type !== "ul") {
          flushList();
          list = { type: "ul", items: [] };
        }
        list.items.push(unordered[1]);
        continue;
      }

      const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ordered) {
        flushParagraph();
        flushQuote();
        if (!list || list.type !== "ol") {
          flushList();
          list = { type: "ol", items: [] };
        }
        list.items.push(ordered[1]);
        continue;
      }

      const quoted = line.match(/^>\s?(.+)$/);
      if (quoted) {
        flushParagraph();
        flushList();
        quote.push(quoted[1]);
        continue;
      }

      flushList();
      flushQuote();
      paragraph.push(line);
    }

    if (code) {
      html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
    }
    closeFlow();

    return html.join("\n");
  }

  function markdownFromHtml(html) {
    if (typeof document !== "undefined") {
      const container = document.createElement("div");
      container.innerHTML = String(html || "");
      return markdownFromElement(container);
    }
    return markdownFromHtmlFallback(html);
  }

  function markdownFromElement(rootNode) {
    const blocks = [];
    const children = Array.from(rootNode?.childNodes || []);
    const source = children.length ? children : [rootNode];
    for (const child of source) {
      const block = blockMarkdown(child);
      if (block) blocks.push(block);
    }
    return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function blockMarkdown(node) {
    if (!node) return "";
    if (node.nodeType === 3) return inlineMarkdown(node).trim();
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const level = Math.min(3, Number(tag.slice(1)) || 1);
      return `${"#".repeat(level)} ${inlineChildrenMarkdown(node).trim()}`;
    }
    if (tag === "ul" || tag === "ol") {
      return Array.from(node.children)
        .filter((child) => child.tagName?.toLowerCase() === "li")
        .map((child, index) => `${tag === "ol" ? `${index + 1}.` : "-"} ${inlineChildrenMarkdown(child).trim()}`)
        .join("\n");
    }
    if (tag === "blockquote") {
      return inlineChildrenMarkdown(node)
        .split(/\n+/)
        .map((line) => `> ${line.trim()}`)
        .join("\n");
    }
    if (tag === "hr") return "---";
    if (tag === "pre") return `\`\`\`\n${node.textContent || ""}\n\`\`\``;
    if (tag === "br") return "\n";
    return inlineChildrenMarkdown(node).trim();
  }

  function inlineChildrenMarkdown(node) {
    return Array.from(node.childNodes || []).map(inlineMarkdown).join("").replace(/\u00a0/g, " ");
  }

  function inlineMarkdown(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.textContent || "";
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "\n";
    const text = inlineChildrenMarkdown(node);
    if (!text) return "";
    if (tag === "strong" || tag === "b") return `**${text}**`;
    if (tag === "em" || tag === "i") return `*${text}*`;
    if (tag === "code") return `\`${text}\``;
    const color = sanitizeColor(node.style?.color || node.getAttribute?.("data-markdown-color") || "");
    if (color) return `[${text}]{${color}}`;
    return text;
  }

  function markdownFromHtmlFallback(html) {
    let output = String(html || "")
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
      .replace(/<span[^>]*color:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)[^>]*>([\s\S]*?)<\/span>/gi, "[$2]{$1}")
      .replace(/<hr\s*\/?>/gi, "\n---\n")
      .replace(/<blockquote[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/blockquote>/gi, "\n> $1\n")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    output = decodeBasicEntities(output);
    return output.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function decodeBasicEntities(value) {
    return String(value || "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function renderInline(text) {
    const colorTokens = [];
    const prepared = String(text || "").replace(/\[([^\]\n]+)\]\{([^}\n]+)\}/g, (_match, label, color) => {
      const safeColor = sanitizeColor(color);
      if (!safeColor) return label;
      const token = `\uE000COLOR${colorTokens.length}\uE000`;
      colorTokens.push({
        token,
        html: `<span style="color: ${safeColor}">${escapeHtml(label)}</span>`,
      });
      return token;
    });
    let html = escapeHtml(prepared)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
        const safeHref = sanitizeHref(href);
        if (!safeHref) return label;
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
      .replace(/\n/g, "<br>");
    for (const item of colorTokens) {
      html = html.replace(item.token, item.html);
    }
    return html;
  }

  function sanitizeHref(href) {
    const value = String(href || "").trim();
    if (!allowedLinkPattern.test(value)) return "";
    return escapeAttribute(value);
  }

  function sanitizeColor(color) {
    const value = String(color || "").trim().toLowerCase();
    if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(value)) return "";
    return value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  const api = { renderMarkdown, markdownFromHtml, markdownFromElement };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis);
