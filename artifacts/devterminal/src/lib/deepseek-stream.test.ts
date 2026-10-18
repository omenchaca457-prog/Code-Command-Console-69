import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeDeepseekSse,
  persistDeepseekAssistantResponse,
} from "./deepseek-stream.ts";

const encoder = new TextEncoder();

describe("SQ-AI terminal stream handling", () => {
  it("reassembles SSE frames split across byte chunks without losing deltas", async () => {
    const controller = new AbortController();
    const chunks = [
      'data: {"del',
      'ta":"Hola"}\n\n',
      'data: {"delta":" mundo"}\n\n',
      "data: [DONE]\n\n",
    ];
    const body = new ReadableStream<Uint8Array>({
      pull(streamController) {
        const next = chunks.shift();
        if (next) streamController.enqueue(encoder.encode(next));
        else streamController.close();
      },
    });
    const visible: string[] = [];

    const result = await consumeDeepseekSse(body, controller.signal, (delta) => {
      visible.push(delta);
    });

    assert.deepEqual(visible, ["Hola", " mundo"]);
    assert.equal(result.text, "Hola mundo");
    assert.equal(result.stopped, false);
  });

  it("stops reading immediately and persists the response already received", async () => {
    const controller = new AbortController();
    let streamCancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode('data: {"delta":"mitad guardable"}\n\n'));
      },
      cancel() {
        streamCancelled = true;
      },
    });
    const visible: string[] = [];
    const persisted: string[] = [];

    const result = await consumeDeepseekSse(body, controller.signal, (delta) => {
      visible.push(delta);
      controller.abort();
    });
    await persistDeepseekAssistantResponse(result.text, result.stopped, async (content) => {
      persisted.push(content);
    });

    assert.deepEqual(visible, ["mitad guardable"]);
    assert.equal(result.text, "mitad guardable");
    assert.equal(result.stopped, true);
    assert.equal(streamCancelled, true);
    assert.deepEqual(persisted, [
      "mitad guardable\n\n[RESPUESTA PARCIAL: flujo interrumpido]",
    ]);
  });

  it("keeps received text available for partial persistence when the server reports an error", async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode('data: {"delta":"texto anterior"}\n\n'));
        streamController.enqueue(encoder.encode('data: {"error":"fallo simulado"}\n\n'));
        streamController.close();
      },
    });
    let received = "";
    const persisted: string[] = [];

    await assert.rejects(
      consumeDeepseekSse(body, controller.signal, (delta) => {
        received += delta;
      }),
      /fallo simulado/,
    );
    await persistDeepseekAssistantResponse(received, true, async (content) => {
      persisted.push(content);
    });

    assert.deepEqual(persisted, [
      "texto anterior\n\n[RESPUESTA PARCIAL: flujo interrumpido]",
    ]);
  });
});
