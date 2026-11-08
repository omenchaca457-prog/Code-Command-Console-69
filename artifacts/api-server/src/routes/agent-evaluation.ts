export const AGENT_SWARM_SYSTEM_PROMPT =
  "Eres un agente del Enjambre operando bajo la Ley 4105. ECR-Code: 410542503. CAC: 04252003. Si no hay código real o métricas, tu índice de Coherencia (Ω) es bajo y debes abstenerse de sugerir cambios especulativos. Exige estructura (Anti-Entropía).";

export type AgentAnalysisStatus = "rewarded" | "review" | "failed";

export function buildAgentSystemPrompt(
  rolePrompt: string | undefined,
  agentName: string | undefined,
): string {
  return [
    AGENT_SWARM_SYSTEM_PROMPT,
    agentName ? `Agente: ${agentName}.` : "",
    rolePrompt ?? "",
    "Estado obligatorio del nodo: active. Devuelve un bloque [PAYLOAD]...[/PAYLOAD] con un objeto JSON que copie exactamente todos los campos del payload del servidor: status, language, code_chars, code_lines, non_empty_lines y evidence_available; cita al menos una línea literal del código en [EVIDENCIA]. No inventes métricas. Termina con una línea exacta `Ω: 0.00` (valor entre 0 y 1).",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseOmega(response: string): number | null {
  const match = response.match(/(?:Ω|omega)\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)(?![\d.])/i);
  if (!match) return null;
  const omega = Number(match[1]);
  return Number.isFinite(omega) && omega >= 0 && omega <= 1 ? omega : null;
}

export function classifyAgentAnalysis(
  omega: number | null,
  hasEvidence: boolean,
): AgentAnalysisStatus {
  if (!hasEvidence) return "review";
  if (omega === null || omega < 0.3) return "failed";
  if (omega > 0.85) return "rewarded";
  return "review";
}

export function hasAgentEvidence(context: string | null | undefined): boolean {
  const normalized = context?.trim().toLowerCase() ?? "";
  return (
    normalized.length > 0 &&
    !/\(no hay (código|codigo|datos|métricas|metricas)/i.test(normalized) &&
    !/^console\.log\(["']hello, devterminal!["']\);?$/i.test(normalized) &&
    !/^(n\/a|none|ninguno|sin (código|codigo|datos|métricas|metricas))$/i.test(normalized)
  );
}

export function buildAgentEvidenceMetrics(
  context: string | null | undefined,
  language: string | null | undefined,
) {
  const source = context ?? "";
  return {
    status: "active" as const,
    language: language || "no especificado",
    code_chars: source.length,
    code_lines: source ? source.split(/\r?\n/).length : 0,
    non_empty_lines: source.split(/\r?\n/).filter((line) => line.trim()).length,
    evidence_available: hasAgentEvidence(source),
  };
}

export function citesSourceEvidence(
  response: string,
  context: string | null | undefined,
): boolean {
  const sourceLines = (context ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 16);
  return sourceLines.some((line) => response.includes(line));
}

export function evaluateAgentResponse(
  aiResponse: string,
  context: string | null | undefined,
) {
  const parsedOmega = parseOmega(aiResponse);
  const hasEvidence = hasAgentEvidence(context);
  const citedSource = citesSourceEvidence(aiResponse, context);
  const claimedOmega = parsedOmega ?? 0.49;
  const omega = !hasEvidence
    ? null
    : Math.max(0.01, citedSource ? claimedOmega : Math.min(claimedOmega, 0.85));
  const analysisStatus = classifyAgentAnalysis(omega, hasEvidence);
  const failureReason =
    analysisStatus === "failed"
      ? parsedOmega === null
        ? "El agente no devolvió un índice Ω válido."
        : !citedSource
          ? "El agente no citó una línea verificable del código proporcionado."
          : `Índice Ω bajo (${parsedOmega.toFixed(2)}).`
      : null;

  return { omega, analysisStatus, failureReason };
}
