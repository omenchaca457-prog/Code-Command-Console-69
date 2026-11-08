import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, it } from "node:test";
import { createReplicationStatusRouter } from "./replication-status.ts";

describe("replication status route", () => {
  let server: ReturnType<typeof createServer> | undefined;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
    server = undefined;
  });

  it("exposes sanitized status with no-store caching", async () => {
    const app = express();
    app.use("/api", createReplicationStatusRouter(async () => ({
      primary: "ready",
      replica: "not_configured",
      replication: {
        state: "uninitialized",
        enabled: false,
        pending: 0,
        failed: 0,
        lagMs: null,
        lastSuccessAt: null,
        lastErrorCode: null,
      },
    })));
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server!.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/replication/status`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.deepEqual(body, {
      primary: "ready",
      replica: "not_configured",
      replication: {
        state: "uninitialized",
        enabled: false,
        pending: 0,
        failed: 0,
        lagMs: null,
        lastSuccessAt: null,
        lastErrorCode: null,
      },
    });
    assert.doesNotMatch(JSON.stringify(body), /password|host|user|connectionstring|secret/i);
  });
});
