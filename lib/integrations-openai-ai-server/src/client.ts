import OpenAI from "openai";

let client: OpenAI | undefined;

/** Optional integrations must not prevent the terminal and editor from starting. */
export function getOpenAiClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.chatgpt || process.env.openIA;
  if (!apiKey) throw Object.assign(new Error("OpenAI no está configurado. Configura la integración en el servidor para utilizar esta función."), { status: 503 });
  client = new OpenAI({ apiKey, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1" });
  return client;
}

// Preserve the existing SDK surface while resolving credentials only on use.
export const openai = new Proxy({} as OpenAI, {
  get(_target, property) {
    const active = getOpenAiClient();
    const value = Reflect.get(active, property, active);
    return typeof value === "function" ? value.bind(active) : value;
  },
});
