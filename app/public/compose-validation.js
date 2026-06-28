(function initComposeValidation(root) {
  const composeModePrompts = {
    script: "请将以下内容按 AI 漫剧标准生成剧本。",
    storyboard: "请将以下内容按 AI 漫剧标准生成分镜。",
  };

  function canSendCompose({ text = "", attachments = [] } = {}) {
    return Boolean(String(text || "").trim()) || (Array.isArray(attachments) && attachments.length > 0);
  }

  function buildOutgoingText(text, composeMode) {
    const trimmed = String(text || "").trim();
    const prefix = composeModePrompts[composeMode];
    if (!prefix) return trimmed;
    return trimmed ? `${prefix}\n\n${trimmed}` : prefix;
  }

  const api = { buildOutgoingText, canSendCompose };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MbhCompose = api;
})(typeof window !== "undefined" ? window : globalThis);
