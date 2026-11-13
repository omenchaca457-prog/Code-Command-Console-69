try {
  const port = Number(process.env.PORT || "3000");
  const response = await fetch(`http://127.0.0.1:${port}/api/healthz`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok || (await response.json()).status !== "ok") process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
