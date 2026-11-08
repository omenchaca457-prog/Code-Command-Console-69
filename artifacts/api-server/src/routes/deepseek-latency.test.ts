import assert from "node:assert/strict";
import { it } from "node:test";
import { monitorDeepseekLatency } from "./deepseek-latency.ts";

it("warns once above 2000ms with measured first-token latency and a degraded SSE signal", () => {
  let now = 0;
  let tick!: () => void;
  const warnings: unknown[] = [];
  const events: unknown[] = [];
  const monitor = monitorDeepseekLatency({
    now: () => now,
    schedule: ((callback: () => void, delay: number) => {
      assert.equal(delay, 2001);
      tick = callback;
      return 1;
    }) as unknown as typeof setTimeout,
    cancel: (() => {}) as typeof clearTimeout,
    warn: fields => warnings.push(fields),
    emitWarning: fields => events.push(fields),
  });
  now = 400;
  monitor.firstToken();
  now = 2001;
  tick();
  monitor.stop();
  assert.equal(warnings.length, 1);
  assert.deepEqual(events, warnings);
  assert.deepEqual(warnings[0], {
    event: "deepseek_latency_degraded", status: "degraded", route: "/deepseek/chat",
    elapsedMs: 2001, thresholdMs: 2000, firstTokenMs: 400,
  });
});

it("does not warn on a fast response and catches late completion after an event-loop stall", () => {
  let now = 0;
  let warnings = 0;
  const options = {
    now: () => now, warn: () => { warnings++; }, emitWarning: () => {},
    schedule: (() => 1) as unknown as typeof setTimeout,
    cancel: (() => {}) as typeof clearTimeout,
  };
  const fast = monitorDeepseekLatency(options);
  now = 1999;
  fast.stop();
  assert.equal(warnings, 0);
  const slow = monitorDeepseekLatency(options);
  now = 5000;
  slow.stop();
  assert.equal(warnings, 1);
});
