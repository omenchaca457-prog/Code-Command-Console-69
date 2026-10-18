export type DeepseekMockScenario = "success" | "tool_call" | "partial_error";

export interface MockSseResponse {
  write(chunk: string): unknown;
  destroyed?: boolean;
}

const encode = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function emitMockDeepseekStream(
  response: MockSseResponse,
  signal: AbortSignal,
  scenario: DeepseekMockScenario,
  stepDelayMs = 3,
): Promise<void> {
  const frames: unknown[] = scenario === "tool_call"
    ? [
        { delta: "Iniciando análisis. " },
        {
          tool_call: {
            id: "mock-call-1",
            name: "get_current_code",
            arguments: { path: "src/example.ts" },
            result: "export const value = 4105;",
          },
        },
        { delta: "La herramienta simulada devolvió código verificable. " },
        { delta: "ECR-Code: 410542503." },
      ]
    : scenario === "partial_error"
      ? [
          { delta: "Fragmento conservado: " },
          { delta: "respuesta parcial con acentos: análisis, conexión." },
          { error: "Error simulado después de emitir fragmentos." },
        ]
      : [
          { delta: "SQ-AI " },
          { delta: "stream simulado " },
          { delta: "completado: coherencia." },
        ];

  for (const frame of frames) {
    if (signal.aborted || response.destroyed) return;
    response.write(encode(frame));
    await pause(stepDelayMs);
  }

  if (!signal.aborted && !response.destroyed) {
    response.write("data: [DONE]\n\n");
  }
}
