/** Bound read-only preparation; missing context is explicit, never fabricated. */
export async function boundedContextRead(
  read: () => Promise<string>,
  timeoutMs: number,
  label: string,
): Promise<string> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("context_timeout")), timeoutMs);
      }),
    ]);
  } catch {
    return JSON.stringify({ unavailable: true, source: label, reason: "context_read_failed_or_timed_out" });
  } finally {
    clearTimeout(timeout);
  }
}
