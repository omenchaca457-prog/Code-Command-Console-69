import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import { it } from "node:test";
import { disableTelemetryCache } from "./telemetry-cache.ts";

it("marks telemetry no-store and ignores stale validators rather than returning 304", async () => {
  const app = express();
  app.use(disableTelemetryCache);
  app.get("/telemetry", (_req, res) => res.json({ running: true }));
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const url = `http://127.0.0.1:${address.port}/telemetry`;
    const first = await fetch(url);
    const etag = first.headers.get("etag");
    assert.match(first.headers.get("cache-control") ?? "", /no-store/);
    const next = await fetch(url, { headers: { "If-None-Match": etag ?? "*" } });
    assert.equal(next.status, 200);
    assert.deepEqual(await next.json(), { running: true });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
