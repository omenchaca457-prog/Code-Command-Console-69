export async function consumeDeepseekStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onDelta: (delta: string) => Promise<void>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processFrame = async (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;

    const payload = JSON.parse(data) as { delta?: string; error?: string };
    if (payload.error) throw new Error(payload.error);
    if (typeof payload.delta === "string") await onDelta(payload.delta);
  };

  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        await processFrame(frame);
        if (signal.aborted) break;
      }
    }

    if (signal.aborted) return;
    buffer += decoder.decode();
    if (buffer.trim()) await processFrame(buffer);
  } finally {
    signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
}
