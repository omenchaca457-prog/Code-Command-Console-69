type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function isConfigured(...values: Array<string | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

/**
 * Reads current configuration without making provider calls or inspecting files.
 * Configured providers have not been checked for valid credentials or availability.
 * Local storage is built in; its filesystem permissions are checked when used.
 */
export function getRuntimeIntegrationStatus(
  environment: RuntimeEnvironment = process.env,
  observedAt: Date = new Date(),
) {
  const providers = [
    {
      id: "deepseek",
      name: "DeepSeek",
      configured: isConfigured(environment.DEEPSEEK_API_KEY),
    },
    {
      id: "openai",
      name: "OpenAI",
      configured: isConfigured(environment.OPENAI_API_KEY, environment.chatgpt, environment.openIA),
    },
    {
      id: "gemini",
      name: "Gemini",
      configured: isConfigured(environment.GEMINI_API_KEY),
    },
    {
      id: "storage",
      name: "Local storage",
      configured: true,
    },
  ];

  return {
    status: "runtime_configuration",
    source: "server",
    capturedAt: observedAt.toISOString(),
    freshness: "live_configuration",
    verification: "configuration_only",
    configuredCount: providers.filter((provider) => provider.configured).length,
    integrations: providers.map((provider) => ({
      ...provider,
      status: provider.configured ? "configured" : "not_configured",
      availability: "not_checked",
    })),
    truncated: false,
  };
}
