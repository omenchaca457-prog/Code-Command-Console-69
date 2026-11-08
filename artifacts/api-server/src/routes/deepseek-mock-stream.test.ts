import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emitMockDeepseekStream,
  type DeepseekMockScenario,
} from "./deepseek-mock-stream.ts";

function createResponse(onWrite?: (frame: string) => void) {
  const chunks: string[] = [];
  return {
    chunks,
    response: {
      destroyed: false,
      write(chunk: string) {
        chunks.push(chunk);
        onWrite?.(chunk);
        return true;
      },
    },
  };
}

const runScenario = async (scenario: DeepseekMockScenario) => {
  const { chunks, response } = createResponse();
  await emitMockDeepseekStream(response, new AbortController().signal, scenario, 0);
  return chunks;
};

describe("DeepSeek deterministic mock SSE stream", () => {
  it("emits fragmented deltas and completes without calling the provider", async () => {
    const chunks = await runScenario("success");
    assert.equal(chunks.length, 4);
    assert.match(chunks[0] ?? "", /SQ-AI/);
    assert.match(chunks.at(-1) ?? "", /\[DONE\]/);
  });

  it("simulates a tool call between streamed text fragments", async () => {
    const chunks = await runScenario("tool_call");
    assert.match(chunks.join(""), /\"name\":\"get_current_code\"/);
    assert.match(chunks.join(""), /La herramienta simulada devolvió código verificable/);
    assert.match(chunks.at(-1) ?? "", /\[DONE\]/);
  });

  it("emits a controlled error after partial text so callers can retain the buffer", async () => {
    const chunks = await runScenario("partial_error");
    const partialIndex = chunks.findIndex((frame) => frame.includes("Fragmento conservado"));
    const errorIndex = chunks.findIndex((frame) => frame.includes("Error simulado"));
    assert.ok(partialIndex >= 0);
    assert.ok(errorIndex > partialIndex);
    assert.match(chunks[1] ?? "", /análisis, conexión/);
  });

  it("stops writing promptly when the client aborts", async () => {
    const controller = new AbortController();
    let writes = 0;
    const { chunks, response } = createResponse(() => {
      writes += 1;
      controller.abort();
    });
    await emitMockDeepseekStream(response, controller.signal, "success", 0);
    assert.equal(writes, 1);
    assert.equal(chunks.some((frame) => frame.includes("[DONE]")), false);
  });
});
