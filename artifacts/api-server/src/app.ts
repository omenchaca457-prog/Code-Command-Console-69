import express, { type Express } from "express";
import cors from "cors";
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
app.use(cors());
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

// Telemetry is always live, including requests with old cache validators.
app.use(
  ["/api/healthz", "/api/readyz", "/api/agents", "/api/neural-events"],
  disableTelemetryCache,
);

app.get("/", (_req, res) => {
  res.redirect(302, "/api/healthz");
});

app.use("/api", router);

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof DatabaseUnavailableError) {
    req.log?.warn({ event: "database_not_configured" }, "La persistencia PostgreSQL no está disponible");
    res.status(503).json({
      error: "La persistencia no está disponible. Configure DATABASE_URL en Replit Secrets.",
    });
    return;
  }
  next(error);
});

export default app;
