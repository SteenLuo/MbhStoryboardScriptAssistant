(function initComposeValidation(root) {
  function canSendCompose({ text = "", attachments = [] } = {}) {
    return Boolean(String(text || "").trim()) || (Array.isArray(attachments) && attachments.length > 0);
  }

  function buildOutgoingText(text) {
    return String(text || "").trim();
  }

  const api = { buildOutgoingText, canSendCompose };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhCompose = api;
})(typeof window !== "undefined" ? window : globalThis);
