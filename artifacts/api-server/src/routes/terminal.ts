import { type IncomingMessage, type Server } from "http";
import { WebSocketServer } from "ws";
import { logger } from "../lib/logger.ts";

const TERMINAL_PATH = "/api/terminal/ws";
const DISABLED_BODY = JSON.stringify({
  error: "La terminal PTY está desactivada por seguridad.",
  code: "execution_disabled",
  reason: "No hay autenticación de usuario ni un aislamiento de procesos verificado.",
});

function rejectUpgrade(req: IncomingMessage, socket: import("net").Socket) {
  let pathname: string;
  try {
    pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname !== TERMINAL_PATH) {
    socket.destroy();
    return;
  }

  logger.warn({ path: pathname, event: "terminal_pty_blocked" }, "Conexión PTY bloqueada");
  socket.end(
    [
      "HTTP/1.1 503 Service Unavailable",
      "Connection: close",
      "Content-Type: application/json; charset=utf-8",
      "Cache-Control: no-store",
      `Content-Length: ${Buffer.byteLength(DISABLED_BODY)}`,
      "",
      DISABLED_BODY,
    ].join("\r\n"),
  );
}

export function attachTerminalWS(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", rejectUpgrade);
  logger.info("Terminal PTY desactivada; las conexiones a /api/terminal/ws se rechazan");
  return wss;
}
