import type { RequestHandler } from "express";

type Bucket = { count: number; resetAt: number };

export type RateLimitOptions = {
  scope: string;
  maxRequests: number;
  windowMs: number;
  maxTrackedKeys?: number;
  now?: () => number;
};

export function createRateLimiter({
  scope,
  maxRequests,
  windowMs,
  maxTrackedKeys = 10_000,
  now = Date.now,
}: RateLimitOptions): RequestHandler {
  if (!scope || !Number.isInteger(maxRequests) || maxRequests < 1 || windowMs < 1) {
    throw new Error("Invalid rate limit configuration");
  }

  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const currentTime = now();
    const clientKey = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${scope}:${clientKey}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= currentTime) {
      if (!bucket && buckets.size >= maxTrackedKeys) {
        for (const [trackedKey, trackedBucket] of buckets) {
          if (trackedBucket.resetAt <= currentTime) buckets.delete(trackedKey);
        }
        while (buckets.size >= maxTrackedKeys) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey === undefined) break;
          buckets.delete(oldestKey);
        }
      }
      bucket = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, maxRequests - bucket.count);
    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))),
      );
      res.status(429).json({
        error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde.",
        code: "rate_limit_exceeded",
      });
      return;
    }

    next();
  };
}
