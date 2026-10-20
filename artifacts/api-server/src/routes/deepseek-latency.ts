export const DEEPSEEK_LATENCY_WARNING_MS = 2000;

type LatencyFields = {
  event: "deepseek_latency_degraded";
  status: "degraded";
  route: "/deepseek/chat";
  elapsedMs: number;
  thresholdMs: number;
  firstTokenMs: number | null;
};

export function monitorDeepseekLatency(options: {
  warn: (fields: LatencyFields) => void;
  emitWarning: (fields: LatencyFields) => void;
  now?: () => number;
  schedule?: typeof setTimeout;
  cancel?: typeof clearTimeout;
}) {
  const now = options.now ?? (() => performance.now());
  const startedAt = now();
  let firstTokenMs: number | null = null;
  let warned = false;
  let stopped = false;
  const report = () => {
    if (warned || now() - startedAt <= DEEPSEEK_LATENCY_WARNING_MS) return;
    warned = true;
    const fields: LatencyFields = {
      event: "deepseek_latency_degraded", status: "degraded",
      route: "/deepseek/chat",
      elapsedMs: Math.round(now() - startedAt),
      thresholdMs: DEEPSEEK_LATENCY_WARNING_MS,
      firstTokenMs,
    };
    options.warn(fields);
    options.emitWarning(fields);
  };
  const timer = (options.schedule ?? setTimeout)(report, DEEPSEEK_LATENCY_WARNING_MS + 1);
  return {
    firstToken() {
      firstTokenMs ??= Math.round(now() - startedAt);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      (options.cancel ?? clearTimeout)(timer);
      // Catch event-loop stalls where completion ran before the timer callback.
      report();
    },
  };
}
