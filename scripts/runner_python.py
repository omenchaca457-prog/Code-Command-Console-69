
# ============================================================
# PROTOCOLO 4105 – MÁQUINA DE DINERO v2
# + Slippage + Comisiones altas
# + Tamaño de posición dinámico
# ============================================================

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from runner_python_core import Ledger, ProviderFailure, analyze_with_fallback, atomic_json, compute_omega, save_analysis

parser = argparse.ArgumentParser(description="PROTOCOLO 4105: simulación sintética, sin órdenes reales")
DEFAULT_HEADLESS = not sys.stdout.isatty() or not bool(os.environ.get("DISPLAY"))
parser.add_argument("--headless", action=argparse.BooleanOptionalAction, default=DEFAULT_HEADLESS)
parser.add_argument("--cycles", type=int, default=2000 if DEFAULT_HEADLESS else 0,
                    help="0 = continuo, solo con interfaz gráfica; servidor = 2000 por defecto")
parser.add_argument("--ai-probe", action=argparse.BooleanOptionalAction, default=True,
                    help="Una sonda Gemini con fallback DeepSeek al finalizar; --no-ai-probe para modo offline")
parser.add_argument("--report", help="Ruta JSON para el informe reproducible")
parser.add_argument("--analysis-output", help="Ruta JSON; solo se almacena una respuesta completa")
parser.add_argument("--coherence-evidence", help="JSON con criterion, laminar_operations (bool[]) y seal_s")
args = parser.parse_args()
if args.cycles < 0 or (args.headless and args.cycles == 0):
    parser.error("--headless requiere --cycles mayor que cero")
if args.headless:
    os.environ["MPLBACKEND"] = "Agg"

import numpy as np
import matplotlib.pyplot as plt
from statsmodels.regression.linear_model import OLS
from statsmodels.tools import add_constant

plt.style.use('dark_background')
plt.ion()

# ============================================================
# PARÁMETROS DE TRADING
# ============================================================
Z_ENTRY = 1.5
Z_EXIT = 0.30
HEDGE_RATIO = 1.01
N_BARS = 500
UPDATE_SPEED = 1.7
BASE_USELESS = 0.1453
BASE_FART = 0.1478
NOISE_LEVEL = 0.0055

# --- Máquina de Dinero v2 ---
CAPITAL_INICIAL = 1000.0

# Comisiones + Slippage (más realistas / más caras)
COMISION = 0.0025          # 0.25% por lado
SLIPPAGE = 0.0015          # 0.15% de slippage promedio

# Tamaño de posición dinámico
MIN_SIZE = 0.15            # mínimo 15% del capital
MAX_SIZE = 0.35            # máximo 35% del capital
# El tamaño crece cuando el |Z| es más extremo

# ============================================================
# SELLOS
# ============================================================
ECR = 410542503
T_SEAL = 9990314159
np.random.seed(int(str(ECR)[:9]) % (2**32 - 1))

print("=" * 65)
print("PROTOCOLO 4105 – MÁQUINA DE DINERO v2")
print("SIMULACIÓN SINTÉTICA: no envía órdenes ni usa dinero real")
print("Slippage + Comisiones altas + Size dinámico")
print(f"Capital inicial: ${CAPITAL_INICIAL:.2f}")
print("Ctrl+C para detener")
print("=" * 65)

def half_life(spread):
    delta = np.diff(spread)
    lag = spread[:-1]
    X = add_constant(lag)
    model = OLS(delta, X).fit()
    beta = model.params[1]
    if beta >= 0:
        return np.inf
    return -np.log(2) / beta

# Estado
capital = CAPITAL_INICIAL
ledger = Ledger(CAPITAL_INICIAL, COMISION, SLIPPAGE)
position = 0
entry_spread = 0.0
entry_capital = 0.0
equity_curve = [CAPITAL_INICIAL]
trades = 0
wins = 0

fig = None if args.headless else plt.figure(figsize=(16, 11))
ciclo = 0
residual_returns = []
t = np.arange(N_BARS)
# Una única historia inicial; cada ciclo añade una barra, no regenera el pasado.
x = np.maximum(BASE_USELESS * (1 + 0.10 * np.sin(0.018 * t) +
    np.cumsum(np.random.normal(0, NOISE_LEVEL, N_BARS))), 1e-6)
