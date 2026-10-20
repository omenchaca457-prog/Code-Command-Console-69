import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express, { type Router } from "express";
import { describe, it } from "node:test";
import {
  createCoherenceSimulator,
  RESONANCE_MODULUS,
  SIMULATION_INTERVAL_MS,
  SIMULATION_LOG_INTERVAL_MS,
  type CoherenceSample,
} from "../lib/coherence_simulator.ts";
import { createCoherenceSimulationRouter } from "./coherence-simulation.ts";

type Timer = {
  callback: () => void;
  intervalMs: number;
  nextAt: number;
};

class FakeClock {
  now = 0;
  readonly timers = new Map<ReturnType<typeof setInterval>, Timer>();
  private nextId = 0;

  setInterval = (callback: () => void, intervalMs: number): ReturnType<typeof setInterval> => {
    const handle = ++this.nextId as unknown as ReturnType<typeof setInterval>;
    this.timers.set(handle, { callback, intervalMs, nextAt: this.now + intervalMs });
    return handle;
  };

  clearInterval = (handle: ReturnType<typeof setInterval>): void => {
    this.timers.delete(handle);
  };

  advance(milliseconds: number): void {
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.nextAt <= target)
        .sort((left, right) => left[1].nextAt - right[1].nextAt)[0];
      if (!next) break;

      const [handle, timer] = next;
      this.now = timer.nextAt;
      timer.nextAt += timer.intervalMs;
      timer.callback();
      if (!this.timers.has(handle)) continue;
    }
    this.now = target;
  }
}

function createTestSimulator(clock = new FakeClock()) {
  return {
    clock,
    simulator: createCoherenceSimulator({
      now: () => clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      createVector: () => 1234n,
    }),
  };
}

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function withServer(router: Router, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use("/api", router);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
}

function createSseReader(response: Response) {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return {
    async nextEvent(): Promise<{ event: string; data: unknown }> {
      while (true) {
        const frameEnd = buffer.indexOf("\n\n");
        if (frameEnd >= 0) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);
          const event = frame.match(/^event: (.+)$/m)?.[1];
          const data = frame.match(/^data: (.+)$/m)?.[1];
          assert.ok(event, `El frame SSE no incluye evento: ${frame}`);
          assert.ok(data, `El frame SSE no incluye datos: ${frame}`);
          return { event, data: JSON.parse(data) as unknown };
        }

        const { done, value } = await reader.read();
        assert.equal(done, false, "El flujo SSE terminó antes de entregar el evento");
        buffer += decoder.decode(value, { stream: true });
      }
    },
    cancel: () => reader.cancel(),
  };
}

