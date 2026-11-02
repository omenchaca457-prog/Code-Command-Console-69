import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, it } from "node:test";
import { createHealthRouter } from "./health.ts";

async function startServer(app: express.Express): Promise<{ server: Server; url: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("health and readiness", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
    server = undefined;
  });

  it("keeps liveness healthy while reporting database failure as not ready", async () => {
    const app = express();
    app.use(createHealthRouter(async () => {
      const error = Object.assign(new Error("database offline"), { code: "ECONNREFUSED" });
      throw error;
    }));
    const started = await startServer(app);
    server = started.server;

    const live = await fetch(`${started.url}/healthz`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("cache-control"), "no-store");

    const ready = await fetch(`${started.url}/readyz`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), { status: "not_ready" });
    assert.equal(ready.headers.get("cache-control"), "no-store");
  });
});