y = np.maximum(BASE_FART * (1 + 0.09 * np.sin(0.017 * t + 0.3) +
    np.cumsum(np.random.normal(0, NOISE_LEVEL * 1.05, N_BARS))), 1e-6)

try:
    while args.cycles == 0 or ciclo < args.cycles:
        ciclo += 1
        step = N_BARS + ciclo
        return_x = 0.001 * np.sin(0.018 * step) + np.random.normal(0, NOISE_LEVEL)
        return_y = 0.001 * np.sin(0.017 * step + 0.3) + np.random.normal(0, NOISE_LEVEL * 1.05)
        next_x = max(x[-1] * (1 + return_x), 1e-6)
        next_y = max(y[-1] * (1 + return_y), 1e-6)
        residual_returns.append(float(next_y / y[-1] - 1 - HEDGE_RATIO * (next_x / x[-1] - 1)))
        x = np.append(x[1:], next_x)
        y = np.append(y[1:], next_y)

        spread = y - HEDGE_RATIO * x
        spread = spread - np.mean(spread)

        spread_std = np.std(spread)
        if not np.isfinite(spread_std) or spread_std <= 1e-12:
            raise ValueError("Spread inválido: no se inventará un Z-Score ni un Ω")
        zscore = (spread - np.mean(spread)) / spread_std
        current_z = zscore[-1]
        current_spread = spread[-1]
        hl = half_life(spread)
        r = np.corrcoef(x, y)[0, 1]

        # ====================================================
        # TAMAÑO DINÁMICO
        # ====================================================
        # Mientras más extremo el Z, más grande la posición
        strength = min(abs(current_z) / 3.0, 1.0)
        size = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * strength

        accion = "—"

        # ====================================================
        # LÓGICA DE ENTRADA / SALIDA + COSTOS
        # ====================================================
        if ledger.position is None:
            if current_z > Z_ENTRY:
                ledger.enter(-1, float(x[-1]), float(y[-1]), ledger.capital * size, HEDGE_RATIO, cycle=ciclo)
                trades += 1
                accion = f"SHORT ({size*100:.0f}%)"
            elif current_z < -Z_ENTRY:
                ledger.enter(1, float(x[-1]), float(y[-1]), ledger.capital * size, HEDGE_RATIO, cycle=ciclo)
                trades += 1
                accion = f"LONG ({size*100:.0f}%)"
        else:
            if abs(current_z) < Z_EXIT:
                ledger.close(float(x[-1]), float(y[-1]), cycle=ciclo)
                accion = "CERRAR"

        # Liquidar al final incluye también los costos de salida pendientes.
        if args.cycles and ciclo == args.cycles and ledger.position is not None:
            ledger.close(float(x[-1]), float(y[-1]), cycle=ciclo)
            accion = "CERRAR FINAL"
        position = ledger.position.direction if ledger.position else 0
        capital = ledger.equity(float(x[-1]), float(y[-1]))
        wins = sum(trade["net_pnl"] > 0 for trade in ledger.closed)
        equity_curve.append(capital)
        winrate = (wins / len(ledger.closed) * 100) if ledger.closed else 0
        if not ledger.accounting_seal():
            raise ArithmeticError("Falló la conservación contable; ejecución detenida")
        if capital <= 0:
            break
        if args.headless:
            continue

        # ====================================================
        # DIBUJAR
        # ====================================================
        fig.clf()

        ax1 = fig.add_subplot(2, 3, 1)
        ax1.plot(x, color="#00bfff", label="USELESS", lw=1.1)
        ax1.plot(y, color="#ff6b6b", label="FARTCOIN", lw=1.1)
        ax1.set_title(f"USELESS vs FARTCOIN | Ciclo {ciclo}", fontsize=11)
        ax1.legend(fontsize=8)
        ax1.grid(True, alpha=0.2)

        ax2 = fig.add_subplot(2, 3, 2)
        ax2.plot(spread, color="#00ff9f", lw=1.0)
        ax2.axhline(0, color="white", ls="--", alpha=0.5)
        ax2.set_title(f"Spread | HL={hl:.1f}d", fontsize=11)
        ax2.grid(True, alpha=0.2)

        ax3 = fig.add_subplot(2, 3, 3)
        ax3.plot(zscore, color="#ffd700", lw=1.0)
        ax3.axhline(0, color="white", ls="--", alpha=0.5)
        ax3.axhline(Z_ENTRY, color="red", ls=":", alpha=0.8)
        ax3.axhline(-Z_ENTRY, color="red", ls=":", alpha=0.8)
        ax3.axhline(Z_EXIT, color="lime", ls=":", alpha=0.6)
        ax3.axhline(-Z_EXIT, color="lime", ls=":", alpha=0.6)
        ax3.set_title(f"Z-Score | {current_z:.2f}", fontsize=11)
        ax3.grid(True, alpha=0.2)

        ax4 = fig.add_subplot(2, 3, 4)
        ax4.plot(equity_curve, color="#00ff9f", lw=1.8)
        ax4.axhline(CAPITAL_INICIAL, color="white", ls="--", alpha=0.5)
        ax4.set_title(f"EQUITY | ${capital:.2f}", fontsize=11)
        ax4.grid(True, alpha=0.2)

        ax5 = fig.add_subplot(2, 3, 5)
        ax5.axis("off")
        pos_text = "LONG" if position == 1 else "SHORT" if position == -1 else "FLAT"
        txt = f"""
MÁQUINA DE DINERO v2

Capital actual : ${capital:.2f}
PnL total      : ${capital - CAPITAL_INICIAL:+.2f}
Return         : {(capital/CAPITAL_INICIAL - 1)*100:+.1f}%

Posición       : {pos_text}
Size actual    : {size*100:.0f}%
Trades         : {trades}
Winrate        : {winrate:.1f}%
Última acción  : {accion}

Costos:
Comisión       : {COMISION*100:.2f}%
Slippage       : {SLIPPAGE*100:.2f}%
        """
        ax5.text(0.05, 0.5, txt, fontsize=11, family="monospace",
                 color="#00ff9f", va="center")

        ax6 = fig.add_subplot(2, 3, 6)
        ax6.axis("off")
        color = "#00ff9f" if capital >= CAPITAL_INICIAL else "#ff5555"
        ax6.text(0.5, 0.5, f"MÁQUINA v2\nACTIVA\n\n${capital:.2f}\n\nSize Dinámico\n+ Slippage",
                 fontsize=13, ha="center", va="center", color=color, family="monospace")

        plt.suptitle(f"4105 MÁQUINA v2 | ${capital:.2f} | Size {size*100:.0f}% | {pos_text}",
                     color="#00ffcc", fontsize=13)
        plt.tight_layout()
        plt.pause(UPDATE_SPEED)

        print(f"[CICLO {ciclo}] ${capital:.2f} | {pos_text} | Size {size*100:.0f}% | Z={current_z:.2f} | WR={winrate:.0f}%")

