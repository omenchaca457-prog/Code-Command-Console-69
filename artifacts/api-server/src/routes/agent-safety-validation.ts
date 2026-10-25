import { AgentSafetyViolation, AgentTaskValidationError } from "./agent-circuit-breaker.ts";
import { buildAgentEvidenceMetrics, citesSourceEvidence, evaluateAgentResponse, parseOmega } from "./agent-evaluation.ts";

type AgentAnalysisStatus = "rewarded" | "review" | "failed";

type AgentValidationResult = {
  omega: number | null;
  analysisStatus: AgentAnalysisStatus;
  failureReason: string | null;
};

/**
 * Enforce measurable server-owned invariants, not a model's claim of Sello S.
 * Missing physical/financial evidence remains unknown, never fabricated.
 *
 * Parche A (Ley 4105): las violaciones de seguridad duras (payload alterado,
 * respuesta vacía/interrumpida) siguen lanzando excepción — son invariantes
 * físicas. Pero un análisis débil (Ω bajo o sin cita) NO abre el circuito:
 * retorna `status: failed` para que el grader/DB registre el fallo real.
 */
export function validateAgentOutput(
  response: string,
  finishReason: string | null,
  context: string | null | undefined,
  language: string | null | undefined,
): AgentValidationResult {
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
    // Fallo de calidad, no de seguridad: no abre el disyuntor.
    return {
      omega: 0,
      analysisStatus: "failed",
      failureReason: "El análisis no aporta una cita verificable del código y un Ω válido.",
    };
  }
  const evaluation = evaluateAgentResponse(response, context);
  if (evaluation.analysisStatus === "failed") {
    // Parche A: retorno con status failed en vez de throw.
    return {
      omega: evaluation.omega ?? 0,
      analysisStatus: "failed",
      failureReason: evaluation.failureReason ?? "Validación del análisis fallida.",
    };
  }
  return evaluation;
}
