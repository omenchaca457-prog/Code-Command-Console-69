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
    "Evalúa la coherencia con evidencia verificable y termina la respuesta con una línea exacta `Ω: 0.00` (valor entre 0 y 1).",
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
  if (!hasEvidence || omega === null || omega < 0.5) return "failed";
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
