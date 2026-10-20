import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import express from "express";
import { describe, it } from "node:test";
import {
  createDeepseekRouter,
} from "./deepseek.ts";
import type OpenAI from "openai";

type Chunk = OpenAI.Chat.Completions.ChatCompletionChunk;
type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;

function makeChunk(delta: Record<string, unknown>): Chunk {
  return {
    id: "simulated",
    object: "chat.completion.chunk",
    created: 0,
    model: "simulated",
    choices: [{ index: 0, delta, finish_reason: null, logprobs: null }],
  } as unknown as Chunk;
}

function toolCallChunk(values: {
  id?: string;
  name?: string;
  arguments?: string;
}) {
  return makeChunk({
    tool_calls: [{
      index: 0,
      ...(values.id ? { id: values.id } : {}),
      function: {
        ...(values.name ? { name: values.name } : {}),
        ...(values.arguments ? { arguments: values.arguments } : {}),
      },
    }],
  });
}

async function withServer(
  router: express.Router,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { log: { error: () => undefined } });
    next();
  });
  app.use(router);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function getEvents(body: string): Array<{ delta?: string; error?: string }> {
  return body
    .split(/\r?\n\r?\n/)
    .map((frame) =>
      frame
        .split(/\r?\n/)
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trimStart(),
    )
    .filter((data): data is string => Boolean(data && data !== "[DONE]"))
    .map((data) => JSON.parse(data) as { delta?: string; error?: string });
}

function parseTestBody(body: unknown) {
  if (!body || typeof body !== "object" || !("prompt" in body) ||
      typeof body.prompt !== "string") {
    return { success: false as const };
  }
  return {
    success: true as const,
    data: {
      prompt: body.prompt,
      context: "context" in body && typeof body.context === "string" ? body.context : undefined,
    },
  };
}

