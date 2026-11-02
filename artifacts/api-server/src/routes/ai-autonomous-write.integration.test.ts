import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { relative, resolve, sep } from "node:path";
import express from "express";
import { describe, it } from "node:test";
import WebSocket from "ws";
import { attachTerminalWS } from "./terminal.ts";
import {
  createAiCodeChatRouter,
  type AiCodeChatDependencies,
} from "./ai-code-chat.ts";
import { createDeepseekRouter } from "./deepseek.ts";
import { createDeepseekToolExecutor } from "./deepseek-tools.ts";
import { writeProjectCode } from "./deepseek-tool-safety.ts";
import { createNeuralEventsStreamRouter } from "./neural-events-stream.ts";
import { NeuralEventHub, type NeuralEventRecord } from "./neural-event-hub.ts";
import type OpenAI from "openai";

type CompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;
type CompletionParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;

function makeChunk(delta: Record<string, unknown>): CompletionChunk {
  return {
    id: "test-completion",
    object: "chat.completion.chunk",
    created: 0,
    model: "test",
    choices: [{ index: 0, delta, finish_reason: null, logprobs: null }],
  } as unknown as CompletionChunk;
}

function toolCallChunk(id: string, args: string) {
  return makeChunk({
    tool_calls: [{
      index: 0,
      id,
      function: { name: "write_project_file", arguments: args },
    }],
  });
}

async function withServer(
  app: express.Express,
  run: (baseUrl: string) => Promise<void>,
  setup?: (server: ReturnType<typeof createServer>) => (() => void) | void,
) {
  const server = createServer(app);
  const cleanup = setup?.(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    cleanup?.();
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
}

async function createFixture() {
  const directory = await mkdtemp(resolve(process.cwd(), "src/routes/.sqai-write-"));
  const target = resolve(directory, "fixture.ts");
  await writeFile(target, "export const initial = true;\n");
  return {
    target,
    toolPath: relative(resolve(process.cwd(), "../.."), target).split(sep).join("/"),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function createSseReader(response: Response) {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    async nextEvent(): Promise<NeuralEventRecord> {
      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = frame.split(/\r?\n/).find((line) => line.startsWith("data:"));
          if (data) return JSON.parse(data.slice(5).trimStart()) as NeuralEventRecord;
          continue;
        }
        const result = await reader.read();
        if (result.done) throw new Error("El stream SSE terminó antes del evento.");
        buffer += decoder.decode(result.value, { stream: true });
      }
    },
    cancel: () => reader.cancel(),
  };
}

function makeDeepseekRoute(
  executeTool: (name: string, args: string) => Promise<string>,
  fixturePath: string,
  expectedContent: string,
) {
  let completionRound = 0;
  return createDeepseekRouter({
    getApiKey: () => "test-key",
    parseBody: async (body) => {
      if (!body || typeof body !== "object" || !("prompt" in body) ||
          typeof body.prompt !== "string") return { success: false };
      return {
        success: true,
        data: {
          prompt: body.prompt,
          context: "test context",
        },
      };
    },
    loadHistory: async () => "test history",
    executeTool: async (name, args) =>
      name === "write_project_file"
        ? executeTool(name, args)
        : "test context",
    createClient: () => ({
      chat: {
        completions: {
          create: async (_params: CompletionParams) => {
            completionRound += 1;
            return completionRound === 1
              ? (async function* () {
                  yield toolCallChunk(
                    "write-call",
                    JSON.stringify({ path: fixturePath, content: expectedContent }),
                  );
                })()
              : (async function* () {
                  yield makeChunk({ content: "Cambio aplicado." });
                })();
          },
        },
      },
    }),
  });
}

