import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getReplitIntegrationStatus } from "./deepseek-integrations.ts";

describe("Replit integration status", () => {
  it("reports only configured presence and clearly marks unverified connections", () => {
    const result = getReplitIntegrationStatus({
      OPENAI_API_KEY: "not-returned",
      GEMINI_API_KEY: "",
    });
    assert.equal(result.status, "runtime_presence_only");
    assert.deepEqual(
      result.integrations.map(({ name, status }) => ({ name, status })),
      [
        { name: "OpenAI", status: "configured" },
        { name: "Gemini", status: "not_configured" },
        { name: "GitHub", status: "not_verified" },
      ],
    );
    assert.doesNotMatch(JSON.stringify(result), /not-returned|secret|token/i);
    assert.match(result.verification, /no verifica/i);
  });
});
