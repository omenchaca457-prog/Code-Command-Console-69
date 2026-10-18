import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeepseekMessages,
  formatConversationContext,
} from "./deepseek-prompt.ts";

describe("buildDeepseekMessages", () => {
  it("inyecta las conversaciones en el mensaje de usuario sin duplicar mensajes", () => {
    const messages = buildDeepseekMessages(
      "¿Qué títulos ves?",
      "Editor: TypeScript",
      "1. [2026-10-17T12:00:00.000Z] Primera conversación",
    );

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.role, "system");
    assert.match(messages[0]?.content ?? "", /LEY 4105 DE COHERENCIA ETERNA/);
    assert.equal(messages[1]?.role, "user");
    assert.match(messages[1]?.content ?? "", /CONTEXTO DE BASE DE DATOS - Últimas conversaciones/);
    assert.match(messages[1]?.content ?? "", /Primera conversación/);
    assert.match(messages[1]?.content ?? "", /Editor: TypeScript/);
    assert.match(messages[1]?.content ?? "", /Pregunta del Arquitecto:\n¿qué títulos ves\?/i);
  });

  it("mantiene el placeholder de base de datos cuando no hay conversaciones", () => {
    const messages = buildDeepseekMessages(
      "Ayuda",
      null,
      formatConversationContext([]),
    );

    assert.equal(messages.length, 2);
    assert.match(messages[1]?.content ?? "", /\(sin conversaciones registradas\)/);
    assert.match(messages[1]?.content ?? "", /Pregunta del Arquitecto:\nAyuda/);
  });

  it("formatea títulos y fechas ISO de las conversaciones recibidas", () => {
    const context = formatConversationContext([
      {
        id: 8,
        title: "Auditoría",
        created_at: new Date("2026-10-17T12:00:00.000Z"),
      },
      {
        id: 7,
        title: "Consulta SQL",
        created_at: new Date("2026-10-16T09:30:00.000Z"),
      },
    ]);

    assert.equal(
      context,
      "1. [2026-10-17T12:00:00.000Z] Auditoría\n2. [2026-10-16T09:30:00.000Z] Consulta SQL",
    );
  });
});
