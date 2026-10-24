import React from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetTradingStatusQueryKey, type TradingStatus } from "@workspace/api-client-react";
import Trading from "./trading";

const offline: TradingStatus = {
  status: "offline", capital: 100, pnl: 0, trades: 0,
  wins: 0, losses: 0, winrate: 0, position: 0, paused: false,
};

function renderState(state?: TradingStatus) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (state) client.setQueryData(getGetTradingStatusQueryKey(), state);
  try {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(Trading)));
  } finally {
    client.clear();
  }
}

it("shows loading without claiming an initial balance or live bot", () => {
  const html = renderState();
  assert.match(html, /CONECTANDO/);
  assert.doesNotMatch(html, /\$100\.00|>ONLINE</);
});

it("shows the offline default, FLAT position and initial capital", () => {
  const html = renderState(offline);
  assert.match(html, /MÁQUINA 4105 \/\/ TRADING/);
  assert.match(html, /OFFLINE/);
  assert.match(html, /\$100\.00/);
  assert.match(html, /FLAT \(en espera\)/);
  assert.doesNotMatch(html, /BOT PAUSADO/);
});

it("shows online LONG, signed gains, percentage and trade outcomes", () => {
  const html = renderState({ ...offline, status: "ONLINE", capital: 105.5, pnl: 5.5,
    trades: 20, wins: 13, losses: 7, winrate: 65, position: 1 });
  for (const pattern of [/ONLINE/, /LONG/, /\$105\.50/, /\+\$5\.50/, /65\.0%/, /13W/, /7L/]) {
    assert.match(html, pattern);
  }
  assert.match(html, /#00ff41/);
});

it("shows SHORT, losses and the exact paused-capital warning", () => {
  const html = renderState({ ...offline, status: "online", capital: 49,
    pnl: -51, position: -1, paused: true });
  assert.match(html, /SHORT/);
  assert.match(html, /-\$51\.00/);
  assert.match(html, /#ff003c/);
  assert.match(html, /⏸ CAPITAL &lt; \$50 - BOT PAUSADO/);
});
