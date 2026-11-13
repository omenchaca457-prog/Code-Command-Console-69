import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { describe, it, type TestContext } from "node:test";
import { createImageStorage } from "../lib/image-storage.ts";
import { createOpenAiRouter as createBaseOpenAiRouter, getOpenAiFailureMessage } from "./openai.ts";

function createOpenAiRouter(overrides: Parameters<typeof createBaseOpenAiRouter>[0] = {}) {
  return createBaseOpenAiRouter({ markAgentIdle: async () => {}, ...overrides });
}

describe("POST /openai/chat", () => {
  it("shows a safe, actionable message when OpenAI rejects the key", () => {
    const message = getOpenAiFailureMessage(
      Object.assign(new Error("401 invalid_api_key secret-not-for-display"), {
        status: 401,
        code: "invalid_api_key",
      }),
    );
    assert.equal(
      message,
      "OpenAI rechazó la credencial. Actualiza OPENAI_API_KEY en el entorno del servidor.",
    );
    assert.doesNotMatch(message, /secret-not-for-display/);
  });

  it("distinguishes exhausted OpenAI credits from a temporary rate limit", () => {
    assert.equal(
      getOpenAiFailureMessage({ status: 429, code: "credit_balance_exhausted" }),
      "La cuenta o proyecto de OpenAI agotó sus créditos. Revisa la facturación de OpenAI.",
    );
    assert.equal(
      getOpenAiFailureMessage({ status: 429, code: "rate_limit_exceeded" }),
      "OpenAI alcanzó su límite de solicitudes. Inténtalo de nuevo más tarde.",
    );
  });

  it("streams the final decision and records the OpenAI-Master neural event", async () => {
    let stateRead = false;
    let recordedDecision = "";
    let returnedToIdle = false;
    const router = createOpenAiRouter({
      markAgentIdle: async () => { returnedToIdle = true; },
      getApiKey: () => "test-key",
      loadAgentStates: async () => {
        stateRead = true;
        return [{
          id: "worker-1",
          name: "Worker",
          status: "active",
          xp: 3,
          failedAnalyses: 0,
          lastOmega: 0.91,
          lastFailure: null,
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }];
      },
      streamCompletion: async function* ({ prompt, agents, agentResults }) {
        assert.equal(prompt, "Coordina los agentes");
        assert.equal(agents[0]?.id, "worker-1");
        assert.deepEqual(agentResults, [
          { agent: "DeepSeek", status: "completed", response: "Hallazgo técnico." },
          { agent: "Gemini", status: "failed", response: "", error: "No disponible." },
        ]);
        yield { choices: [{ delta: { content: "Prioriza " } }] };
        yield { choices: [{ delta: { content: "el agente activo." } }] };
      },
      persistAndPublishDecision: async (decision) => {
        recordedDecision = decision;
        return "delivered";
      },
    });
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/openai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Coordina los agentes",
          agentResults: [
            { agent: "DeepSeek", status: "completed", response: "Hallazgo técnico." },
            { agent: "Gemini", status: "failed", response: "", error: "No disponible." },
          ],
        }),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
      const body = await response.text();
      assert.match(body, /"content":"Prioriza "/);
      assert.match(body, /"content":"el agente activo\."/);
      assert.match(body, /"agent":"ORQUESTADOR-OPENAI","node":"OpenAI-Master","eventStatus":"delivered"/);
      assert.equal(returnedToIdle, true);
      assert.equal(stateRead, true);
      assert.equal(recordedDecision, "Prioriza el agente activo.");
    } finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });

  it("returns a final order when both analysis agents fail", async () => {
    const failedAgents = [
      { agent: "DeepSeek", status: "failed", response: "", error: "Proveedor no disponible." },
      { agent: "Gemini", status: "failed", response: "", error: "Tiempo de espera agotado." },
    ];
    let persistedDecision = "";
    const router = createOpenAiRouter({
      getApiKey: () => "test-key",
      loadAgentStates: async () => [],
      streamCompletion: async function* ({ agentResults }) {
        assert.deepEqual(agentResults, failedAgents);
        yield { choices: [{ delta: { content: "Orden de contingencia: reintentar con contexto mínimo." } }] };
      },
      persistAndPublishDecision: async (decision) => {
        persistedDecision = decision;
        return "delivered";
      },
    });
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/openai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Coordina aunque fallen los dos agentes",
          agentResults: failedAgents,
        }),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
      const body = await response.text();
      assert.match(body, /"content":"Orden de contingencia: reintentar con contexto mínimo\."/);
      assert.match(body, /"agent":"ORQUESTADOR-OPENAI","node":"OpenAI-Master","eventStatus":"delivered"/);
      assert.equal(persistedDecision, "Orden de contingencia: reintentar con contexto mínimo.");
    } finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });

  it("keeps the final decision visible when neural-event persistence fails", async () => {
    const router = createOpenAiRouter({
      getApiKey: () => "test-key",
      loadAgentStates: async () => [],
      streamCompletion: async function* () {
        yield { choices: [{ delta: { content: "Orden final conservada." } }] };
      },
      persistAndPublishDecision: async () => "persistence_failed",
    });
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/openai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Coordina los agentes" }),
      });
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.match(body, /"content":"Orden final conservada\."/);
      assert.match(body, /"agent":"ORQUESTADOR-OPENAI","node":"OpenAI-Master","eventStatus":"persistence_failed"/);
    } finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });

  it("rejects an empty prompt before streaming", async () => {
    const app = express();
    app.use(express.json());
    app.use(createOpenAiRouter({ getApiKey: () => "test-key" }));
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/openai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: " " }),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: "Escribe una instrucción para el orquestador.",
      });
    } finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });
});

