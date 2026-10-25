import { AgentSafetyViolation, AgentTaskValidationError } from "./agent-circuit-breaker.ts";
import { buildAgentEvidenceMetrics, citesSourceEvidence, evaluateAgentResponse, parseOmega } from "./agent-evaluation.ts";

/**
 * Enforce measurable server-owned invariants, not a model's claim of Sello S.
 * Missing physical/financial evidence remains unknown, never fabricated.
 */
export function validateAgentOutput(
  response: string,
  finishReason: string | null,
  context: string | null | undefined,
  language: string | null | undefined,
) {
  if (!response.trim() || finishReason !== "stop") {
    throw new AgentTaskValidationError("Respuesta del agente vacía, incompleta o interrumpida.");
  }
  const payload = response.match(/\[PAYLOAD\]\s*([\s\S]*?)\s*\[\/PAYLOAD\]/);
  if (!payload) throw new AgentTaskValidationError("El agente no devolvió el payload verificable.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload[1]);
  } catch {
    throw new AgentTaskValidationError("El payload del agente no es JSON válido.");
  }
  const expected = buildAgentEvidenceMetrics(context, language);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      Object.entries(expected).some(([key, value]) =>
        (parsed as Record<string, unknown>)[key] !== value)) {
    throw new AgentSafetyViolation("Deriva del payload: el agente alteró parámetros verificables del servidor.");
  }
  if (expected.evidence_available && (!citesSourceEvidence(response, context) || parseOmega(response) === null)) {
    throw new AgentTaskValidationError("El análisis no aporta una cita verificable del código y un Ω válido.");
  }
  const evaluation = evaluateAgentResponse(response, context);
  if (evaluation.analysisStatus === "failed") {
    throw new AgentTaskValidationError(evaluation.failureReason ?? "Validación del análisis fallida.");
  }
  return evaluation;
}
