import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { workspaceAccess } from "./lib/workspace-access";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordServerRequest } from "./lib/runtime-diagnostics";
import { disableTelemetryCache } from "./routes/telemetry-cache";
import { createRateLimiter } from "./lib/rate-limit";
import { DatabaseUnavailableError } from "@workspace/db";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  const started = Date.now();
  res.once("finish", () => {
    recordServerRequest(req.method, req.path, res.statusCode, Date.now() - started);
  });
  next();
});

app.use(
  "/api",
  createRateLimiter({ scope: "api", maxRequests: 300, windowMs: 60_000 }),
);
app.use(
  ["/api/ai", "/api/deepseek", "/api/gemini", "/api/openai"],
  createRateLimiter({ scope: "model-api", maxRequests: 30, windowMs: 60_000 }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb", parameterLimit: 100 }));

app.use("/api", workspaceAccess.router);
app.use("/api", (req, res, next) => {
  if (["/healthz", "/readyz"].includes(req.path)) return next();
  return workspaceAccess.requireAccess(req, res, next);
});

// Telemetry is always live, including requests with old cache validators.
app.use(
  ["/api/healthz", "/api/readyz", "/api/agents", "/api/neural-events"],
  disableTelemetryCache,
);



app.use("/api", router);

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof DatabaseUnavailableError) {
    req.log?.warn({ event: "database_not_configured" }, "La persistencia PostgreSQL no está disponible");
    res.status(503).json({
      error: "La persistencia no está disponible. Configure DATABASE_URL en el entorno del servidor.",
    });
    return;
  }
  next(error);
});

const webRoot = resolve(process.env.WEB_DIST_DIR || "artifacts/devterminal/dist/public");
app.use(express.static(webRoot, { index: false }));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  if (!workspaceAccess.acceptsOrigin(req)) { res.status(403).send("Origen no permitido"); return; }
  if (!workspaceAccess.authenticated(req)) {
    res.setHeader("Cache-Control", "no-store");
    res.send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DevTerminal · Acceso</title><style>body{margin:0;background:#101219;color:#e8eaf0;font:16px system-ui;display:grid;place-items:center;min-height:100vh}form{padding:35px;border:1px solid #ffffff20;border-radius:12px;width:min(330px,75vw)}h1{color:#c4f477}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:15px;border-radius:6px}input{background:#171c25;color:white;border:1px solid #666}button{background:#c4f477;border:0;cursor:pointer}p{color:#a7b1c4;line-height:1.6}</style><form><h1>DevTerminal</h1><p>Tu consola independiente.<br>Inicia sesión en tu workspace.</p><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button>Entrar</button><p role="alert" id="error"></p></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/session/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:e.target.password.value})});if(r.ok)location.reload();else document.getElementById('error').textContent=(await r.json()).error;};</script></html>`);
    return;
  }
  if (existsSync(resolve(webRoot, "index.html"))) res.sendFile(resolve(webRoot, "index.html"));
  else res.status(503).send("Compila la interfaz con pnpm build.");
});
export default app;
