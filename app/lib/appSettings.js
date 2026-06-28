const DEFAULT_APP_NAME = "猫主子漫剧剧本分镜小助手";

function normalizeAppSettings(data = {}) {
  const rawName = String(data.appName || "").replace(/\s+/g, " ").trim();
  return {
    appName: rawName ? rawName.slice(0, 40) : DEFAULT_APP_NAME,
  };
}

module.exports = {
  DEFAULT_APP_NAME,
  normalizeAppSettings,
};
