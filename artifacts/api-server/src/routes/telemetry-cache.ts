import type { RequestHandler } from "express";

export const disableTelemetryCache: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-transform");
  // Old cached validators must not produce a 304 for live telemetry.
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  next();
};
