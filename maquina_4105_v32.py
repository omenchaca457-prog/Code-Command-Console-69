#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Máquina 4105: PAPER trading only. Start explicitly; never starts on import.

See docs/maquina-4105.md for dependencies, state format and limitations.
"""

import signal
import time
from datetime import datetime

import numpy as np
import requests

from maquina_4105_state import State

MODE = "PAPER"
CAPITAL_INICIAL = 100.0
COMISION = 0.0025
SLIPPAGE = 0.0015
MIN_SIZE = 0.05
MAX_SIZE = 0.15
Z_ENTRY = 1.8
Z_EXIT = 0.4
STOP_LOSS = 0.04
TAKE_PROFIT = 0.07
PRODUCT_A = "SOL-USD"
PRODUCT_B = "ETH-USD"
LOOKBACK = 120
MIN_CAPITAL_PROTECCION = 50.0

state = State(CAPITAL_INICIAL)


def get_candles(product_id, granularity="ONE_MINUTE", limit=LOOKBACK):
    end = int(time.time())
    start = end - (limit * 60)
    url = f"https://api.coinbase.com/api/v3/brokerage/market/products/{product_id}/candles"
    params = {
        "start": str(start), "end": str(end),
        "granularity": granularity, "limit": limit,
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        candles = response.json().get("candles", [])
        return [float(c["close"]) for c in reversed(candles)]
    except Exception as error:
        print(f"[ERROR] Candles {product_id}: {error}")
        return []


def get_ticker_price(product_id):
    url = f"https://api.coinbase.com/api/v3/brokerage/market/products/{product_id}/ticker"
    try:
        response = requests.get(url, params={"limit": 1}, timeout=8)
        response.raise_for_status()
        trades = response.json().get("trades", [])
        if trades:
            return float(trades[0]["price"])
    except Exception as error:
        print(f"[ERROR] Ticker {product_id}: {error}")
    return None


def get_market_data():
    closes_a = get_candles(PRODUCT_A)
    closes_b = get_candles(PRODUCT_B)
    if len(closes_a) < 30 or len(closes_b) < 30:
        pa = get_ticker_price(PRODUCT_A)
        pb = get_ticker_price(PRODUCT_B)
        if pa and pb:
            return {
                "z": 0.0, "spread": pb - pa, "price_a": pa,
                "price_b": pb, "hedge": 1.0, "ready": False,
            }
        return None
    n = min(len(closes_a), len(closes_b))
    a = np.array(closes_a[-n:])
    b = np.array(closes_b[-n:])
    hedge = float(np.polyfit(a, b, 1)[0])
    raw_spread = b - hedge * a
    demeaned = raw_spread - np.mean(raw_spread)
    z = (demeaned[-1] - np.mean(demeaned)) / (np.std(demeaned) + 1e-9)
    return {
        "z": float(z), "spread": float(raw_spread[-1]),
        "price_a": float(a[-1]), "price_b": float(b[-1]),
        "hedge": hedge, "ready": True,
    }


def dynamic_size(z):
    strength = min(abs(z) / 3.0, 1.0)
    return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * strength


def process(data):
    # Strategy and accounting retained from the uploaded paper bot.
    z = data["z"]
    size = dynamic_size(z)
    action = None
    reason = ""
    pnl = 0.0
    if state.capital < MIN_CAPITAL_PROTECCION:
        if not state.paused:
            state.paused = True
            print(f"\n[PROTECCIÓN] Capital ${state.capital:.2f} < ${MIN_CAPITAL_PROTECCION:.0f}")
            print("[PROTECCIÓN] Bot en PAUSA. No se abrirán nuevas posiciones.")
            state.save()
        if state.position == 0:
            return "PAUSADO", "capital < 50"
    if state.position == 0 and data.get("ready", True) and not state.paused:
        if z > Z_ENTRY or z < -Z_ENTRY:
            state.hedge_ratio = data["hedge"]
            state.entry_spread = data["price_b"] - state.hedge_ratio * data["price_a"]
            state.entry_capital = state.capital * size
            cost = state.entry_capital * (COMISION + SLIPPAGE)
            state.capital -= (state.entry_capital + cost)
            if z > Z_ENTRY:
                state.position = -1
                action = f"SHORT {size*100:.0f}%"
            else:
                state.position = 1
                action = f"LONG {size*100:.0f}%"
            state.trades += 1
            reason = f"Z={z:.2f} | hedge={state.hedge_ratio:.4f}"
    elif state.position != 0:
        spread = data["price_b"] - state.hedge_ratio * data["price_a"]
        pnl_pct = (spread - state.entry_spread) / (abs(state.entry_spread) + 1e-9)
        pnl = state.entry_capital * pnl_pct * state.position
        if pnl_pct * state.position <= -STOP_LOSS:
            action, reason = "STOP-LOSS", f"{(pnl / state.entry_capital) * 100:.1f}%"
        elif pnl_pct * state.position >= TAKE_PROFIT:
            action, reason = "TAKE-PROFIT", f"{(pnl / state.entry_capital) * 100:.1f}%"
        elif abs(z) < Z_EXIT:
            action, reason = "CERRAR Z", f"Z={z:.2f}"
        if action:
            cost_exit = abs(state.entry_capital + pnl) * (COMISION + SLIPPAGE)
            state.capital += (state.entry_capital + pnl - cost_exit)
            if pnl > 0:
                state.wins += 1
            else:
                state.losses += 1
            state.position = 0
            state.entry_capital = 0.0
            state.entry_spread = 0.0
            state.hedge_ratio = 0.0
    if action and action != "PAUSADO":
        state.history.append({
            "time": datetime.now().isoformat(), "action": action, "reason": reason,
            "z": round(z, 3), "pnl": round(pnl, 2), "capital": round(state.capital, 2),
        })
        state.save()
    return action, reason


def dashboard(ciclo, data, action, reason):
    pos = {1: "LONG ", -1: "SHORT", 0: "FLAT "}[state.position]
    pnl_total = state.capital - CAPITAL_INICIAL
    status = "⏸ PAUSADO" if state.paused else "▶ ACTIVO"
    print(f"\n{'='*72}")
    print(f"  MÁQUINA 4105 v3.2.2 | PAPER | {status} | Ciclo {ciclo:04d}")
    print(f"{'='*72}")
    print(f"  {PRODUCT_A}: ${data['price_a']:,.4f} | {PRODUCT_B}: ${data['price_b']:,.2f}")
    print(f"  Z-Score: {data['z']:7.2f} | Posición: {pos}")
    print(f"  Capital: ${state.capital:8.2f} | PnL: ${pnl_total:+.2f}")
    print(f"  Trades: {state.trades:3d} (W:{state.wins} L:{state.losses}) | Winrate: {state.winrate:.1f}%")
    if state.position != 0:
        print(f"  Hedge fijo: {state.hedge_ratio:.6f} | Entry Spread: {state.entry_spread:.6f}")
    if action:
        print(f"  → {action} ({reason})")
    print(f"{'='*72}")


def run():
    if MODE != "PAPER":
        raise RuntimeError("Este programa admite exclusivamente PAPER; no envía órdenes reales.")
    print("=" * 72)
    print("PROTOCOLO 4105 – v3.2.2 | PAPER | $100 | SOL/ETH")
    print(f"Pares: {PRODUCT_A} / {PRODUCT_B}")
    print(f"Comisión: {COMISION*100:.2f}% + slippage: {SLIPPAGE*100:.2f}% por entrada/salida")
    print(f"Size: {MIN_SIZE*100:.0f}% – {MAX_SIZE*100:.0f}% | SL/TP: -{STOP_LOSS*100:.0f}%/+{TAKE_PROFIT*100:.0f}%")
    print(f"Protección: pausa si capital < ${MIN_CAPITAL_PROTECCION:.0f}")
    print(f"Archivo del panel: {state.state_file}")
    if state.load():
        print(f"[INFO] Estado cargado → ${state.capital:.2f}")
        if state.capital < MIN_CAPITAL_PROTECCION:
            state.paused = True
    else:
        print("[INFO] Nuevo estado iniciado con $100")

    def stop(_signum, _frame):
        raise KeyboardInterrupt

    # A graceful SIGTERM, like Ctrl+C, must not leave the monitor ONLINE.
    previous_sigterm = signal.signal(signal.SIGTERM, stop)
    ciclo = 0
    try:
        state.status = "online"
        state.save()
        print("Ctrl+C para detener y guardar\n")
        while True:
            ciclo += 1
            data = get_market_data()
            if data is None:
                print("[WARN] Sin datos, reintentando en 10s...")
                state.save()
                time.sleep(10)
                continue
            action, reason = process(data)
            if ciclo % 2 == 0 or action:
                dashboard(ciclo, data, action, reason)
            # Update the monitor even when no trade occurred.
            state.save()
            time.sleep(30)
    except KeyboardInterrupt:
        print("\n[STATUS] Detenido por el operador.")
    finally:
        try:
            state.status = "offline"
            state.save()
            print(f"[STATUS] Estado guardado. Capital: ${state.capital:.2f} | PnL: ${state.capital-CAPITAL_INICIAL:+.2f}")
        finally:
            signal.signal(signal.SIGTERM, previous_sigterm)


if __name__ == "__main__":
    run()
