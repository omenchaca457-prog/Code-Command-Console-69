import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeDeepseekStream } from "./deepseek-stream";

function readableChunks(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

test("decodes fragmented SSE frames, including UTF-8 split across chunks", async () => {
  const input = new TextEncoder().encode(
    'data: {"delta":"¡Hola"}\r\n\r\ndata: {"delta":" mundo"}\r\n\r\ndata: [DONE]\r\n\r\n',
  );
  const multibyteOffset = input.indexOf(new TextEncoder().encode("¡")[0]);
  const body = readableChunks([
    input.slice(0, multibyteOffset + 1),
    input.slice(multibyteOffset + 1, multibyteOffset + 2),
    input.slice(multibyteOffset + 2, 18),
    input.slice(18),
  ]);
  const deltas: string[] = [];

  await consumeDeepseekStream(body, new AbortController().signal, async (delta) => {
    deltas.push(delta);
  });

  assert.deepEqual(deltas, ["¡Hola", " mundo"]);
});

test("processes the final SSE frame when the stream ends without a blank separator", async () => {
  const body = readableChunks([
    new TextEncoder().encode('data: {"delta":"respuesta final"}'),
  ]);
  const deltas: string[] = [];

  await consumeDeepseekStream(body, new AbortController().signal, async (delta) => {
    deltas.push(delta);
  });

  assert.deepEqual(deltas, ["respuesta final"]);
});

test("surfaces provider error frames to the terminal caller", async () => {
  const message = "La cuenta de DeepSeek no tiene saldo disponible.";
  const body = readableChunks([
    new TextEncoder().encode(`data: ${JSON.stringify({ error: message })}\n\n`),
  ]);

  await assert.rejects(
    consumeDeepseekStream(body, new AbortController().signal, async () => undefined),
    { message },
  );
});

test("cancels an in-progress response reader when the user aborts", async () => {
  let readerCancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"delta":"parte"}\n\n'));
    },
    cancel() {
      readerCancelled = true;
    },
  });
  const controller = new AbortController();
  let firstDelta: (() => void) | undefined;
  const deltaReceived = new Promise<void>((resolve) => {
    firstDelta = resolve;
  });
  const consuming = consumeDeepseekStream(body, controller.signal, async () => {
    firstDelta?.();
  });

  await deltaReceived;
  controller.abort();
  await consuming;

  assert.equal(readerCancelled, true);
});
