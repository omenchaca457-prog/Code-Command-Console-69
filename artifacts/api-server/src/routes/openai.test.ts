import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import { describe, it } from "node:test";
import { createOpenAiRouter } from "./openai.ts";

describe("POST /openai/chat", () => {
  it("streams the final decision and records the OpenAI-Master neural event", async () => {
    let stateRead = false;
    let recordedDecision = "";
    const router = createOpenAiRouter({
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
      assert.equal(stateRead, true);
      assert.equal(recordedDecision, "Prioriza el agente activo.");
    } finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  });

  it("streams the final decision when DeepSeek fails and reports pending neural-event delivery", async () => {
    let recordedDecision = "";
    const router = createOpenAiRouter({
      getApiKey: () => "test-key",
      loadAgentStates: async () => [],
      streamCompletion: async function* ({ agentResults }) {
        assert.deepEqual(agentResults, [
          { agent: "DeepSeek", status: "failed", response: "", error: "Tiempo de espera agotado." },
          { agent: "Gemini", status: "completed", response: "Hallazgo de contexto." },
        ]);
        yield { choices: [{ delta: { content: "Continúa con el análisis de contexto." } }] };
      },
      persistAndPublishDecision: async (decision) => {
        recordedDecision = decision;
        return "persisted_only";
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
            { agent: "DeepSeek", status: "failed", response: "", error: "Tiempo de espera agotado." },
            { agent: "Gemini", status: "completed", response: "Hallazgo de contexto." },
          ],
        }),
      });
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.match(body, /"content":"Continúa con el análisis de contexto\."/);
      assert.match(body, /"agent":"ORQUESTADOR-OPENAI","node":"OpenAI-Master","eventStatus":"persisted_only"/);
      assert.equal(recordedDecision, "Continúa con el análisis de contexto.");
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
