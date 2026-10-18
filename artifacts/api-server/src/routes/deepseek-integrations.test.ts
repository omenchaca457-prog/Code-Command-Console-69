import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getReplitIntegrationStatus } from "./deepseek-integrations.ts";

const environment = {
  REPLIT_CONNECTORS_HOSTNAME: "connectors.replit.com",
  REPL_IDENTITY: "test-identity-never-return-this",
};

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Replit integration status", () => {
  it("reports an available empty list when there are no connections", async () => {
    const result = await getReplitIntegrationStatus(
      environment,
      async () => makeResponse(200, { items: [], total: 0, has_next_page: false }),
    );

    assert.deepEqual(result, {
      status: "available",
      integrations: [],
      truncated: false,
    });
  });

  it("returns only sanitized names and states, never connection secrets", async () => {
    const result = await getReplitIntegrationStatus(environment, async (input, init) => {
      assert.equal(new URL(String(input)).searchParams.get("include_secrets"), "false");
      assert.equal(new Headers(init?.headers).get("X_REPLIT_TOKEN"), `repl ${environment.REPL_IDENTITY}`);
      return makeResponse(200, {
        items: [
          {
            connector_name: "linear",
            status: "added",
            access_token: "must-not-escape",
            refresh_token: "must-not-escape-either",
          },
        ],
        has_next_page: false,
      });
    });

    assert.deepEqual(result, {
      status: "available",
      integrations: [{ name: "linear", status: "connected" }],
      truncated: false,
    });
    assert.equal(JSON.stringify(result).includes("must-not-escape"), false);
    assert.equal(JSON.stringify(result).includes(environment.REPL_IDENTITY), false);
  });

  it("follows pagination and marks results truncated at the safe result limit", async () => {
    let requests = 0;
    const result = await getReplitIntegrationStatus(environment, async () => {
      requests += 1;
      const offset = (requests - 1) * 50;
      return makeResponse(200, {
        items: Array.from({ length: 50 }, (_, index) => ({
          connector_name: `service-${offset + index}`,
        })),
        has_next_page: requests < 3,
      });
    });

    assert.equal(requests, 2);
    assert.equal(result.status, "available");
    if (result.status !== "available") return;
    assert.equal(result.integrations.length, 100);
    assert.equal(result.truncated, true);
  });

  it("reports permission errors without exposing the upstream response body", async () => {
    const result = await getReplitIntegrationStatus(
      environment,
      async () => new Response("sensitive upstream details", { status: 403 }),
    );

    assert.deepEqual(result, {
      status: "unavailable",
      reason: "permission_denied",
    });
    assert.equal(JSON.stringify(result).includes("sensitive"), false);
  });

  it("reports missing Replit identity as unavailable rather than an empty list", async () => {
    const result = await getReplitIntegrationStatus(
      { REPLIT_CONNECTORS_HOSTNAME: environment.REPLIT_CONNECTORS_HOSTNAME },
      async () => {
        throw new Error("Request should not be made without identity.");
      },
    );

    assert.deepEqual(result, {
      status: "unavailable",
      reason: "not_configured",
    });
  });
});