describe("POST /openai/image", () => {
  it("stores and returns the generated image URL for a valid prompt", async () => {
    let receivedPrompt = "";
    const app = express();
    app.use(express.json());
    app.use(createOpenAiRouter({
      getApiKey: () => "test-key",
      generateImage: async ({ prompt }) => {
        receivedPrompt = prompt;
        return Buffer.from("mock-png").toString("base64");
      },
      storeImage: async () => "123e4567-e89b-12d3-a456-426614174000",
    }));
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/openai/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "  Neon observatory  " }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        url: "/api/openai/image/123e4567-e89b-12d3-a456-426614174000",
      });
      assert.equal(receivedPrompt, "Neon observatory");
    } finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });
});

async function startImageServer(
  t: TestContext,
  overrides: Parameters<typeof createBaseOpenAiRouter>[0],
): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use("/api", createOpenAiRouter(overrides));
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

describe("GET /openai/image/:imageId", () => {
  it("serves locally generated PNG bytes at the existing image URL with private caching", async (t) => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "devterminal-image-route-"));
    t.after(() => rm(dataDirectory, { recursive: true, force: true }));
    const storage = createImageStorage(dataDirectory);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const baseUrl = await startImageServer(t, {
      getApiKey: () => "test-key",
      generateImage: async () => png.toString("base64"),
      storeImage: storage.storeImage,
      loadImage: storage.loadImage,
    });

    const generated = await fetch(`${baseUrl}/api/openai/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Neon observatory" }),
    });
    assert.equal(generated.status, 200);
    const { url } = await generated.json() as { url: string };
    assert.match(url, /^\/api\/openai\/image\/[0-9a-f-]{36}$/);
    const response = await fetch(`${baseUrl}${url}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("cache-control"), "private, max-age=31536000, immutable");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  });

  it("returns 404 for missing images and rejects invalid IDs before reading storage", async (t) => {
    const reads: string[] = [];
    const baseUrl = await startImageServer(t, {
      loadImage: async (id) => { reads.push(id); return null; },
    });
    const id = "123e4567-e89b-12d3-a456-426614174000";

    for (const imageId of ["-".repeat(36), "not-an-image", id]) {
      const response = await fetch(`${baseUrl}/api/openai/image/${imageId}`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Imagen no encontrada." });
    }
    assert.deepEqual(reads, [id]);
  });

  it("returns a safe 500 response when image storage fails", async (t) => {
    const baseUrl = await startImageServer(t, {
      loadImage: async () => { throw new Error("EACCES /private/data/creator/image.png"); },
    });
    const response = await fetch(`${baseUrl}/api/openai/image/123e4567-e89b-12d3-a456-426614174000`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "No se pudo cargar la imagen." });
    assert.equal(response.headers.get("cache-control"), null);
  });
});
