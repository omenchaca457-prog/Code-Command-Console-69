import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import express from "express";
import { describe, it } from "node:test";
import { createGeminiRouter } from "./gemini.ts";

async function withServer(router: express.Router, run: (baseUrl: string) => Promise<void>) {
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

describe("Gemini chat route", () => {
  it("sends the Spanish role prompt and returns Gemini text as JSON", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const router = createGeminiRouter({
      getApiKey: () => "test-only-key",
      fetch: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Contexto de prueba." }] } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Resume la tendencia." }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { text: "Contexto de prueba." });
    });

    assert.equal(
      requestUrl,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    );
    assert.equal(new Headers(requestInit?.headers).get("x-goog-api-key"), "test-only-key");
    const body = JSON.parse(String(requestInit?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    assert.match(body.contents[0].parts[0].text, /Eres el ojo de la red/);
    assert.match(body.contents[0].parts[0].text, /Resume la tendencia/);
  });

  it("returns a clear configuration error without calling Google when no key exists", async () => {
    let called = false;
    const router = createGeminiRouter({
      getApiKey: () => undefined,
      fetch: async () => {
        called = true;
        return new Response();
      },
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Pregunta" }),
      });
      assert.equal(response.status, 503);
      const body = await response.json() as { error: string };
      assert.match(body.error, /GEMINI_API_KEY/);
    });

    assert.equal(called, false);
  });

  it("rejects empty prompts before making an upstream request", async () => {
    const router = createGeminiRouter({
      getApiKey: () => "test-only-key",
      fetch: async () => {
        throw new Error("No debe realizar la llamada");
      },
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "  " }),
      });
      assert.equal(response.status, 400);
    });
  });
});
