import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it } from "node:test";
import express from "express";
import { createTradingStatusRouter, tradingStatePath } from "./trading-status.ts";

it("serves Python-produced snapshots without importing or running the bot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trading-python-contract-"));
  const stateFile = join(directory, "state.json");
  const python = (code: string) => {
    const result = spawnSync("python", ["-c", code, stateFile], {
      cwd: dirname(tradingStatePath()), encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  };
  try {
    // Only the standard-library state writer executes. No strategy, market
    // requests or real project-root state file is involved.
    python([
      "import sys",
      "from maquina_4105_state import State",
      "s = State(state_file=sys.argv[1])",
      "s.status = 'online'",
      "s.capital = 49; s.paused = True",
      "s.trades = 20; s.wins = 13; s.losses = 7",
      "s.position = -1; s.entry_capital = 10",
      "s.entry_spread = 2.5; s.hedge_ratio = 4",
      "s.save()",
    ].join("\n"));
    const app = express();
    app.use("/api", createTradingStatusRouter(stateFile));
    const server = createServer(app).listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const url = `http://127.0.0.1:${address.port}/api/trading-status`;
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      const data = await response.json() as Record<string, unknown>;
      assert.deepEqual({
        status: data.status, capital: data.capital, pnl: data.pnl,
        trades: data.trades, wins: data.wins, losses: data.losses,
        winrate: data.winrate, position: data.position, paused: data.paused,
      }, {
        status: "online", capital: 49, pnl: -51, trades: 20,
        wins: 13, losses: 7, winrate: 65, position: -1, paused: true,
      });
      assert.equal(data.mode, "paper");
      python("import sys\nfrom maquina_4105_state import State\ns=State(state_file=sys.argv[1])\ns.load()\ns.save()");
      const stopped = await fetch(url, {
        headers: { "If-None-Match": response.headers.get("etag") ?? "*" },
      });
      assert.equal(stopped.status, 200);
      assert.equal((await stopped.json() as Record<string, unknown>).status, "offline");
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
