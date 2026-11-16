import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import express from "express";
import ollamaRouter from "./ollama.ts";

const oldEnabled = process.env.OLLAMA_LOCAL_ENABLED;
const oldFetch = globalThis.fetch;
afterEach(() => {
  if (oldEnabled === undefined) delete process.env.OLLAMA_LOCAL_ENABLED;
  else process.env.OLLAMA_LOCAL_ENABLED = oldEnabled;
  globalThis.fetch = oldFetch;
});

async function request(headers: Record<string, string> = {}, body: unknown = { prompt: "Hola" }) {
  const app = express();
  app.use(express.json());
  app.use(ollamaRouter);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const response = await oldFetch(`http://127.0.0.1:${address.port}/ollama/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as { response?: string; error?: string } };
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
}

describe("OMEGA Lite local security", () => {
  it("is disabled by default without an explicit opt-in", async () => {
    delete process.env.OLLAMA_LOCAL_ENABLED;
    assert.equal((await request()).status, 503);
  });
  it("rejects forwarded requests without calling Ollama", async () => {
    process.env.OLLAMA_LOCAL_ENABLED = "1";
    globalThis.fetch = async () => { throw new Error("Must not contact Ollama"); };
    assert.equal((await request({ "X-Forwarded-For": "8.8.8.8" })).status, 403);
  });
  it("rejects nonlocal Host and Origin", async () => {
    process.env.OLLAMA_LOCAL_ENABLED = "1";
    assert.equal((await request({ Host: "external.example" })).status, 403);
    assert.equal((await request({ Origin: "https://external.example" })).status, 403);
  });
  it("rejects invalid prompts before contacting the model", async () => {
    process.env.OLLAMA_LOCAL_ENABLED = "1";
    assert.equal((await request({}, { prompt: "" })).status, 400);
    assert.equal((await request({}, { prompt: "x".repeat(8001) })).status, 400);
  });
  it("returns a validated local model response without caching", async () => {
    process.env.OLLAMA_LOCAL_ENABLED = "1";
    let upstreamCalls = 0;
    globalThis.fetch = async (input, init) => {
      upstreamCalls += 1;
      assert.equal(String(input), "http://127.0.0.1:11434/api/generate");
      const payload = JSON.parse(String(init?.body)) as { model: string; stream: boolean };
      assert.equal(payload.model, "omega4105-lite");
      assert.equal(payload.stream, false);
      return new Response(JSON.stringify({ response: "Hola desde OMEGA" }), { status: 200 });
    };
    const result = await request();
    assert.equal(result.status, 200);
    assert.equal(result.data.response, "Hola desde OMEGA");
    assert.equal(upstreamCalls, 1);
  });
});