except KeyboardInterrupt:
    print("\n[STATUS] Máquina detenida.")
    print(f"[STATUS] Capital final: ${capital:.2f}")
    print(f"[STATUS] PnL: ${capital - CAPITAL_INICIAL:+.2f}")
    print("[STATUS] Coherencia Eterna mantenida.")
    if not args.headless:
        plt.ioff()
        plt.show()

if ledger.position is not None:
    ledger.close(float(x[-1]), float(y[-1]), cycle=ciclo)
capital = ledger.capital
laminar_rate = None
seal_s = None
criterion = None
if args.coherence_evidence:
    evidence = json.loads(Path(args.coherence_evidence).read_text(encoding="utf-8"))
    labels = evidence.get("laminar_operations")
    criterion = evidence.get("criterion")
    if (not isinstance(labels, list) or len(labels) != len(ledger.closed) or
            not labels or not all(type(label) is bool for label in labels) or
            not isinstance(criterion, str) or not criterion.strip() or
            type(evidence.get("seal_s")) is not bool):
        raise ValueError("La evidencia debe clasificar cada operación cerrada, definir el criterio y Sello S")
    laminar_rate = sum(labels) / len(labels)
    seal_s = evidence["seal_s"]
residual_volatility = float(np.std(residual_returns, ddof=1)) if len(residual_returns) > 1 else None
effective_commission = ledger.commission_paid / ledger.turnover if ledger.turnover else None
realized_slippage = ledger.slippage_paid / ledger.turnover if ledger.turnover else None
net_return = capital / CAPITAL_INICIAL - 1
omega = compute_omega(net_return, laminar_rate, realized_slippage,
                      effective_commission, residual_volatility, seal_s)
