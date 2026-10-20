import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import { describe, it } from "node:test";
import { createAgentSimulationRouter } from "./agents-simulation.ts";
import { AgentCircuitBreaker } from "./agent-circuit-breaker.ts";

describe("synthetic agent analysis route", () => {
  it("guards Optimizer, Security and Coherencia across failure, freeze and controlled recovery", async () => {
    let now = 0;
    let fail = true;
    let drift = false;
    let calls = 0;
    const failures: string[] = [];
    const circuit = new AgentCircuitBreaker({ recovery_timeout: 1000, now: () => now });
    const app = express();
    app.use(express.json());
    app.use("/api", createAgentSimulationRouter({
      circuit,
      parseBody: (body) => ({ success: true, data: body as { agentId: string; vector: string; coherence: number } }),
      onFailure: async (agentId) => { failures.push(agentId); },
      completeTask: async (task) => {
        calls++;
        if (fail) throw new Error("simulated provider failure");
        return {
          ...task,
          vector: drift ? "9999" : task.vector,
          action: "Validación sintética completada.",
          omega: task.coherence / 100,
          xp: 1,
          status: "completed",
        };
      },
    }));
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const request = (agentId: string) => fetch(`http://127.0.0.1:${address.port}/api/agents/simulated-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, vector: "1234", coherence: 95 }),
    });
    try {
      for (const role of ["optimizer", "security", "coherence"]) {
        now = 0;
        fail = true;
        for (let i = 0; i < 3; i++) assert.equal((await request(role)).status, 502);
        assert.equal(circuit.getSnapshot(role).state, "OPEN");
        const callsBeforeBlocked = calls;
        const blocked = await request(role);
        assert.equal(blocked.status, 503);
        assert.equal(blocked.headers.get("Retry-After"), "1");
        assert.equal(calls, callsBeforeBlocked);
        now = 1000;
        fail = false;
        assert.equal((await request(role)).status, 200);
        assert.equal(circuit.getSnapshot(role).state, "CLOSED");
        assert.equal(circuit.getSnapshot(role).consecutiveFailures, 0);
      }
      assert.equal(failures.length, 9);
      drift = true;
      assert.equal((await request("coherence")).status, 502);
      assert.equal(circuit.getSnapshot("coherence").state, "OPEN");
      assert.equal((await request("coherence")).status, 503);
    } finally {
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
    }
  });

  it("completes a whitelisted high-coherence task and returns updated telemetry", async () => {
    const tasks: Array<{ agentId: string; vector: string; coherence: number }> = [];
    const app = express();
    app.use(express.json());
    app.use("/api", createAgentSimulationRouter({
      circuit: new AgentCircuitBreaker(),
      parseBody: (body) => {
        if (
          body && typeof body === "object" &&
          "agentId" in body && typeof body.agentId === "string" &&
          "vector" in body && typeof body.vector === "string" &&
          "coherence" in body && typeof body.coherence === "number"
        ) {
          return { success: true, data: { agentId: body.agentId, vector: body.vector, coherence: body.coherence } };
        }
        return { success: false };
      },
      completeTask: async (task) => {
        tasks.push({
          agentId: task.agentId,
          vector: task.vector,
          coherence: task.coherence,
        });
        return {
          ...task,
          action: "Validación sintética completada.",
          omega: task.coherence / 100,
          xp: 4,
          status: "completed",
        };
      },
    }));
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/agents/simulated-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "security",
          vector: "18446744073709551615",
          coherence: 95.5,
        }),
      });
      assert.equal(response.status, 200);
      const result = await response.json() as { agentName: string; xp: number; omega: number; status: string };
      assert.equal(result.agentName, "Security");
      assert.equal(result.xp, 4);
      assert.equal(result.omega, 0.955);
      assert.equal(result.status, "completed");
      assert.deepEqual(tasks, [{
        agentId: "security",
        vector: "18446744073709551615",
        coherence: 95.5,
      }]);

      const belowThreshold = await fetch(`http://127.0.0.1:${address.port}/api/agents/simulated-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "security", vector: "1234", coherence: 90 }),
      });
      assert.equal(belowThreshold.status, 400);
      assert.equal(tasks.length, 1);
    } finally {
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
    }
  });
});
