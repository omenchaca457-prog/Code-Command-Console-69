import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

const services = [
  {
    name: "API Server",
    packageName: "@workspace/api-server",
    env: { NODE_ENV: "development", PORT: process.env.API_PORT || "3000" },
  },
  {
    name: "DevTerminal",
    packageName: "@workspace/devterminal",
    env: { NODE_ENV: "development", PORT: process.env.WEB_PORT || "21612", BASE_PATH: "/", API_PROXY_TARGET: `http://127.0.0.1:${process.env.API_PORT || "3000"}` },
  },
];

const children = [];
let shuttingDown = false;

function stopAll(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

for (const service of services) {
  const child = spawn(
    "pnpm",
    ["--filter", service.packageName, "run", "dev"],
    {
      env: { ...process.env, WORKSPACE_ROOT: root, ...service.env },
      stdio: "inherit",
      detached: true,
    },
  );

  children.push(child);
  child.once("error", (error) => {
    process.stderr.write(`[${service.name}] No se pudo iniciar: ${error.message}\n`);
    process.exitCode = 1;
    stopAll("SIGTERM");
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      process.stderr.write(
        `[${service.name}] terminó inesperadamente (${signal ?? code ?? "sin código"}).\n`,
      );
      process.exitCode = code ?? 1;
      stopAll("SIGTERM");
    }
  });
}

process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));
