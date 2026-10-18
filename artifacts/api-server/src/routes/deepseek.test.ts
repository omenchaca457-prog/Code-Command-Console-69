import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeepseekMessages,
  formatMessageContext,
} from "./deepseek-prompt.ts";

describe("buildDeepseekMessages", () => {
  it("inyecta las conversaciones en el mensaje de usuario sin duplicar mensajes", () => {
    const messages = buildDeepseekMessages(
      "¿Qué títulos ves?",
      "Editor: TypeScript",
      "1. [2026-10-17T12:00:00.000Z] assistant: Primera conversación",
    );

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.role, "system");
    assert.match(messages[0]?.content ?? "", /LEY 4105 DE COHERENCIA ETERNA/);
    assert.equal(messages[1]?.role, "user");
    assert.match(messages[1]?.content ?? "", /CONTEXTO DE BASE DE DATOS - Mensajes/);
    assert.match(messages[1]?.content ?? "", /assistant: Primera conversación/);
    assert.match(messages[1]?.content ?? "", /Editor: TypeScript/);
    assert.match(messages[1]?.content ?? "", /Pregunta del Arquitecto:\n¿qué títulos ves\?/i);
  });

  it("mantiene el placeholder de base de datos cuando no hay mensajes", () => {
    const messages = buildDeepseekMessages(
      "Ayuda",
      null,
      formatMessageContext([]),
    );

    assert.equal(messages.length, 2);
    assert.match(messages[1]?.content ?? "", /\(sin mensajes registrados\)/);
    assert.match(messages[1]?.content ?? "", /Pregunta del Arquitecto:\nAyuda/);
  });

  it("formatea role, content y fechas de mensajes recibidos", () => {
    const context = formatMessageContext([
      {
        role: "user",
        content: "Auditoría",
        created_at: new Date("2026-10-17T12:00:00.000Z"),
      },
      {
        role: "assistant",
        content: "Consulta SQL",
        created_at: "2026-10-16T09:30:00.000Z",
      },
    ]);

    assert.equal(
      context,
      "1. [2026-10-17T12:00:00.000Z] user: Auditoría\n2. [2026-10-16T09:30:00.000Z] assistant: Consulta SQL",
    );
  });
});
