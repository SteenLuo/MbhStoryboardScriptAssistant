(function initUsageFormat(root) {
  function formatTokenUsage(usage) {
    const total = Number(usage && usage.total_tokens);
    if (!Number.isFinite(total) || total <= 0) return "";
    return `token ${formatCompactTokenCount(total)}`;
  }

  function formatCompactTokenCount(total) {
    if (total < 1000) return String(total);
    return `${trimTrailingZero((total / 1000).toFixed(1))}k`;
  }

  function trimTrailingZero(text) {
    return String(text).replace(/\.0$/, "");
  }

  const api = { formatTokenUsage };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhUsage = api;
})(typeof window !== "undefined" ? window : globalThis);
