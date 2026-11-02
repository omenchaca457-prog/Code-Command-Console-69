import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, it } from "node:test";
import { createRateLimiter } from "../lib/rate-limit.ts";

async function startServer(app: express.Express): Promise<{ server: Server; url: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("API rate limiter", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
    server = undefined;
  });

  it("limits a client during the window and allows requests after reset", async () => {
    let now = 1_000;
    const app = express();
    app.use(createRateLimiter({
      scope: "test",
      maxRequests: 2,
      windowMs: 1_000,
      now: () => now,
    }));
    app.get("/", (_req, res) => res.json({ ok: true }));
    const started = await startServer(app);
    server = started.server;

    assert.equal((await fetch(started.url)).status, 200);
    assert.equal((await fetch(started.url)).status, 200);
    const limited = await fetch(started.url);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "1");

    now += 1_000;
    assert.equal((await fetch(started.url)).status, 200);
  });
});
