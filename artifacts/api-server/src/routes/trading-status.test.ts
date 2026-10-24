import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it } from "node:test";
import express from "express";
import { createTradingStatusRouter, OFFLINE_TRADING_STATUS, tradingStatePath } from "./trading-status.ts";

it("resolves the project-root state file independently of the API working directory", () => {
  const path = tradingStatePath();
  assert.equal(tradingStatePath(join(dirname(path), "artifacts", "api-server")), path);
  assert.equal(tradingStatePath(join(dirname(path), "artifacts", "devterminal")), path);
});

it("reads live Python state, uses defaults only when absent, and exposes invalid files as errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trading-status-"));
  const stateFile = join(directory, "maquina_4105_state.json");
  const app = express();
  app.use("/api", createTradingStatusRouter(stateFile));
  const server = createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/trading-status`;
  try {
    const missing = await fetch(url);
    assert.equal(missing.status, 200);
    assert.deepEqual(await missing.json(), OFFLINE_TRADING_STATUS);
    assert.match(missing.headers.get("cache-control") ?? "", /no-store/);
    const online = { ...OFFLINE_TRADING_STATUS, status: "online", capital: 105.5,
      pnl: 5.5, trades: 20, wins: 13, losses: 7, winrate: 65, position: 1,
      last_trade: "Python supplied metadata" };
    await writeFile(stateFile, JSON.stringify(online));
    const first = await fetch(url);
    assert.deepEqual(await first.json(), online);
    const paused = { ...online, capital: 49, pnl: -51, position: -1, paused: true };
    await writeFile(stateFile, JSON.stringify(paused));
    const next = await fetch(url, { headers: { "If-None-Match": first.headers.get("etag") ?? "*" } });
    assert.equal(next.status, 200);
    assert.deepEqual(await next.json(), paused);
    for (const invalid of ["", "{", "null", '{"status":"online"}',
      JSON.stringify({ ...online, position: 2 }),
      JSON.stringify({ ...online, trades: 0.5 }),
      JSON.stringify({ ...online, paused: "false" })]) {
      await writeFile(stateFile, invalid);
      const response = await fetch(url);
      assert.equal(response.status, 503);
      const errorBody = await response.json() as { error: unknown };
      assert.equal(typeof errorBody.error, "string");
      assert.equal(await readFile(stateFile, "utf8"), invalid);
    }
    await rm(stateFile);
    assert.deepEqual(await (await fetch(url)).json(), OFFLINE_TRADING_STATUS);
    await writeFile(stateFile, JSON.stringify(online));
    const unreadable = express();
    unreadable.use("/api", createTradingStatusRouter(directory));
    const other = createServer(unreadable).listen(0, "127.0.0.1");
    await once(other, "listening");
    try {
      const otherAddress = other.address();
      assert.ok(otherAddress && typeof otherAddress !== "string");
      assert.equal((await fetch(`http://127.0.0.1:${otherAddress.port}/api/trading-status`)).status, 503);
    } finally {
      other.closeAllConnections();
      await new Promise<void>(resolve => other.close(() => resolve()));
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
