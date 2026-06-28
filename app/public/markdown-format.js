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

  function renderInline(text) {
    return escapeHtml(text)
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
  }

  function sanitizeHref(href) {
    const value = String(href || "").trim();
    if (!allowedLinkPattern.test(value)) return "";
    return escapeAttribute(value);
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

  const api = { renderMarkdown };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis);
