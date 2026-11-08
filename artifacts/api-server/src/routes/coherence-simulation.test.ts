import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express, { type Router } from "express";
import { describe, it } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { simulationLogsTable } from "../../../../lib/db/src/schema/simulation-logs.ts";
import {
  createCoherenceSimulator,
  RESONANCE_MODULUS,
  SIMULATION_INTERVAL_MS,
  SIMULATION_LOG_INTERVAL_MS,
  type CoherenceSample,
} from "../lib/coherence_simulator.ts";
import {
  createCoherenceSimulationRouter,
  listSimulationLogPagesFromDatabase,
} from "./coherence-simulation.ts";

const { Client } = pg;

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

async function parseLogsQueryForTest(query: unknown):
  Promise<
    | { success: true; data: { page: number; pageSize: number; snapshotId?: number } }
    | { success: false; error: { message: string } }
  > {
  const params = query as Record<string, string | undefined>;
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 20);
  const snapshotId = params.snapshotId === undefined ? undefined : Number(params.snapshotId);

  if (!Number.isInteger(page) || page < 1) {
    return { success: false, error: { message: "page must be a positive integer" } };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { success: false, error: { message: "pageSize must be an integer between 1 and 100" } };
  }
  if (
    snapshotId !== undefined
    && (!Number.isSafeInteger(snapshotId) || snapshotId < 1)
  ) {
    return { success: false, error: { message: "snapshotId must be a safe integer" } };
  }

  return {
    success: true,
    data: { page, pageSize, ...(snapshotId === undefined ? {} : { snapshotId }) },
  };
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

  it("keeps producing samples without overlapping slow persistence writes", async () => {
    const { clock, simulator } = createTestSimulator();
    const samples: CoherenceSample[] = [];
    const pendingWrites: Array<() => void> = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    let writeCount = 0;
    simulator.subscribeToSimulation((sample) => samples.push(sample));
    simulator.startSimulation(() => {
      writeCount += 1;
      activeWrites += 1;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);

      return new Promise<void>((resolve) => {
        pendingWrites.push(() => {
          activeWrites -= 1;
          resolve();
        });
      });
    });

    clock.advance(SIMULATION_LOG_INTERVAL_MS);
    assert.equal(writeCount, 1);
    assert.equal(activeWrites, 1);

    clock.advance(SIMULATION_LOG_INTERVAL_MS * 2);
    assert.equal(samples.length, SIMULATION_LOG_INTERVAL_MS * 3 / SIMULATION_INTERVAL_MS);
    assert.equal(writeCount, 1, "No debe iniciar otro guardado mientras el primero siga pendiente");
    assert.equal(maxActiveWrites, 1);

    pendingWrites[0]?.();
    await flushPromises();
    clock.advance(SIMULATION_INTERVAL_MS);
    assert.equal(writeCount, 2, "Debe retomar los guardados cuando termine la escritura lenta");
    assert.equal(maxActiveWrites, 1);

    pendingWrites[1]?.();
    await flushPromises();
    simulator.stopSimulation();
  });

  it("continues emitting samples after a persistence failure and retries at the next eligible interval", async () => {
    const { clock, simulator } = createTestSimulator();
    const samples: CoherenceSample[] = [];
    const persisted: CoherenceSample[] = [];
    let attempts = 0;
    simulator.subscribeToSimulation((sample) => samples.push(sample));
    simulator.startSimulation(async (sample) => {
      attempts += 1;
      if (attempts === 1) throw new Error("Fallo de persistencia simulado");
      persisted.push(sample);
    });

    clock.advance(SIMULATION_LOG_INTERVAL_MS);
    assert.equal(attempts, 1);
    await flushPromises();
    assert.equal(simulator.getSimulationStatus().running, true);

    clock.advance(SIMULATION_LOG_INTERVAL_MS);
    await flushPromises();

    assert.equal(samples.length, SIMULATION_LOG_INTERVAL_MS * 2 / SIMULATION_INTERVAL_MS);
    assert.equal(attempts, 2, "Debe volver a intentar el guardado en el siguiente intervalo elegible");
    assert.deepEqual(persisted, [samples.at(-1)]);
    simulator.stopSimulation();
  });
});

