import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentCircuitBreaker, AgentCircuitBlockedError, AgentSafetyViolation, type AgentCircuitTransition } from "./agent-circuit-breaker.ts";

describe("AgentCircuitBreaker", () => {
  it("opens on three consecutive failures, blocks side effects, then audits one recovery", async () => {
    let now = 0;
    let calls = 0;
    const transitions: AgentCircuitTransition[] = [];
    const breaker = new AgentCircuitBreaker({
      recovery_timeout: 1000, now: () => now,
      onTransition: (event) => transitions.push(event),
    });
    const failing = async () => { calls++; throw new Error("provider timeout"); };
    for (let i = 0; i < 3; i++) await assert.rejects(breaker.execute("optimizer", failing));
    assert.equal(breaker.getSnapshot("optimizer").state, "OPEN");
    await assert.rejects(breaker.execute("optimizer", failing), AgentCircuitBlockedError);
    assert.equal(calls, 3);
    now = 999;
    assert.equal(breaker.getSnapshot("optimizer").remainingMs, 1);
    now = 1000;
    assert.equal(breaker.getSnapshot("optimizer").state, "HALF-OPEN");
    let release!: () => void;
    const audit = breaker.execute("optimizer", () => new Promise<void>((resolve) => { release = resolve; }));
    await assert.rejects(breaker.execute("optimizer", failing), AgentCircuitBlockedError);
    assert.equal(calls, 3);
    release();
    await audit;
    assert.equal(breaker.getSnapshot("optimizer").state, "CLOSED");
    assert.equal(breaker.getSnapshot("optimizer").consecutiveFailures, 0);
    assert.deepEqual(transitions.map((event) => event.state), ["OPEN", "HALF-OPEN", "CLOSED"]);
    assert.equal(transitions[0].consecutiveFailures, 3);
    assert.equal(transitions[0].agentId, "optimizer");
  });

  it("reopens immediately on a failed half-open audit and waits a full cooldown", async () => {
    let now = 0;
    const breaker = new AgentCircuitBreaker({ failureThreshold: 1, recovery_timeout: 100, now: () => now });
    const fail = async () => { throw new Error("failed"); };
    await assert.rejects(breaker.execute("security", fail));
    now = 100;
    await assert.rejects(breaker.execute("security", fail));
    assert.equal(breaker.getSnapshot("security").state, "OPEN");
    assert.equal(breaker.getSnapshot("security").remainingMs, 100);
  });

  it("opens immediately on verified safety drift and isolates agents", async () => {
    const breaker = new AgentCircuitBreaker();
    await assert.rejects(breaker.execute("coherence", async () => {
      throw new AgentSafetyViolation("Deriva de parámetros verificables.");
    }));
    assert.equal(breaker.getSnapshot("coherence").state, "OPEN");
    assert.equal(await breaker.execute("security", async () => "safe"), "safe");
    assert.equal(breaker.getSnapshot("security").state, "CLOSED");
  });

  it("resets consecutive failures only after a complete successful task", async () => {
    const breaker = new AgentCircuitBreaker({ failureThreshold: 2 });
    const fail = async () => { throw new Error("failure"); };
    await assert.rejects(breaker.execute("docs", fail));
    await breaker.execute("docs", async () => "valid and saved");
    await assert.rejects(breaker.execute("docs", fail));
    assert.equal(breaker.getSnapshot("docs").state, "CLOSED");
    assert.equal(breaker.getSnapshot("docs").consecutiveFailures, 1);
  });

  it("rejects invalid configuration and survives an alert observer failure", async () => {
    for (const value of [0, -1, 1.5, Infinity, NaN]) {
      assert.throws(() => new AgentCircuitBreaker({ failureThreshold: value }), RangeError);
      assert.throws(() => new AgentCircuitBreaker({ recovery_timeout: value }), RangeError);
    }
    const breaker = new AgentCircuitBreaker({
      failureThreshold: 1,
      onTransition() { throw new Error("logging unavailable"); },
    });
    await assert.rejects(breaker.execute("optimizer", async () => { throw new Error("task failed"); }));
    assert.equal(breaker.getSnapshot("optimizer").state, "OPEN");
  });
});
