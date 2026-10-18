import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_SWARM_SYSTEM_PROMPT,
  buildAgentEvidenceMetrics,
  buildAgentSystemPrompt,
  classifyAgentAnalysis,
  citesSourceEvidence,
  hasAgentEvidence,
  parseOmega,
} from "./agent-evaluation.ts";

describe("agent swarm evaluation", () => {
  it("injects the Ley 4105 system prompt and agent role", () => {
    const prompt = buildAgentSystemPrompt("Audita seguridad.", "Security");
    assert.ok(prompt.startsWith(AGENT_SWARM_SYSTEM_PROMPT));
    assert.match(prompt, /Agente: Security/);
    assert.match(prompt, /Estado obligatorio del nodo: active/);
    assert.match(prompt, /Audita seguridad/);
  });

  it("builds active metrics from source and verifies exact citations", () => {
    const code = "export function calculateTotal(items) {\n  return items.length;\n}";
    assert.deepEqual(buildAgentEvidenceMetrics(code, "typescript"), {
      status: "active",
      language: "typescript",
      code_chars: code.length,
      code_lines: 3,
      non_empty_lines: 3,
      evidence_available: true,
    });
    assert.equal(citesSourceEvidence("Hallazgo: return items.length;", code), true);
    assert.equal(citesSourceEvidence("Sugerencia genérica", code), false);
    assert.equal(buildAgentEvidenceMetrics(undefined, undefined).status, "active");
  });

  it("parses only explicit Ω values in range", () => {
    assert.equal(parseOmega("Hallazgos...\nΩ: 0.91"), 0.91);
    assert.equal(parseOmega("Ω=0.4"), 0.4);
    assert.equal(parseOmega("Ω: 1.2"), null);
    assert.equal(parseOmega("sin índice"), null);
  });

  it("rewards only evidence-backed analysis above 0.85", () => {
    assert.equal(classifyAgentAnalysis(0.9, true), "rewarded");
    assert.equal(classifyAgentAnalysis(0.7, true), "review");
    assert.equal(classifyAgentAnalysis(0.4, true), "failed");
    assert.equal(classifyAgentAnalysis(0.99, false), "failed");
  });

  it("rejects empty and placeholder code context", () => {
    assert.equal(hasAgentEvidence("const total = 2;"), true);
    assert.equal(hasAgentEvidence("(no hay código en el workspace)"), false);
    assert.equal(hasAgentEvidence('console.log("Hello, DevTerminal!");'), false);
    assert.equal(hasAgentEvidence("  "), false);
  });
});
