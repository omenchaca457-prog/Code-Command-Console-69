import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordServerRequest } from "./lib/runtime-diagnostics";
import { disableTelemetryCache } from "./routes/telemetry-cache";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Telemetry is always live, including requests with old cache validators.
app.use(["/api/healthz", "/api/agents", "/api/neural-events"], disableTelemetryCache);

app.get("/", (_req, res) => {
  res.redirect(302, "/api/healthz");
});

app.use("/api", router);

export default app;
