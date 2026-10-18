import { spawn } from "node:child_process";

const services = [
  {
    name: "API Server",
    packageName: "@workspace/api-server",
    env: { NODE_ENV: "development", PORT: "3000" },
  },
  {
    name: "DevTerminal",
    packageName: "@workspace/devterminal",
    env: { NODE_ENV: "development", PORT: "21612", BASE_PATH: "/" },
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
      env: { ...process.env, ...service.env },
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
