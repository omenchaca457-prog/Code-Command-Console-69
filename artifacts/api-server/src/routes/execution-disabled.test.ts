import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, it } from "node:test";
import executeRouter from "./execute.ts";
import autorunRouter from "./autorun.ts";

async function startServer(app: express.Express): Promise<{ server: Server; url: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("unsafe execution routes", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
    server = undefined;
  });

  it("rejects execution, package installation, and auto-run even when consent is true", async () => {
    const app = express();
    app.use(express.json());
    app.use(executeRouter);
    app.use(autorunRouter);
    const started = await startServer(app);
    server = started.server;

    const requests = [
      ["/execute", { language: "javascript", code: "process.exit(1)" }],
      ["/install", { language: "python", packages: ["sample"] }],
      ["/ai/auto-run", { code: "print('no')", language: "python", consent: true }],
    ] as const;

    for (const [path, body] of requests) {
      const response = await fetch(`${started.url}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 503, path);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json() as { code: string }).code, "execution_disabled");
    }
  });

  it("keeps the language catalog available without enabling execution", async () => {
    const app = express();
    app.use(executeRouter);
    const started = await startServer(app);
    server = started.server;
    const response = await fetch(`${started.url}/languages`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray((await response.json() as { languages: unknown[] }).languages));
  });
});