describe("coherence simulation route", () => {
  it("keeps PostgreSQL history pages fixed to the first page snapshot when a newer row is inserted", {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
      await client.query(`
        CREATE TEMPORARY TABLE simulation_logs (
          id integer PRIMARY KEY,
          vector text NOT NULL,
          coherence double precision NOT NULL,
          turbulence text NOT NULL,
          vectors_processed integer NOT NULL,
          created_at timestamptz NOT NULL
        )
      `);

      const initialLogs = [
        { id: 10, createdAt: "2026-10-20T12:03:00.000Z" },
        { id: 8, createdAt: "2026-10-20T12:02:00.000Z" },
        { id: 9, createdAt: "2026-10-20T12:02:00.000Z" },
        { id: 7, createdAt: "2026-10-20T12:01:00.000Z" },
        { id: 5, createdAt: "2026-10-20T12:01:00.000Z" },
        { id: 6, createdAt: "2026-10-20T12:01:00.000Z" },
        { id: 2, createdAt: "2026-10-20T12:00:00.000Z" },
      ];
      for (const log of initialLogs) {
        await client.query(
          `INSERT INTO simulation_logs
            (id, vector, coherence, turbulence, vectors_processed, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [log.id, String(log.id), 99, "1", log.id * 10, log.createdAt],
        );
      }

      const database = drizzle(client, { schema: { simulationLogsTable } }) as unknown as
        Parameters<typeof listSimulationLogPagesFromDatabase>[0];
      const router = createCoherenceSimulationRouter({
        listLogs: (page, pageSize, snapshotId) => listSimulationLogPagesFromDatabase(
          database,
          simulationLogsTable,
          page,
          pageSize,
          snapshotId,
        ),
        parseLogsQuery: parseLogsQueryForTest,
        parseLogsPage: async (page) => page,
      });

      await withServer(router, async (baseUrl) => {
        const firstResponse = await fetch(
          `${baseUrl}/api/coherence-simulation/logs/page?page=1&pageSize=3`,
        );
        assert.equal(firstResponse.status, 200);
        const firstPage = await firstResponse.json() as {
          items: Array<{ id: number; createdAt: string }>;
          total: number;
          snapshotId: number | null;
        };
        assert.deepEqual(firstPage.items.map((item) => item.id), [10, 9, 8]);
        assert.equal(firstPage.total, 7);
        assert.equal(firstPage.snapshotId, 10);

        await client.query(
          `INSERT INTO simulation_logs
            (id, vector, coherence, turbulence, vectors_processed, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [11, "11", 99, "1", 110, "2026-10-20T12:04:00.000Z"],
        );

        const pages = [firstPage];
        for (const page of [2, 3]) {
          const response = await fetch(
            `${baseUrl}/api/coherence-simulation/logs/page?page=${page}&pageSize=3&snapshotId=10`,
          );
          assert.equal(response.status, 200);
          pages.push(await response.json() as typeof firstPage);
        }

        const ids = pages.flatMap((page) => page.items.map((item) => item.id));
        assert.deepEqual(ids, [10, 9, 8, 7, 6, 5, 2]);
        assert.equal(new Set(ids).size, 7, "History pages must not repeat rows");
        for (const page of pages) {
          assert.equal(page.total, 7, "The snapshot count must not include the later insert");
          assert.equal(page.snapshotId, 10);
        }

        const orderedItems = pages.flatMap((page) => page.items);
        for (let index = 1; index < orderedItems.length; index += 1) {
          const previous = orderedItems[index - 1];
          const current = orderedItems[index];
          assert.ok(previous && current);
          const dateOrder = Date.parse(previous.createdAt) - Date.parse(current.createdAt);
          assert.ok(
            dateOrder > 0 || (dateOrder === 0 && previous.id > current.id),
            "The full history must be ordered by createdAt and then descending ID",
          );
        }
        assert.ok(!ids.includes(11), "A row committed after page one must stay outside this snapshot");
      });
    } finally {
      await client.end();
    }
  });

  it("lists persisted logs with cursor pagination and rejects invalid limits", async () => {
    const { simulator } = createTestSimulator();
    const requestedPages: Array<{ limit: number; beforeId?: number }> = [];
    const router = createCoherenceSimulationRouter({
      simulator,
      loadLogs: async (limit, beforeId) => {
        requestedPages.push({ limit, ...(beforeId === undefined ? {} : { beforeId }) });
        return {
          items: [{
            id: 8,
            vector: "1234",
            coherence: 99.9,
            turbulence: "1",
            vectorsProcessed: 100,
            createdAt: "2026-10-20T05:00:00.000Z",
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
    const requestedPages: Array<{ page: number; pageSize: number; snapshotId?: number }> = [];
    const router = createCoherenceSimulationRouter({
      simulator,
      listLogs: async (page, pageSize, snapshotId) => {
        requestedPages.push({ page, pageSize, ...(snapshotId === undefined ? {} : { snapshotId }) });
        return {
          items: page === 2 ? [{
            id: 2,
            vector: "1234",
            coherence: 99.9,
            turbulence: "1234",
            vectorsProcessed: 50,
            createdAt: new Date("2026-10-20T12:00:00.000Z"),
          }] : [],
          page,
          pageSize,
          total: 21,
          snapshotId: snapshotId ?? 21,
        };
      },
      parseLogsQuery: parseLogsQueryForTest,
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
        snapshotId: 21,
      });
      assert.deepEqual(requestedPages, [{ page: 2, pageSize: 10 }]);

      const invalidPageResponse = await fetch(`${baseUrl}/api/coherence-simulation/logs/page?page=0`);
      assert.equal(invalidPageResponse.status, 400);
      const fractionalPageResponse = await fetch(`${baseUrl}/api/coherence-simulation/logs/page?page=1.5`);

      const acceptedMaxOffsetResponse = await fetch(
        `${baseUrl}/api/coherence-simulation/logs/page?page=50001&pageSize=20`,
      );
      assert.equal(acceptedMaxOffsetResponse.status, 200);
      assert.equal(fractionalPageResponse.status, 400);
      const oversizedPageResponse = await fetch(
        `${baseUrl}/api/coherence-simulation/logs/page?page=1e100&pageSize=100`,
      );
      assert.equal(oversizedPageResponse.status, 400);
      const outOfRangeResponse = await fetch(
        `${baseUrl}/api/coherence-simulation/logs/page?page=50002&pageSize=20`,
      );
      assert.equal(outOfRangeResponse.status, 400);
      assert.deepEqual(requestedPages, [
        { page: 2, pageSize: 10 },
        { page: 50001, pageSize: 20 },
      ]);

      for (const pageSize of ["0", "101", "1.5"]) {
        const invalidPageSizeResponse = await fetch(
          `${baseUrl}/api/coherence-simulation/logs/page?pageSize=${pageSize}`,
        );
        assert.equal(invalidPageSizeResponse.status, 400, `pageSize=${pageSize} debe rechazarse`);
        assert.deepEqual(
          requestedPages,
          [
            { page: 2, pageSize: 10 },
            { page: 50001, pageSize: 20 },
          ],
          `pageSize=${pageSize} no debe consultar el historial`,
        );
      }

      const acceptedBoundaryPages: Array<{ page: number; pageSize: number }> = [];
      for (const pageSize of [1, 100]) {
        const boundaryResponse = await fetch(
          `${baseUrl}/api/coherence-simulation/logs/page?page=1&pageSize=${pageSize}`,
        );
        assert.equal(boundaryResponse.status, 200, `pageSize=${pageSize} debe aceptarse`);
        const boundaryResult = await boundaryResponse.json() as { pageSize: number };
        assert.equal(boundaryResult.pageSize, pageSize);

        acceptedBoundaryPages.push({ page: 1, pageSize });
        assert.deepEqual(requestedPages, [
          { page: 2, pageSize: 10 },
          { page: 50001, pageSize: 20 },
          ...acceptedBoundaryPages,
        ]);
      }
    });
  });

  it("returns consecutive history pages in stable createdAt/id order without omissions or duplicates", async () => {
    const { simulator } = createTestSimulator();
    const storedLogs = [
      { id: 10, createdAt: new Date("2026-10-20T12:03:00.000Z") },
      { id: 8, createdAt: new Date("2026-10-20T12:02:00.000Z") },
      { id: 9, createdAt: new Date("2026-10-20T12:02:00.000Z") },
      { id: 7, createdAt: new Date("2026-10-20T12:01:00.000Z") },
      { id: 5, createdAt: new Date("2026-10-20T12:01:00.000Z") },
      { id: 6, createdAt: new Date("2026-10-20T12:01:00.000Z") },
      { id: 2, createdAt: new Date("2026-10-20T12:00:00.000Z") },
    ].map((log) => ({
      ...log,
      vector: String(log.id),
      coherence: 99,
      turbulence: "1",
      vectorsProcessed: log.id * 10,
    }));
    const requestedPages: Array<{ page: number; pageSize: number; snapshotId?: number }> = [];
    const router = createCoherenceSimulationRouter({
      simulator,
      listLogs: async (page, pageSize, snapshotId) => {
        requestedPages.push({ page, pageSize, ...(snapshotId === undefined ? {} : { snapshotId }) });
        const resolvedSnapshotId = snapshotId ?? Math.max(...storedLogs.map((log) => log.id));
        const snapshotLogs = storedLogs
          .filter((log) => log.id <= resolvedSnapshotId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id - left.id);
        return {
          items: snapshotLogs.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          total: snapshotLogs.length,
          snapshotId: resolvedSnapshotId,
        };
      },
      parseLogsQuery: parseLogsQueryForTest,
      parseLogsPage: async (page) => page,
    });

    await withServer(router, async (baseUrl) => {
      const pages: Array<Array<{ id: number; createdAt: string }>> = [];
      let snapshotId: number | undefined;
      for (const page of [1, 2, 3]) {
        if (page === 2) {
          storedLogs.push({
            id: 11,
            createdAt: new Date("2026-10-20T12:04:00.000Z"),
            vector: "11",
            coherence: 99,
            turbulence: "1",
            vectorsProcessed: 110,
          });
        }
        const query = new URLSearchParams({ page: String(page), pageSize: "3" });
        if (snapshotId !== undefined) query.set("snapshotId", String(snapshotId));
        const response = await fetch(`${baseUrl}/api/coherence-simulation/logs/page?${query}`);
        assert.equal(response.status, 200);
        const result = await response.json() as {
          items: Array<{ id: number; createdAt: string }>;
          page: number;
          pageSize: number;
          total: number;
          snapshotId: number | null;
        };
        assert.equal(result.page, page);
        assert.equal(result.pageSize, 3);
        assert.equal(result.total, 7);
        if (page === 1) snapshotId = result.snapshotId ?? undefined;
        assert.equal(snapshotId, 10);
        pages.push(result.items);
      }

      const ids = pages.flatMap((page) => page.map((log) => log.id));
      assert.deepEqual(ids, [10, 9, 8, 7, 6, 5, 2]);
      assert.equal(new Set(ids).size, 7, "No debe repetir registros entre páginas");
      assert.deepEqual(requestedPages, [
        { page: 1, pageSize: 3 },
        { page: 2, pageSize: 3, snapshotId: 10 },
        { page: 3, pageSize: 3, snapshotId: 10 },
      ]);

      for (const page of pages) {
        for (let index = 1; index < page.length; index += 1) {
          const previous = page[index - 1];
          const current = page[index];
          assert.ok(previous && current);
          const dateOrder = Date.parse(previous.createdAt) - Date.parse(current.createdAt);
          assert.ok(
            dateOrder > 0 || (dateOrder === 0 && previous.id > current.id),
            "Cada página debe conservar el orden descendente por fecha y luego por ID",
          );
        }
      }
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
      assert.equal(streamResponse.headers.get("cache-control"), "no-store, no-transform");
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
