import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getReplitIntegrationStatus } from "./deepseek-integrations.ts";

describe("Replit integration status", () => {
  it("reports the Replit Agent snapshot with capture time and manual freshness", () => {
    const result = getReplitIntegrationStatus();
    assert.equal(result.status, "snapshot");
    assert.match(result.capturedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(result.freshness, "manual");
    assert.equal(result.addedCount, 0);
    assert.deepEqual(result.integrations, [
      { name: "GitHub", status: "authorized_not_added" },
    ]);
    assert.doesNotMatch(JSON.stringify(result), /token|secret|credential/i);
  });
});
