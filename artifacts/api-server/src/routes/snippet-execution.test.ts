import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { it } from "node:test";
import express from "express";
import { createSnippetExecutionRouter } from "./snippet-execution.ts";

it("validates ids, marks output simulated, and returns 404/500 without claiming success", async () => {
  const calls: number[] = [];
  const timestamp = new Date("2026-10-24T20:00:00.000Z");
  const app = express();
  app.use("/api", createSnippetExecutionRouter(async id => {
    calls.push(id);
    if (id === 2) return null;
    if (id === 3) throw new Error("Database unavailable");
    return {
      id, success: true as const, simulated: true as const,
      output: "Hello, DevTerminal!" as const, lastRunAt: timestamp,
    };
  }));
  const server = createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const post = (id: string) => fetch(
    `http://127.0.0.1:${address.port}/api/snippets/${id}/execute`, { method: "POST" },
  );
  try {
    for (const id of ["bad", "0", "-1", "1.5", "2147483648", "99999999999999999999999999999"]) {
      assert.equal((await post(id)).status, 400);
    }
    assert.deepEqual(calls, []);
    const response = await post("1");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: 1, success: true, simulated: true,
      output: "Hello, DevTerminal!", lastRunAt: timestamp.toISOString(),
    });
    assert.equal((await post("2")).status, 404);
    const failed = await post("3");
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: "Could not record simulated execution" });
    assert.deepEqual(calls, [1, 2, 3]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
