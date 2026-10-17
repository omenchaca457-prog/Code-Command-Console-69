import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import type OpenAI from "openai";
import {
  createDeepseekRouter,
  type DeepseekClient,
} from "./deepseek";

type MockChunk = {
  choices: Array<{ delta?: { content?: string | null } }>;
};

type MockCreate = (
  params: unknown,
  options: { signal: AbortSignal },
) => Promise<AsyncIterable<MockChunk>>;

function mockClient(create: MockCreate): DeepseekClient {
  return {
    chat: { completions: { create } },
  } as unknown as DeepseekClient;
}

function chunks(...deltas: string[]): AsyncIterable<MockChunk> {
  return (async function* () {
    for (const delta of deltas) {
      yield { choices: [{ delta: { content: delta } }] };
    }
  })();
}

async function startServer(router: ReturnType<typeof createDeepseekRouter>) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(express.json());
  app.use(router);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    url: `http://127.0.0.1:${address.port}/deepseek/chat`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function post(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("streams each provider delta as a separate SSE frame and ends with [DONE]", async (t) => {
  let capturedParams: unknown;
  let clientCreations = 0;
  const router = createDeepseekRouter({
    getApiKey: () => "simulated-test-key",
    createClient: (apiKey) => {
      assert.equal(apiKey, "simulated-test-key");
      clientCreations += 1;
      return mockClient(async (params) => {
        capturedParams = params;
        return chunks("Hola", " mundo");
      });
    },
  });
  const server = await startServer(router);
  t.after(server.close);

  const response = await post(server.url, {
    prompt: "Explica este fragmento",
    context: "const answer = 42;",
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  assert.equal(response.headers.get("x-ratelimit-limit"), "10");
  assert.equal(response.headers.get("x-ratelimit-remaining"), "9");
  assert.match(body, /data: \{"delta":"Hola"\}\n\n/);
  assert.match(body, /data: \{"delta":" mundo"\}\n\n/);
  assert.ok(body.endsWith("data: [DONE]\n\n"));
  assert.equal(clientCreations, 1);

  const messages = (capturedParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)
    .messages;
  assert.equal(messages.at(-1)?.content, "Contexto del usuario:\nconst answer = 42;\n\nPregunta:\nExplica este fragmento");
  assert.equal(
    (capturedParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming)
      .max_tokens,
    2048,
  );
});

test("ends a completed empty provider stream cleanly", async (t) => {
  const router = createDeepseekRouter({
    getApiKey: () => "simulated-test-key",
    createClient: () => mockClient(async () => chunks()),
  });
  const server = await startServer(router);
  t.after(server.close);

  const response = await post(server.url, { prompt: "Pregunta válida" });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(body, "data: [DONE]\n\n");
});

test("rejects invalid prompts before creating a provider client", async (t) => {
  let clientCreations = 0;
  const router = createDeepseekRouter({
    getApiKey: () => "simulated-test-key",
    createClient: () => {
      clientCreations += 1;
      return mockClient(async () => chunks());
    },
  });
  const server = await startServer(router);
  t.after(server.close);

  for (const body of [{}, { prompt: "   " }, { prompt: "x".repeat(8001) }]) {
    const response = await post(server.url, body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Escribe una pregunta válida." });
  }
  assert.equal(clientCreations, 0);
});

test("limits requests per client and allows new requests after the window", async (t) => {
  let currentTime = 0;
  let providerCalls = 0;
  const router = createDeepseekRouter({
    getApiKey: () => "simulated-test-key",
    createClient: () =>
      mockClient(async () => {
        providerCalls += 1;
        return chunks("Listo");
      }),
    rateLimitRequests: 2,
    rateLimitWindowMs: 60_000,
    getClientIdentifier: (req) =>
      String(req.headers["x-test-client"] ?? "cliente-predeterminado"),
    now: () => currentTime,
  });
  const server = await startServer(router);
  t.after(server.close);

  const clientAHeaders = { "x-test-client": "cliente-a" };
  for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
    const response = await post(
      server.url,
      { prompt: "Pregunta válida" },
      clientAHeaders,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
    await response.text();
  }

  const limitedResponse = await post(
    server.url,
    { prompt: "Una consulta adicional" },
    clientAHeaders,
  );
  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(await limitedResponse.json(), {
    error:
      "Has alcanzado el límite de consultas. Inténtalo de nuevo cuando termine el tiempo de espera.",
  });
  assert.equal(limitedResponse.headers.get("retry-after"), "60");
  assert.equal(limitedResponse.headers.get("x-ratelimit-limit"), "2");
  assert.equal(limitedResponse.headers.get("x-ratelimit-remaining"), "0");
  assert.equal(limitedResponse.headers.get("x-ratelimit-reset"), "60");
  assert.equal(providerCalls, 2);

  const otherClientResponse = await post(
    server.url,
    { prompt: "Pregunta válida" },
    { "x-test-client": "cliente-b" },
  );
  assert.equal(otherClientResponse.status, 200);
  await otherClientResponse.text();

  currentTime = 60_000;
  const afterWindowResponse = await post(
    server.url,
    { prompt: "Pregunta válida" },
    clientAHeaders,
  );
  assert.equal(afterWindowResponse.status, 200);
  await afterWindowResponse.text();
  assert.equal(providerCalls, 4);
});

test("reports insufficient provider balance as an SSE error", async (t) => {
  const insufficientBalance = Object.assign(new Error("insufficient balance"), {
    status: 402,
  });
  const router = createDeepseekRouter({
    getApiKey: () => "simulated-test-key",
    createClient: () =>
      mockClient(async () => {
        throw insufficientBalance;
      }),
  });
  const server = await startServer(router);
  t.after(server.close);

  const response = await post(server.url, { prompt: "Pregunta válida" });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    body,
    /data: \{"error":"La cuenta de DeepSeek no tiene saldo disponible\. Añade saldo o configura otra clave\."\}\n\n/,
  );
  assert.doesNotMatch(body, /\[DONE\]/);
});

test("aborts the provider stream when the requesting client disconnects", async (t) => {
  let providerSignal: AbortSignal | undefined;
  let abortObserved: (() => void) | undefined;
  const abortReceived = new Promise<void>((resolve) => {
    abortObserved = resolve;
  });
  const router = createDeepseekRouter({
    getApiKey: () => "simulated-test-key",
    createClient: () =>
      mockClient(async (_params, options) => {
        providerSignal = options.signal;
        return (async function* () {
          yield { choices: [{ delta: { content: "Primero" } }] };
          await new Promise<void>((resolve) => {
            if (options.signal.aborted) {
              resolve();
              return;
            }
            options.signal.addEventListener("abort", () => resolve(), { once: true });
          });
          abortObserved?.();
        })();
      }),
  });
  const server = await startServer(router);
  t.after(server.close);

  const response = await fetch(server.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Detén esta consulta" }),
  });
  assert.ok(response.body);

  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(new TextDecoder().decode(firstChunk.value), 'data: {"delta":"Primero"}\n\n');

  await reader.cancel();
  await Promise.race([
    abortReceived,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("El proveedor no recibió la cancelación.")), 2000),
    ),
  ]);
  assert.equal(providerSignal?.aborted, true);
});
