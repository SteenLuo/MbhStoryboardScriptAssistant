const DEFAULT_PROVIDER = "deepseek";

const MODEL_PROVIDERS = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5",
    models: ["gpt-5.5", "gpt-5"],
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
  },
  apimart: {
    id: "apimart",
    label: "APIMart",
    baseUrl: "https://api.apimart.ai/v1",
    model: "gpt-5.5",
    models: ["gpt-5.5", "gpt-5", "gpt-5.1", "gpt-5-chat-latest", "gpt-5-mini"],
    apiKeyEnv: "APIMART_API_KEY",
    modelEnv: "APIMART_MODEL",
  },
};

function providerIds() {
  return Object.keys(MODEL_PROVIDERS);
}

function normalizeProvider(provider) {
  return providerIds().includes(provider) ? provider : DEFAULT_PROVIDER;
}

function normalizeProviderConfig(provider, data = {}) {
  const defaults = MODEL_PROVIDERS[provider] || MODEL_PROVIDERS[DEFAULT_PROVIDER];
  return {
    baseUrl: String(data.baseUrl || defaults.baseUrl).trim() || defaults.baseUrl,
    model: String(data.model || defaults.model).trim() || defaults.model,
    apiKey: String(data.apiKey || ""),
  };
}

function normalizeModelSettings(data = {}) {
  const provider = normalizeProvider(data.provider);
  const providers = {};
  for (const id of providerIds()) {
    providers[id] = normalizeProviderConfig(id, data.providers?.[id]);
  }

  if (data.baseUrl || data.model || data.apiKey) {
    providers.deepseek = normalizeProviderConfig("deepseek", {
      ...providers.deepseek,
      baseUrl: data.baseUrl || providers.deepseek.baseUrl,
      model: data.model || providers.deepseek.model,
      apiKey: data.apiKey || providers.deepseek.apiKey,
    });
  }

  return { provider, providers };
}

function updateModelSettings(existing, body = {}) {
  const current = normalizeModelSettings(existing);
  const provider = normalizeProvider(body.provider || current.provider);
  const providerConfig = current.providers[provider];
  current.provider = provider;
  current.providers[provider] = normalizeProviderConfig(provider, {
    baseUrl: body.baseUrl || providerConfig.baseUrl,
    model: body.model || providerConfig.model,
    apiKey: Object.prototype.hasOwnProperty.call(body, "apiKey") && String(body.apiKey || "").trim()
      ? String(body.apiKey || "").trim()
      : providerConfig.apiKey,
  });
  return current;
}

function publicModelSettings(settings, env = process.env) {
  const normalized = normalizeModelSettings(settings);
  const active = normalized.providers[normalized.provider];
  const providerMeta = MODEL_PROVIDERS[normalized.provider];
  return {
    provider: normalized.provider,
    providerLabel: providerMeta.label,
    providerOptions: providerIds().map((id) => ({
      id,
      label: MODEL_PROVIDERS[id].label,
      defaultBaseUrl: MODEL_PROVIDERS[id].baseUrl,
      defaultModel: MODEL_PROVIDERS[id].model,
    })),
    baseUrl: active.baseUrl,
    model: active.model,
    envModel: env[providerMeta.modelEnv] || "",
    hasStoredApiKey: Boolean(active.apiKey),
    hasEnvApiKey: Boolean(env[providerMeta.apiKeyEnv]),
  };
}

function resolveActiveModelSettings(settings, overrides = {}, env = process.env) {
  const normalized = normalizeModelSettings(settings);
  const provider = normalizeProvider(overrides.provider || normalized.provider);
  const providerConfig = normalized.providers[provider];
  const providerMeta = MODEL_PROVIDERS[provider];
  return {
    provider,
    providerLabel: providerMeta.label,
    baseUrl: String(overrides.baseUrl || providerConfig.baseUrl || providerMeta.baseUrl).replace(/\/$/, ""),
    model: overrides.model || env[providerMeta.modelEnv] || providerConfig.model || providerMeta.model,
    apiKey: overrides.apiKey || env[providerMeta.apiKeyEnv] || providerConfig.apiKey,
    apiKeyEnv: providerMeta.apiKeyEnv,
  };
}

module.exports = {
  DEFAULT_PROVIDER,
  MODEL_PROVIDERS,
  normalizeModelSettings,
  publicModelSettings,
  resolveActiveModelSettings,
  updateModelSettings,
};