describe("coherence simulator", () => {
  it("does not create duplicate intervals and stopping prevents further samples", () => {
    const { clock, simulator } = createTestSimulator();
    const samples: CoherenceSample[] = [];
    simulator.subscribeToSimulation((sample) => samples.push(sample));
    const persist = async () => undefined;

    assert.equal(simulator.startSimulation(persist).running, true);
    assert.equal(simulator.startSimulation(async () => assert.fail("No debe sustituir la persistencia activa")).running, true);
    assert.equal(clock.timers.size, 1);

    clock.advance(SIMULATION_INTERVAL_MS * 2);
    assert.equal(samples.length, 2);
    assert.equal(simulator.stopSimulation().running, false);
    assert.equal(clock.timers.size, 0);

    clock.advance(SIMULATION_INTERVAL_MS * 3);
    assert.equal(samples.length, 2);
    assert.equal(simulator.getSimulationStatus().vectorsProcessed, 2);
  });

  it("emits correctly formatted samples and persists at the configured interval", async () => {
    const { clock, simulator } = createTestSimulator();
    const samples: CoherenceSample[] = [];
    const persisted: CoherenceSample[] = [];
    simulator.subscribeToSimulation((sample) => samples.push(sample));
    simulator.startSimulation(async (sample) => {
      persisted.push(sample);
    });

    clock.advance(SIMULATION_LOG_INTERVAL_MS - SIMULATION_INTERVAL_MS);
    assert.equal(persisted.length, 0, "No debe persistir antes de alcanzar el intervalo de log");
    clock.advance(SIMULATION_INTERVAL_MS);
    await flushPromises();

    assert.equal(samples.length, SIMULATION_LOG_INTERVAL_MS / SIMULATION_INTERVAL_MS);
    assert.equal(persisted.length, 1);
    assert.deepEqual(persisted[0], samples.at(-1));

    const sample = samples[0];
    assert.ok(sample);
    assert.match(sample.vector, /^\d+$/);
    assert.equal(sample.vector, "1234");
    assert.match(sample.turbulence, /^\d+$/);
    assert.equal(BigInt(sample.turbulence), 1234n % RESONANCE_MODULUS);
    assert.equal(
      sample.coherence,
      (1 - Number(BigInt(sample.turbulence)) / Number(RESONANCE_MODULUS)) * 100,
    );
    assert.equal(sample.vectorsProcessed, 1);
    assert.equal(sample.timestamp, new Date(SIMULATION_INTERVAL_MS).toISOString());

    clock.advance(SIMULATION_LOG_INTERVAL_MS);
    await flushPromises();
    assert.equal(persisted.length, 2);
    simulator.stopSimulation();
  });
});

