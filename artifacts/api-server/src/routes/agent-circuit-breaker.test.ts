import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentCircuitBreaker } from "./agent-circuit-breaker.ts";

describe("AgentCircuitBreaker", () => {
  it("opens after repeated failures with capped exponential cooldown and resets on success", () => {
    const breaker = new AgentCircuitBreaker(3, 1000, 2500);
    assert.equal(breaker.recordFailure("optimizer", 10).remainingMs, 0);
    assert.equal(breaker.recordFailure("optimizer", 20).remainingMs, 0);
    assert.equal(breaker.recordFailure("optimizer", 30).remainingMs, 1000);
    assert.equal(breaker.remainingMs("optimizer", 100), 930);
    breaker.recordFailure("optimizer", 200);
    breaker.recordFailure("optimizer", 300);
    assert.equal(breaker.remainingMs("optimizer", 301), 2499);
    breaker.recordSuccess("optimizer");
    assert.equal(breaker.remainingMs("optimizer", 301), 0);
  });
});