describe("SQ-AI simulated streaming route", () => {
  it("sends SSE immediately, bounds stalled context and delivers a token before completion", async () => {
    let releaseFinal!: () => void;
    const finalGate = new Promise<void>(resolve => { releaseFinal = resolve; });
    const router = createDeepseekRouter({
      getApiKey: () => "test-key",
      parseBody: async body => parseTestBody(body),
      contextTimeoutMs: 20,
      loadHistory: async () => new Promise<string>(() => {}),
      executeTool: async () => new Promise<string>(() => {}),
      createClient: () => ({ chat: { completions: { create: async () => (async function* () {
        yield makeChunk({ content: "Primer token" });
        await finalGate;
        yield makeChunk({ content: " final" });
      })() } } }),
    });
    await withServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/deepseek/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Prueba" }),
      });
      assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
      assert.ok(response.body);
      const reader = response.body.getReader();
      let text = "";
      const decoder = new TextDecoder();
      try {
        const deadline = AbortSignal.timeout(2000);
        while (!text.includes("Primer token")) {
          const read = reader.read();
          const chunk = await Promise.race([
            read,
            new Promise<never>((_, reject) => deadline.addEventListener("abort", () => reject(new Error("No first token")), { once: true })),
          ]);
          assert.equal(chunk.done, false);
          text += decoder.decode(chunk.value);
        }
        assert.ok(text.includes(": connected"));
        assert.ok(!text.includes('" final"'));
      } finally {
        releaseFinal();
        await reader.cancel();
      }
    });
  });

  it("retries an empty completion once with an 8192 token budget", async () => {
    let calls = 0;
    const router = createDeepseekRouter({
      getApiKey: () => "test-key",
      parseBody: async body => parseTestBody(body),
      loadHistory: async () => "",
      executeTool: async () => "{}",
      createClient: () => ({ chat: { completions: { create: async params => {
        assert.equal(params.max_tokens, 8192);
        calls += 1;
        return (async function* () {
          if (calls === 2) yield makeChunk({ content: "Recuperado" });
        })();
      } } } }),
    });
    await withServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/deepseek/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Prueba" }),
      });
      assert.deepEqual(getEvents(await response.text()), [{ delta: "Recuperado" }]);
      assert.equal(calls, 2);
    });
  });

  it("marks token-limited output as partial instead of completed analysis", async () => {
    const router = createDeepseekRouter({
      getApiKey: () => "test-key",
      parseBody: async body => parseTestBody(body),
      loadHistory: async () => "",
      executeTool: async () => "{}",
      createClient: () => ({ chat: { completions: { create: async () => (async function* () {
        yield makeChunk({ content: "Parcial" });
        const final = makeChunk({});
        final.choices[0]!.finish_reason = "length";
        yield final;
      })() } } }),
    });
    await withServer(router, async baseUrl => {
      const response = await fetch(`${baseUrl}/deepseek/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Prueba" }),
      });
      const events = getEvents(await response.text());
      assert.equal(events[0]?.delta, "Parcial");
      assert.match(events[1]?.error ?? "", /parcial/);
    });
  });

  it("streams every text fragment and assembles split tool-call fields before the next round", async () => {
    const requests: CreateParams[] = [];
    const executedTools: Array<[string, string]> = [];
    let requestIndex = 0;
    const router = createDeepseekRouter({
      getApiKey: () => "simulated-key",
      parseBody: async (body) => parseTestBody(body),
      loadHistory: async () => "historial simulado",
      executeTool: async (name, args) => {
        executedTools.push([name, args]);
        return name.startsWith("get_") ? "contexto simulado" : "resultado de herramienta";
      },
      createClient: () => ({
        chat: {
          completions: {
            create: async (params) => {
              requests.push(params);
              requestIndex += 1;
              if (requestIndex === 1) {
                return (async function* () {
                  yield makeChunk({ content: "Preparando " });
                  yield toolCallChunk({ id: "call_", name: "get_inte" });
                  yield toolCallChunk({
                    id: "1",
                    name: "grations_status",
                    arguments: '{"source"',
                  });
                  yield toolCallChunk({ arguments: ':"fake"}' });
                })();
              }
              return (async function* () {
                yield makeChunk({ content: "respuesta" });
                yield makeChunk({ content: " completa." });
              })();
            },
          },
        },
      }),
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/deepseek/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Prueba de streaming", context: "editor falso" }),
      });
      assert.equal(response.status, 200);
      const events = getEvents(await response.text());

      assert.deepEqual(
        events.flatMap((event) => (event.delta ? [event.delta] : [])),
        ["Preparando ", "respuesta", " completa."],
      );
      assert.equal(
        executedTools.filter(([name, args]) =>
          name === "get_integrations_status" && args !== "{}",
        ).length,
        1,
      );
      assert.deepEqual(executedTools.find(([name, args]) =>
        name === "get_integrations_status" && args !== "{}",
      ), [
        "get_integrations_status",
        '{"source":"fake"}',
      ]);
      assert.equal(requests.length, 2);
      assert.ok(
        JSON.stringify(requests[1]?.messages).includes("contexto simulado"),
        "la siguiente ronda debe recibir el resultado de la herramienta",
      );
    });
  });

  it("impone el máximo de rondas y fuerza la síntesis en la última petición", async () => {
    const requests: CreateParams[] = [];
    let userToolsExecuted = 0;
    const router = createDeepseekRouter({
      getApiKey: () => "simulated-key",
      parseBody: async (body) => parseTestBody(body),
      loadHistory: async () => "",
      executeTool: async (name) => {
        if (name === "get_workspace_snapshot" || name === "get_runtime_diagnostics" ||
            name === "get_library_snapshot" || name === "get_integrations_status" ||
            name === "get_neural_activity") {
          return "contexto";
        }
        userToolsExecuted += 1;
        return "acción simulada";
      },
      createClient: () => ({
        chat: {
          completions: {
            create: async (params) => {
              requests.push(params);
              return (async function* () {
                yield toolCallChunk({
                  id: `call-${requests.length}`,
                  name: "run_safe_command",
                  arguments: '{"command":"node_version"}',
                });
              })();
            },
          },
        },
      }),
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/deepseek/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "No excedas rondas" }),
      });
      const events = getEvents(await response.text());

      assert.equal(requests.length, 10);
      assert.equal(requests[9]?.tool_choice, "none");
      assert.equal(userToolsExecuted, 9);
      assert.ok(events.some((event) => event.error?.includes("síntesis final")));
    });
  });

  it("cancela la generación upstream al abortar DETENER sin enviar fragmentos posteriores", async () => {
    const clientAbort = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    let producedAfterAbort = false;
    let notifyUpstreamAbort: (() => void) | undefined;
    const upstreamAborted = new Promise<void>((resolve) => {
      notifyUpstreamAbort = resolve;
    });
    const router = createDeepseekRouter({
      getApiKey: () => "simulated-key",
      parseBody: async (body) => parseTestBody(body),
      loadHistory: async () => "",
      executeTool: async () => "contexto",
      createClient: () => ({
        chat: {
          completions: {
            create: async (_params, options) => {
              upstreamSignal = options.signal;
              options.signal.addEventListener("abort", () => notifyUpstreamAbort?.(), {
                once: true,
              });
              return (async function* () {
                yield makeChunk({ content: "fragmento visible" });
                await new Promise<void>((resolve) => {
                  if (options.signal.aborted) resolve();
                  else options.signal.addEventListener("abort", () => resolve(), { once: true });
                });
                if (options.signal.aborted) return;
                producedAfterAbort = true;
                yield makeChunk({ content: " no debe aparecer" });
              })();
            },
          },
        },
      }),
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/deepseek/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Cancela esta respuesta" }),
        signal: clientAbort.signal,
      });
      assert.ok(response.body);
      const reader = response.body.getReader();
      let received = "";
      while (!received.includes("fragmento visible")) {
        const result = await reader.read();
        if (result.done) break;
        received += new TextDecoder().decode(result.value);
      }
      assert.match(received, /fragmento visible/);

      clientAbort.abort();
      await Promise.race([
        upstreamAborted,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("El proveedor simulado no recibió la cancelación")), 1000),
        ),
      ]);
      assert.equal(upstreamSignal?.aborted, true);
      assert.equal(producedAfterAbort, false);
      await reader.cancel().catch(() => undefined);
    });
  });
});
