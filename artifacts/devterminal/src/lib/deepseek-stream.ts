export type DeepseekStreamResult = {
  text: string;
  stopped: boolean;
};

export async function consumeDeepseekSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onDelta: (delta: string) => void | Promise<void>,
): Promise<DeepseekStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  const processFrame = async (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;

    const payload = JSON.parse(data) as { delta?: string; error?: string };
    if (payload.error) throw new Error(payload.error);
    if (typeof payload.delta === "string") {
      text += payload.delta;
      await onDelta(payload.delta);
    }
  };

  try {
    while (!signal.aborted) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        if (!signal.aborted) throw error;
        break;
      }
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        await processFrame(frame);
        if (signal.aborted) break;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        await processFrame(buffer);
      } catch (error) {
        if (!signal.aborted) throw error;
      }
    }
    return { text, stopped: signal.aborted };
  } finally {
    signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
}

export async function persistDeepseekAssistantResponse(
  text: string,
  stopped: boolean,
  persist: (content: string) => Promise<void>,
): Promise<void> {
  if (!text.trim()) return;
  const content = stopped
    ? `${text}\n\n[RESPUESTA PARCIAL: flujo interrumpido]`
    : text;
  await persist(content);
}
