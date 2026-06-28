const assert = require("assert");
const test = require("node:test");

const {
  DEFAULT_PROVIDER,
  MODEL_PROVIDERS,
  normalizeModelSettings,
  publicModelSettings,
} = require("./modelSettings");

test("normalizeModelSettings migrates legacy DeepSeek config", () => {
  const settings = normalizeModelSettings({
    baseUrl: "https://legacy.deepseek.example",
    model: "deepseek-chat",
    apiKey: "ds-key",
  });

  assert.strictEqual(settings.provider, DEFAULT_PROVIDER);
  assert.strictEqual(settings.providers.deepseek.baseUrl, "https://legacy.deepseek.example");
  assert.strictEqual(settings.providers.deepseek.model, "deepseek-chat");
  assert.strictEqual(settings.providers.deepseek.apiKey, "ds-key");
});

test("normalizeModelSettings keeps OpenAI GPT 5.5 defaults", () => {
  const settings = normalizeModelSettings({ provider: "openai" });

  assert.strictEqual(settings.provider, "openai");
  assert.strictEqual(settings.providers.openai.baseUrl, MODEL_PROVIDERS.openai.baseUrl);
  assert.strictEqual(settings.providers.openai.model, "gpt-5.5");
});

test("publicModelSettings exposes active provider without API key text", () => {
  const settings = normalizeModelSettings({
    provider: "openai",
    providers: {
      openai: { apiKey: "secret", model: "gpt-5.5", baseUrl: "https://api.openai.com/v1" },
    },
  });
  const data = publicModelSettings(settings, { openai: false });

  assert.strictEqual(data.provider, "openai");
  assert.strictEqual(data.model, "gpt-5.5");
  assert.strictEqual(data.hasStoredApiKey, true);
  assert.strictEqual(JSON.stringify(data).includes("secret"), false);
});