describe("coherence simulation route", () => {
  it("lists persisted logs with cursor pagination and rejects invalid limits", async () => {
    const { simulator } = createTestSimulator();
    const requestedPages: Array<{ limit: number; beforeId?: number }> = [];
    const router = createCoherenceSimulationRouter({
      simulator,
      loadLogs: async (limit, beforeId) => {
        requestedPages.push({ limit, beforeId });
        return {
          items: [{
            id: 8,
            vector: "1234",
            coherence: 99.9,
            turbulence: "1",
            vectorsProcessed: 100,
            createdAt: new Date("2026-10-20T05:00:00.000Z").toISOString(),
          }],
          nextBeforeId: 8,
        };
      },
    });

    await withServer(router, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/coherence-simulation/logs?limit=1&beforeId=10`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [{
          id: 8,
          vector: "1234",
          coherence: 99.9,
          turbulence: "1",
          vectorsProcessed: 100,
          createdAt: "2026-10-20T05:00:00.000Z",
        }],
        nextBeforeId: 8,
      });
      assert.deepEqual(requestedPages, [{ limit: 1, beforeId: 10 }]);

      const invalid = await fetch(`${baseUrl}/api/coherence-simulation/logs?limit=101`);
      assert.equal(invalid.status, 400);
      assert.equal(requestedPages.length, 1);
    });
  });

  it("returns page-number history with total count and rejects invalid pagination", async () => {
    const { simulator } = createTestSimulator();
    const requestedPages: Array<{ page: number; pageSize: number }> = [];
    const router = createCoherenceSimulationRouter({
      simulator,
      listLogs: async (page, pageSize) => {
        requestedPages.push({ page, pageSize });
        return {
          items: [
            {
              id: page,
              vector: "1234",
              coherence: 99.9,
              turbulence: "1234",
              vectorsProcessed: 50,
              createdAt: new Date("2026-10-20T12:00:00.000Z"),
            },
          ],
          page,
          pageSize,
          total: 21,
        };
      },
      parseLogsQuery: async (query) => {
        if (typeof query !== "object" || query === null) {
          return { success: false, error: { message: "Invalid query" } };
        }
        const values = query as Record<string, unknown>;
        const page = Number(values.page ?? 1);
        const pageSize = Number(values.pageSize ?? 20);
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
          return { success: false, error: { message: "Invalid pagination" } };
        }
        return { success: true, data: { page, pageSize } };
      },
      parseLogsPage: async (page) => page,
    });

    await withServer(router, async (baseUrl) => {
      const pageResponse = await fetch(`${baseUrl}/api/coherence-simulation/logs/page?page=2&pageSize=10`);
      assert.equal(pageResponse.status, 200);
      assert.deepEqual(await pageResponse.json(), {
        items: [
          {
            id: 2,
            vector: "1234",
            coherence: 99.9,
            turbulence: "1234",
            vectorsProcessed: 50,
            createdAt: "2026-10-20T12:00:00.000Z",
          },
        ],
        page: 2,
        pageSize: 10,
        total: 21,
      });
      assert.deepEqual(requestedPages, [{ page: 2, pageSize: 10 }]);

      const invalidPageResponse = await fetch(`${baseUrl}/api/coherence-simulation/logs/page?page=0`);
      assert.equal(invalidPageResponse.status, 400);
      const fractionalPageResponse = await fetch(`${baseUrl}/api/coherence-simulation/logs/page?page=1.5`);
      assert.equal(fractionalPageResponse.status, 400);
      assert.deepEqual(requestedPages, [{ page: 2, pageSize: 10 }]);
    });
  });

  it("serves control states and the status/sample SSE frames using isolated dependencies", async () => {
    const { clock, simulator } = createTestSimulator();
    const persisted: CoherenceSample[] = [];
    const router = createCoherenceSimulationRouter({
      simulator,
      persistSample: async (sample) => {
        persisted.push(sample);
      },
    });

    await withServer(router, async (baseUrl) => {
      const initialStatus = await fetch(`${baseUrl}/api/coherence-simulation/status`);
      assert.deepEqual(await initialStatus.json(), {
        running: false,
        vectorsProcessed: 0,
        latest: null,
      });

      const startResponse = await fetch(`${baseUrl}/api/coherence-simulation/start`, { method: "POST" });
      assert.deepEqual(await startResponse.json(), {
        running: true,
        vectorsProcessed: 0,
        latest: null,
      });
      await fetch(`${baseUrl}/api/coherence-simulation/start`, { method: "POST" });
      assert.equal(clock.timers.size, 1, "Las peticiones start repetidas no deben duplicar intervalos");

      const streamResponse = await fetch(`${baseUrl}/api/coherence-simulation/stream`);
      assert.equal(streamResponse.status, 200);
      assert.match(streamResponse.headers.get("content-type") ?? "", /^text\/event-stream/);
      assert.equal(streamResponse.headers.get("cache-control"), "no-cache, no-transform");
      assert.equal(streamResponse.headers.get("x-accel-buffering"), "no");

      const stream = createSseReader(streamResponse);
      const statusEvent = await stream.nextEvent();
      assert.equal(statusEvent.event, "status");
      assert.deepEqual(statusEvent.data, {
        running: true,
        vectorsProcessed: 0,
        latest: null,
      });

      clock.advance(SIMULATION_INTERVAL_MS);
      const sampleEvent = await stream.nextEvent();
      assert.equal(sampleEvent.event, "sample");
      assert.deepEqual(sampleEvent.data, {
        vector: "1234",
        coherence: (1 - Number(1234n % RESONANCE_MODULUS) / Number(RESONANCE_MODULUS)) * 100,
        turbulence: (1234n % RESONANCE_MODULUS).toString(),
        vectorsProcessed: 1,
        timestamp: new Date(SIMULATION_INTERVAL_MS).toISOString(),
      });

      const stopResponse = await fetch(`${baseUrl}/api/coherence-simulation/stop`, { method: "POST" });
      assert.deepEqual(await stopResponse.json(), {
        running: false,
        vectorsProcessed: 1,
        latest: sampleEvent.data,
      });
      assert.equal(clock.timers.size, 0);
      clock.advance(SIMULATION_INTERVAL_MS * 2);
      assert.equal(simulator.getSimulationStatus().vectorsProcessed, 1);
      assert.deepEqual(persisted, []);
      await stream.cancel();
    });
  });
});
