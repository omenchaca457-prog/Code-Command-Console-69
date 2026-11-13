import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRuntimeIntegrationStatus } from "./deepseek-integrations.ts";

const observedAt = new Date("2026-11-08T12:34:56.000Z");

describe("runtime integration configuration", () => {
  it("reports missing providers and built-in local storage without claiming connectivity", () => {
    const result = getRuntimeIntegrationStatus({}, observedAt);
    assert.equal(result.status, "runtime_configuration");
    assert.equal(result.capturedAt, observedAt.toISOString());
    assert.equal(result.freshness, "live_configuration");
    assert.equal(result.verification, "configuration_only");
    assert.equal(result.configuredCount, 1);
    assert.deepEqual(result.integrations.map(({ id, configured, availability }) => ({
      id, configured, availability,
    })), [
      { id: "deepseek", configured: false, availability: "not_checked" },
      { id: "openai", configured: false, availability: "not_checked" },
      { id: "gemini", configured: false, availability: "not_checked" },
      { id: "storage", configured: true, availability: "not_checked" },
    ]);
  });

  it("uses each provider's own configuration and never serializes values or paths", () => {
    const environment = {
      DEEPSEEK_API_KEY: "fake-deepseek-value",
      OPENAI_API_KEY: "fake-openai-value",
      GEMINI_API_KEY: "fake-gemini-value",
      DATA_DIR: "/private/local/directory",
      UNRELATED_KEY: "unrelated-private-value",
    };
    const result = getRuntimeIntegrationStatus(environment, observedAt);
    assert.equal(result.configuredCount, 4);
    assert.ok(result.integrations.every((provider) => provider.status === "configured"));
    const serialized = JSON.stringify(result);
    for (const value of Object.values(environment)) assert.ok(!serialized.includes(value));
    assert.ok(!serialized.includes("UNRELATED_KEY"));
  });

  it("does not treat an OpenAI key or a platform proxy key as DeepSeek configuration", () => {
    const result = getRuntimeIntegrationStatus({
      OPENAI_API_KEY: "fake-openai-value",
      AI_INTEGRATIONS_OPENAI_API_KEY: "fake-platform-value",
    }, observedAt);
    assert.equal(result.integrations.find(({ id }) => id === "deepseek")?.configured, false);
    assert.equal(result.integrations.find(({ id }) => id === "openai")?.configured, true);
    assert.equal(getRuntimeIntegrationStatus({ AI_INTEGRATIONS_OPENAI_API_KEY: "fake-platform-value" }, observedAt)
      .integrations.find(({ id }) => id === "openai")?.configured, false);
  });

  it("reads changes on every call and ignores empty configuration", () => {
    const environment = { DEEPSEEK_API_KEY: "  " };
    assert.equal(getRuntimeIntegrationStatus(environment, observedAt).configuredCount, 1);
    environment.DEEPSEEK_API_KEY = "fake-new-value";
    assert.equal(getRuntimeIntegrationStatus(environment, observedAt).configuredCount, 2);
    assert.equal(getRuntimeIntegrationStatus({ deepseek: "a", chatgpt: "b", gemini: "c" }, observedAt)
      .configuredCount, 2);
  });
});
