type RuntimeEnvironment = Record<string, string | undefined>;

function isConfigured(environment: RuntimeEnvironment, keys: string[]): boolean {
  return keys.some((key) => typeof environment[key] === "string" && environment[key]!.trim().length > 0);
}

export function getReplitIntegrationStatus(environment: RuntimeEnvironment = process.env) {
  return {
    status: "runtime_presence_only",
    verification: "La presencia de una variable no verifica que una conexión funcione.",
    integrations: [
      {
        name: "OpenAI",
        status: isConfigured(environment, ["OPENAI_API_KEY", "chatgpt", "openIA"])
          ? "configured"
          : "not_configured",
        verification: "credential_presence_only",
      },
      {
        name: "Gemini",
        status: isConfigured(environment, ["GEMINI_API_KEY"])
          ? "configured"
          : "not_configured",
        verification: "credential_presence_only",
      },
      {
        name: "GitHub",
        status: "not_verified",
        verification: "No hay una comprobación de conexión en vivo configurada en esta app.",
      },
    ],
  } as const;
}