describe("SQ-AI autonomous write integration", () => {
  it("writes complete fixture contents from each route, streams the notices, and cleans up", async () => {
    const files = await Promise.all([
      createFixture(),
      createFixture(),
      createFixture(),
    ]);
    const expectedContents = [
      "export const directTool = 'complete';\n",
      "export const aiChat = 'complete';\n",
      "export const deepseekChat = 'complete';\n",
    ];
    let nextEventId = 1;
    const persistedEvents: NeuralEventRecord[] = [];
    const eventHub = new NeuralEventHub();
    const executor = createDeepseekToolExecutor({
      writeProjectCode,
      persistNeuralEvent: async (event) => {
        const created = {
          id: nextEventId++,
          ...event,
          origin: "terminal" as const,
          eventType: "autonomous_write" as const,
          createdAt: new Date(),
        };
        persistedEvents.push(created);
        return created;
      },
      publishNeuralEvent: async (event) => eventHub.publish(event),
    });

    let aiCompletionRound = 0;
    const aiDependencies: AiCodeChatDependencies = {
      parseBody: (body) =>
        body && typeof body === "object" && "message" in body &&
        typeof body.message === "string"
          ? { success: true, data: { message: body.message } }
          : { success: false },
      prepareConversation: async (message, systemPrompt) => ({
        conversationId: 501,
        history: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
      saveAssistantResponse: async () => undefined,
      createCompletion: async (_messages, tools) => {
        assert.ok(tools, "el chat de código debe ofrecer la herramienta de escritura");
        aiCompletionRound += 1;
        return aiCompletionRound === 1
          ? {
              choices: [{
                message: {
                  tool_calls: [{
                    id: "ai-write-call",
                    type: "function",
                    function: {
                      name: "write_project_file",
                      arguments: JSON.stringify({
                        path: files[1]!.toolPath,
                        content: expectedContents[1],
                      }),
                    },
                  }],
                },
              }],
            }
          : { choices: [{ message: { content: "Cambio aplicado." } }] };
      },
      executeTool: executor,
    };

    const deepseekRouter = makeDeepseekRoute(
      executor,
      files[2]!.toolPath,
      expectedContents[2]!,
    );
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.assign(req, { log: { error: () => undefined } });
      next();
    });
    app.use(createAiCodeChatRouter(aiDependencies));
    app.use(deepseekRouter);
    app.use(createNeuralEventsStreamRouter({
      hub: eventHub,
      loadEventsSince: async (afterId) =>
        persistedEvents.filter((event) => event.id > afterId),
    }));

    try {
      await withServer(app, async (baseUrl) => {
        const socket = new WebSocket(`${baseUrl.replace(/^http/, "ws")}/api/terminal/ws`);
        const ptyStatus = await new Promise<number>((resolve, reject) => {
          socket.once("unexpected-response", (_request, response) => {
            response.resume();
            if (typeof response.statusCode !== "number") {
              reject(new Error("La respuesta de bloqueo PTY no incluyó status HTTP."));
              return;
            }
            resolve(response.statusCode);
          });
          socket.once("open", () => reject(new Error("La ruta PTY se abrió sin autorización.")));
          socket.once("error", reject);
        });
        assert.equal(ptyStatus, 503);
        const streamResponse = await fetch(`${baseUrl}/neural-events/stream?after=0`);
        assert.equal(streamResponse.status, 200);
        const stream = createSseReader(streamResponse);

        const directResult = JSON.parse(await executor(
          "write_project_file",
          JSON.stringify({ path: files[0]!.toolPath, content: expectedContents[0] }),
        )) as { status: string };
        assert.equal(directResult.status, "written");
        assert.equal(await readFile(files[0]!.target, "utf8"), expectedContents[0]);
        const directEvent = await stream.nextEvent();
        assert.equal(directEvent.eventType, "autonomous_write");
        assert.match(directEvent.content, /fixture\.ts/);

        const aiResponse = await fetch(`${baseUrl}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Aplica el cambio completo." }),
        });
        assert.equal(aiResponse.status, 200);
        assert.deepEqual(await aiResponse.json(), {
          response: "Cambio aplicado.",
          conversationId: 501,
        });
        assert.equal(await readFile(files[1]!.target, "utf8"), expectedContents[1]);
        const aiEvent = await stream.nextEvent();
        assert.equal(aiEvent.eventType, "autonomous_write");
        assert.match(aiEvent.content, /fixture\.ts/);

        const deepseekResponse = await fetch(`${baseUrl}/deepseek/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Aplica este cambio completo." }),
        });
        assert.equal(deepseekResponse.status, 200);
        assert.match(await deepseekResponse.text(), /Cambio aplicado\./);
        assert.equal(await readFile(files[2]!.target, "utf8"), expectedContents[2]);
        const deepseekEvent = await stream.nextEvent();
        assert.equal(deepseekEvent.eventType, "autonomous_write");
        assert.match(deepseekEvent.content, /fixture\.ts/);

        await stream.cancel();
        socket.terminate();
      }, (server) => {
        const terminalServer = attachTerminalWS(server);
        return () => {
          for (const client of terminalServer.clients) client.terminate();
          terminalServer.close();
        };
      });
    } finally {
      await Promise.all(files.map((file) => file.cleanup()));
      for (const file of files) {
        await assert.rejects(readFile(file.target), { code: "ENOENT" });
      }
    }
  });
});
