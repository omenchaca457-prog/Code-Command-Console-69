import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeepseekMessages } from "./deepseek-prompt.ts";

describe("buildDeepseekMessages", () => {
  it("inyecta el contexto SQL en un único mensaje de sistema", () => {
    const messages = buildDeepseekMessages(
      "Revisa el proyecto",
      "Editor: TypeScript",
      "Snippet: API segura (typescript)\nconst seguro = true;",
    );

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.role, "system");
    assert.match(messages[0]?.content ?? "", /LEY 4105 DE COHERENCIA ETERNA/);
    assert.match(messages[0]?.content ?? "", /Snippet: API segura/);
    assert.equal(messages[1]?.role, "user");
    assert.match(messages[1]?.content ?? "", /Editor: TypeScript/);
    assert.match(messages[1]?.content ?? "", /Revisa el proyecto/);
  });

  it("mantiene un solo par de mensajes cuando no hay contexto guardado", () => {
    const messages = buildDeepseekMessages("Ayuda", null, "");

    assert.equal(messages.length, 2);
    assert.match(messages[0]?.content ?? "", /No hay snippets guardados/);
    assert.equal(messages[1]?.content, "Ayuda");
  });
});
