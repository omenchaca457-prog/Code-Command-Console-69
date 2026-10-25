async function main() {
  const response = await fetch("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Analiza el flujo de coherencia actual y emite tu primer reporte operativo.",
      context: "Auditoría inicial solicitada por el Arquitecto. Nodos Security y Optimizer en observación.",
      language: "javascript",
      agentId: "orquestador-openai",
      agentName: "ORQUESTADOR-OPENAI",
      idempotencyKey: "activacion-operativa-v1",
    }),
    signal: AbortSignal.timeout(60000),
  });
  console.log(`HTTP ${response.status} ${response.statusText}`);
  console.log(await response.text());
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Error de petición:", error.message);
  process.exitCode = 1;
});
