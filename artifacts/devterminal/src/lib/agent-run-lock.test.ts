import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentRunLock } from "./agent-run-lock.ts";

describe("AgentRunLock", () => {
  it("allows only one active request per agent until its response is saved", async () => {
    const lock = new AgentRunLock();
    let savedResponses = 0;

    const runAgent = async () => {
      if (!lock.acquire("optimizer")) return;
      try {
        await new Promise((resolve) => setTimeout(resolve, 10));
        savedResponses += 1;
      } finally {
        lock.release("optimizer");
      }
    };

    await Promise.all([runAgent(), runAgent()]);

    assert.equal(savedResponses, 1);
    assert.equal(lock.isActive("optimizer"), false);
  });

  it("allows the agent to run again after the previous request completes", () => {
    const lock = new AgentRunLock();

    assert.equal(lock.acquire("optimizer"), true);
    assert.equal(lock.acquire("optimizer"), false);
    lock.release("optimizer");
    assert.equal(lock.acquire("optimizer"), true);
  });
});
