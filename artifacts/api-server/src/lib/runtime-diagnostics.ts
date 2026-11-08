export type RuntimeLog = {
  at: string;
  source: "server" | "webview";
  level: "info" | "error";
  message: string;
};

const recent: RuntimeLog[] = [];
const MAX_DIAGNOSTICS = 100;
const SECRET_PATTERN = /(["']?(?:[A-Z0-9_]*API[_-]?KEY|token|password|secret)["']?)\s*[:=]\s*["']?[^"',\s}]+/gi;

function append(entry: RuntimeLog) {
  recent.push({
    ...entry,
    message: entry.message
      .replace(SECRET_PATTERN, "$1=[REDACTED]")
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_TOKEN]")
      .slice(0, 500),
  });
  if (recent.length > MAX_DIAGNOSTICS) recent.splice(0, recent.length - MAX_DIAGNOSTICS);
}

export function recordServerRequest(method: string, path: string, status: number, durationMs: number) {
  append({
    at: new Date().toISOString(),
    source: "server",
    level: status >= 500 ? "error" : "info",
    message: `${method} ${path} -> ${status} (${durationMs}ms)`,
  });
}

export function recordWebviewError(message: string) {
  append({
    at: new Date().toISOString(),
    source: "webview",
    level: "error",
    message,
  });
}

export function getRuntimeDiagnostics() {
  return recent.slice(-50);
}
