import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { createDeepseekToolExecutor } from "./deepseek-tools.ts";

const toolPath = "artifacts/api-server/src/routes/notification-fixture.ts";

async function withFixture(run: (target: string) => Promise<void>) {
  const directory = await mkdtemp(resolve(process.cwd(), "src/routes/.notification-test-"));
  try {
    await run(resolve(directory, "fixture.ts"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function writeToolArguments(content: string) {
  return JSON.stringify({ path: toolPath, content });
}

describe("DeepSeek autonomous write notification failures", () => {
  it("reports the applied write and does not retry when event persistence fails", async () => {
    await withFixture(async (target) => {
      let persistenceCalls = 0;
      let publishCalls = 0;
      const executor = createDeepseekToolExecutor({
        writeProjectCode: async (_path, content) => {
          await writeFile(target, content, "utf8");
          return { path: toolPath, bytes: Buffer.byteLength(content) };
        },
        persistNeuralEvent: async () => {
          persistenceCalls += 1;
          throw new Error("database unavailable");
        },
        publishNeuralEvent: async () => {
          publishCalls += 1;
        },
      });

      const response = JSON.parse(await executor(
        "write_project_file",
        writeToolArguments("export const saved = true;\n"),
      ));

      assert.equal(await readFile(target, "utf8"), "export const saved = true;\n");
      assert.equal(response.status, "written");
      assert.deepEqual(response.notification, {
        status: "failed",
        stage: "persistence",
        retry: "not_attempted",
        recovery: "No se reintentó automáticamente porque no se puede descartar que el guardado se haya confirmado tarde.",
        message: "El archivo se guardó, pero falló el almacenamiento del aviso de actividad.",
      });
      assert.equal(persistenceCalls, 1);
      assert.equal(publishCalls, 0);
    });
  });

  it("reports persisted notice recovery and does not retry a failed realtime publish", async () => {
    await withFixture(async (target) => {
      let persistenceCalls = 0;
      let publishCalls = 0;
      const executor = createDeepseekToolExecutor({
        writeProjectCode: async (_path, content) => {
          await writeFile(target, content, "utf8");
          return { path: toolPath, bytes: Buffer.byteLength(content) };
        },
        persistNeuralEvent: async (event) => {
          persistenceCalls += 1;
          return { ...event, id: 42, createdAt: new Date("2026-10-18T12:00:00.000Z") };
        },
        publishNeuralEvent: async () => {
          publishCalls += 1;
          throw new Error("notifier unavailable");
        },
      });

      const response = JSON.parse(await executor(
        "write_project_file",
        writeToolArguments("export const saved = true;\n"),
      ));

      assert.equal(await readFile(target, "utf8"), "export const saved = true;\n");
      assert.equal(response.status, "written");
      assert.deepEqual(response.notification, {
        status: "failed",
        stage: "realtime",
        retry: "not_attempted",
        recovery: "El evento quedó guardado y puede recuperarse cuando el flujo se reconecte.",
        message: "El archivo y el aviso quedaron guardados, pero falló su difusión en tiempo real.",
      });
      assert.equal(persistenceCalls, 1);
      assert.equal(publishCalls, 1);
    });
  });

});