conditional_coefficient = None
if ledger.turnover and residual_volatility is not None:
    # Algebraic coefficient, NOT an observed laminar rate or proof of Sello S.
    conditional_coefficient = compute_omega(
        net_return, 1.0, realized_slippage, effective_commission, residual_volatility, True)
report = {
    "source": "synthetic_seeded_simulation",
    "captured_at": datetime.now(timezone.utc).isoformat(),
    "seed": int(str(ECR)[:9]) % (2**32 - 1),
    "cycles": ciclo,
    "closed_trades": len(ledger.closed),
    "trades": ledger.closed,
    "initial_capital": CAPITAL_INICIAL, "final_capital": capital,
    "gross_pnl": ledger.gross_pnl,
    "net_pnl": capital - CAPITAL_INICIAL,
    "net_return": net_return,
    "commission_paid": ledger.commission_paid, "slippage_paid": ledger.slippage_paid,
    "turnover_both_legs_entry_and_exit": ledger.turnover,
    "commission_effective": effective_commission, "slippage_real": realized_slippage,
    "residual_volatility": residual_volatility,
    "laminar_success_rate": laminar_rate,
    "seal_s": seal_s, "laminar_criterion": criterion,
    "accounting_conservation": ledger.accounting_seal(),
    "omega_nucleo": omega,
    "omega_conditional_if_seal_s_true": {
        "coefficient_times_unknown_laminar_rate": conditional_coefficient,
        "range_for_laminar_rate_0_to_1": sorted([0.0, conditional_coefficient])
        if conditional_coefficient is not None else None,
        "note": "Relación algebraica condicional, no un Ω medido ni una clasificación de estabilidad.",
    },
    "omega_state": "measured_simulation_no_stability_threshold" if omega is not None else "N/D",
    "execution_state": "stable" if ledger.accounting_seal() and capital > 0 else "failed",
    "limitations": [
        "Precios sintéticos, no rendimiento ni slippage observados en un mercado real.",
        "Comisión 0.25% y slippage 0.15% por lado sobre el notional bruto de ambas piernas.",
        "No incluye funding, préstamo, restricciones de margen ni riesgo de contraparte.",
        "Sin clasificación de turbulencia ni evidencia de Sello S no se inventa Ω.",
        "Conservación contable no equivale a incompressibilidad física ni prueba Sello S.",
        "Una medición aislada de Ω no define estabilidad: falta un umbral o ventana temporal.",
    ],
}
if args.ai_probe:
    try:
        analysis = analyze_with_fallback(
            "Audita brevemente este informe de simulación. No ejecutes código ni afirmes rentabilidad "
            "real o estabilidad de Ω si faltan evidencias. Responde en español, máximo 80 palabras.\n" +
            json.dumps(report, allow_nan=False),
            gemini_key=os.environ.get("GEMINI_API_KEY"),
            deepseek_key=os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY"),
        )
        if args.analysis_output:
            save_analysis(args.analysis_output, analysis)
        report["analysis"] = analysis
    except Exception as error:
        report["analysis"] = {"complete": False, "error_type": type(error).__name__,
                              "reason": str(error) if isinstance(error, ProviderFailure) else "analysis_or_storage_failed"}
        report["execution_state"] = "degraded"
if args.report:
    atomic_json(args.report, report)
print(json.dumps(report, ensure_ascii=False, allow_nan=False))