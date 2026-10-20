import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentSafetyViolation, AgentCircuitBreaker } from "./agent-circuit-breaker.ts";
import { buildAgentEvidenceMetrics } from "./agent-evaluation.ts";
import { validateAgentOutput } from "./agent-safety-validation.ts";

const context = "export const validatedTotal = items.length;";
const response = (payload = buildAgentEvidenceMetrics(context, "typescript"), omega = "0.9") =>
  `[PAYLOAD]${JSON.stringify(payload)}[/PAYLOAD]\n[EVIDENCIA]${context}\nΩ: ${omega}`;

describe("agent task safety validation", () => {
  it("accepts a complete evidence-backed response", () => {
    assert.equal(validateAgentOutput(response(), "stop", context, "typescript").analysisStatus, "rewarded");
  });

  it("rejects empty, truncated, malformed and unsupported results", () => {
    assert.throws(() => validateAgentOutput("", "stop", context, "typescript"));
    assert.throws(() => validateAgentOutput(response(), "length", context, "typescript"));
    assert.throws(() => validateAgentOutput(response(), "content_filter", context, "typescript"));
    assert.throws(() => validateAgentOutput("Ω: 0.99", "stop", context, "typescript"));
    assert.throws(() => validateAgentOutput("[PAYLOAD]{bad}[/PAYLOAD]", "stop", context, "typescript"));
    assert.throws(() => validateAgentOutput(response(undefined, "0.1"), "stop", context, "typescript"));
    assert.throws(() => validateAgentOutput(response().replace(context, "not a citation"), "stop", context, "typescript"));
  });

  it("opens immediately on changed server metrics, before a result can be stored", async () => {
    const circuit = new AgentCircuitBreaker();
    let persisted = false;
    await assert.rejects(circuit.execute("coherence", async () => {
      validateAgentOutput(response({ ...buildAgentEvidenceMetrics(context, "typescript"), code_chars: 0 }), "stop", context, "typescript");
      persisted = true;
    }), AgentSafetyViolation);
    assert.equal(persisted, false);
    assert.equal(circuit.getSnapshot("coherence").state, "OPEN");
  });

  it("does not invent Ω or Sello S when evidence is missing", () => {
    const noEvidence = `[PAYLOAD]${JSON.stringify(buildAgentEvidenceMetrics(undefined, undefined))}[/PAYLOAD]\nNo hay evidencia.`;
    assert.equal(validateAgentOutput(noEvidence, "stop", undefined, undefined).omega, null);
  });
});
