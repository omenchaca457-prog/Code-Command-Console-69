import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Router } from "express";
import { GetTradingStatusResponse } from "@workspace/api-zod";
import { disableTelemetryCache } from "./telemetry-cache.ts";

export const OFFLINE_TRADING_STATUS = Object.freeze({
  status: "offline",
  capital: 100.0,
  pnl: 0.0,
  trades: 0,
  wins: 0,
  losses: 0,
  winrate: 0.0,
  position: 0,
  paused: false,
});

/** pnpm runs the API inside its artifact, not at the project root. */
export function tradingStatePath(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory);
  while (!existsSync(join(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error("No se encontró la raíz del proyecto para el estado de trading.");
    }
    directory = parent;
  }
  return join(directory, "maquina_4105_state.json");
}

export function createTradingStatusRouter(stateFile = tradingStatePath()) {
  const router = Router();
  router.get("/trading-status", disableTelemetryCache, async (req, res): Promise<void> => {
    let contents: string;
    try {
      contents = await readFile(stateFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.json(OFFLINE_TRADING_STATUS);
        return;
      }
      req.log?.warn({ event: "trading_state_unreadable" }, "No se pudo leer el estado de Máquina 4105");
      res.status(503).json({ error: "No se pudo leer el estado de trading." });
      return;
    }

    try {
      const state: unknown = JSON.parse(contents);
      const validated = GetTradingStatusResponse.parse(state);
      const numbers = [validated.capital, validated.pnl, validated.trades,
        validated.wins, validated.losses, validated.winrate, validated.position];
      if (!numbers.every(Number.isFinite) ||
          ![validated.trades, validated.wins, validated.losses].every(Number.isSafeInteger)) {
        throw new Error("Métricas de trading inválidas.");
      }
      // Preserve extra fields supplied by Python; never write or overwrite its file.
      res.json(state);
    } catch {
      req.log?.warn({ event: "trading_state_invalid" }, "Estado de Máquina 4105 vacío, incompleto o inválido");
      res.status(503).json({ error: "El archivo de estado de trading no contiene un estado válido." });
    }
  });
  return router;
}

export default createTradingStatusRouter();
