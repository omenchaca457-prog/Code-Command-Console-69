import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import * as pty from "node-pty";
import { logger } from "../lib/logger";

const BOOT_BANNER = `\r\n\x1b[38;5;196m╔══════════════════════════════════════════════════════════╗\x1b[0m\r\n\x1b[38;5;196m║\x1b[0m  \x1b[1m\x1b[36mDEVTERMINAL\x1b[0m \x1b[38;5;240m—\x1b[0m \x1b[1m\x1b[92mLinux PTY v2.0\x1b[0m \x1b[38;5;196m║\x1b[0m\r\n\x1b[38;5;196m║\x1b[0m  \x1b[38;5;240mLey 4105 · Coherencia Eterna · SQ-AI Neural Core\x1b[0m         \x1b[38;5;196m║\x1b[0m\r\n\x1b[38;5;196m╚══════════════════════════════════════════════════════════╝\x1b[0m\r\n\r\n\x1b[38;5;240m  Session: real bash PTY • type anything, it works\x1b[0m\r\n\x1b[38;5;240m  Tip: python3, node, go, rustc, curl, git — all live\x1b[0m\r\n\r\n`;

export function attachTerminalWS(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (req.url === "/api/terminal/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    logger.info("Terminal WebSocket connected");

    let cols = 220;
    let rows = 50;

    const shell = process.env["SHELL"] || "/bin/bash";

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env["HOME"] || "/home/runner/workspace",
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
        FORCE_COLOR: "3",
        NODE_PATH: "/home/runner/workspace/node_modules",
        PATH: [
          "/home/runner/workspace/node_modules/.bin",
          "/nix/store/x5hwjkyng8385q1pqhz8wyqkq0izmhpi-replit-runtime-path/bin",
          "/usr/local/sbin",
          "/usr/local/bin",
          "/usr/sbin",
          "/usr/bin",
          "/sbin",
          "/bin",
          process.env["PATH"] || "",
        ].join(":"),
        PS1: "\\[\\033[38;5;196m\\]❯\\[\\033[0m\\] \\[\\033[38;5;240m\\]\\w\\[\\033[0m\\] ",
      },
    });

    ws.send(BOOT_BANNER);

    ptyProcess.onData((data: string) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      } catch {}
    });

    ptyProcess.onExit(({ exitCode }) => {
      logger.info({ exitCode }, "PTY process exited");
      try {
        ws.send("\r\n\x1b[38;5;196m[Session ended. Refresh to restart.]\x1b[0m\r\n");
        ws.close();
      } catch {}
    });

    ws.on("message", (data: Buffer | string) => {
      try {
        const msg = data.toString();
        // Check if it's a resize command (JSON)
        if (msg.startsWith("{") && msg.includes('"resize"')) {
          const parsed = JSON.parse(msg);
          if (parsed.resize) {
            cols = parsed.cols ?? cols;
            rows = parsed.rows ?? rows;
            ptyProcess.resize(cols, rows);
            return;
          }
        }
        ptyProcess.write(msg);
      } catch {}
    });

    ws.on("close", () => {
      logger.info("Terminal WebSocket disconnected");
      try {
        ptyProcess.kill();
      } catch {}
    });

    ws.on("error", (err) => {
      logger.error({ err }, "Terminal WebSocket error");
      try {
        ptyProcess.kill();
      } catch {}
    });
  });

  logger.info("Terminal WebSocket server attached at /api/terminal/ws");
  return wss;
}
