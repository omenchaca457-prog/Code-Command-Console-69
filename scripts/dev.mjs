import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

const windows = process.platform === "win32";
const services = [
  { name: "API Server", packageName: "@workspace/api-server", env: { NODE_ENV: "development", PORT: process.env.API_PORT || "3000" } },
  { name: "DevTerminal", packageName: "@workspace/devterminal", env: { NODE_ENV: "development", PORT: process.env.WEB_PORT || "21612", BASE_PATH: "/" } },
];

const children = [];
let shuttingDown = false;

function stopChild(child, signal) {
  if (!child.pid || child.exitCode !== null) return;
  if (windows) {
    // Windows does not support negative process-group PIDs.
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T"], { stdio: "ignore", windowsHide: true });
    killer.on("error", () => { try { child.kill(); } catch {} });
  } else {
    try { process.kill(-child.pid, signal); }
    catch (error) { if (error.code !== "ESRCH") process.stderr.write(`Error cerrando proceso: ${error.message}\n`); }
  }
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopChild(child, signal);
}

for (const service of services) {
  const child = spawn(
    windows ? "pnpm.cmd" : "pnpm",
    ["--filter", service.packageName, "run", "dev"],
    {
      cwd: root,
      env: { ...process.env, WORKSPACE_ROOT: root, ...service.env },
      stdio: "inherit",
      detached: !windows,
      shell: windows,
    },
  );
  children.push(child);
  child.once("error", (error) => {
    process.stderr.write(`[${service.name}] No se pudo iniciar: ${error.message}\n`);
    process.exitCode = 1;
    stopAll();
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      process.stderr.write(`[${service.name}] terminó inesperadamente (${signal ?? code ?? "sin código"}).\n`);
      process.exitCode = code || 1;
      stopAll();
    }
  });
}

process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));
