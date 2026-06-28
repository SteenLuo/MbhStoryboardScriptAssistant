const assert = require("assert");
const test = require("node:test");

const { DEFAULT_APP_NAME, normalizeAppSettings } = require("./appSettings");

test("normalizeAppSettings keeps a valid custom app name", () => {
  const settings = normalizeAppSettings({ appName: "我的漫剧助手" });

  assert.strictEqual(settings.appName, "我的漫剧助手");
});

test("normalizeAppSettings falls back to the default name for blank input", () => {
  const settings = normalizeAppSettings({ appName: "   " });

  assert.strictEqual(settings.appName, DEFAULT_APP_NAME);
});

test("normalizeAppSettings trims very long names", () => {
  const settings = normalizeAppSettings({ appName: "A".repeat(90) });

  assert.strictEqual(settings.appName.length, 40);
});
