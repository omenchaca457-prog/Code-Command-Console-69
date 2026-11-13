import OpenAI from "openai";

export type TextAiProviderName = "deepseek" | "openai";
export type TextAiEnvironment = Readonly<Record<string, string | undefined>>;
export type TextAiConfiguration = {
  provider: TextAiProviderName;
  model: string;
  apiKey: string;
  baseURL: string;
};
export type TextAiProvider = {
  provider: TextAiProviderName;
  model: string;
  client: OpenAI;
};

export class TextAiUnavailableError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "TextAiUnavailableError";
  }
}

/** Resolve each provider's own credential; credentials never cross providers. */
export function getTextAiConfiguration(
  env: TextAiEnvironment = process.env,
): TextAiConfiguration {
  const selected = env.TEXT_AI_PROVIDER?.trim().toLowerCase();
  if (selected && selected !== "deepseek" && selected !== "openai") {
    throw new TextAiUnavailableError("TEXT_AI_PROVIDER debe ser deepseek u openai.");
  }
  const provider: TextAiProviderName = (selected as TextAiProviderName | undefined) || (env.DEEPSEEK_API_KEY?.trim() ? "deepseek" : "openai");
  const keyName = provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY";
  const apiKey = env[keyName]?.trim();
  if (!apiKey) {
    throw new TextAiUnavailableError(selected
      ? `La IA de texto no está disponible. Configura ${keyName} en el entorno del servidor.`
      : "La IA de texto no está disponible. Configura DEEPSEEK_API_KEY u OPENAI_API_KEY en el entorno del servidor.");
  }
  return {
    provider,
    apiKey,
    model: (provider === "deepseek" ? env.DEEPSEEK_MODEL : env.OPENAI_MODEL)?.trim()
      || (provider === "deepseek" ? "deepseek-chat" : "gpt-5.4"),
    baseURL: provider === "deepseek" ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1",
  };
}

type ClientFactory = (options: { apiKey: string; baseURL: string }) => OpenAI;

/** Injectable factory keeps provider routing verifiable without network requests. */
export function createTextAiProvider(
  env: TextAiEnvironment,
  createClient: ClientFactory = (options) => new OpenAI(options),
): TextAiProvider {
  const { provider, model, apiKey, baseURL } = getTextAiConfiguration(env);
  return { provider, model, client: createClient({ apiKey, baseURL }) };
}

const textClients = new Map<TextAiProviderName, { apiKey: string; client: OpenAI }>();

export function getTextAiProvider(): TextAiProvider {
  const { provider, model, apiKey, baseURL } = getTextAiConfiguration();
  let cached = textClients.get(provider);
  if (!cached || cached.apiKey !== apiKey) {
    cached = { apiKey, client: new OpenAI({ apiKey, baseURL }) };
    textClients.set(provider, cached);
  }
  return { provider, model, client: cached.client };
}

export function getTextAiClient(): OpenAI {
  return getTextAiProvider().client;
}

type TextCompletionParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  "model" | "max_tokens" | "max_completion_tokens"
>;
type TextCompletionOptions = NonNullable<Parameters<OpenAI["chat"]["completions"]["create"]>[1]> & {
  maxTokens?: number;
};

export async function createTextCompletion(
  params: TextCompletionParams,
  options: TextCompletionOptions = {},
  provider: TextAiProvider = getTextAiProvider(),
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const { maxTokens = 8192, ...requestOptions } = options;
  return provider.client.chat.completions.create({
    ...params,
    model: provider.model,
    ...(provider.provider === "deepseek"
      ? { max_tokens: maxTokens }
      : { max_completion_tokens: maxTokens }),
  }, requestOptions);
}

let openAiClient: { apiKey: string; client: OpenAI } | undefined;

/** OpenAI-only media features remain optional and never use a DeepSeek key. */
export function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TextAiUnavailableError("Esta función requiere OPENAI_API_KEY en el entorno del servidor.");
  }
  if (!openAiClient || openAiClient.apiKey !== apiKey) {
    openAiClient = { apiKey, client: new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" }) };
  }
  return openAiClient.client;
}

// Resolve optional media credentials only when an OpenAI feature is used.
export const openai = new Proxy({} as OpenAI, {
  get(_target, property) {
    const active = getOpenAiClient();
    const value = Reflect.get(active, property, active);
    return typeof value === "function" ? value.bind(active) : value;
  },
});
