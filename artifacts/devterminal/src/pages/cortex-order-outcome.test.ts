import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CortexOrderOutcome } from "./cortex-order-outcome.tsx";

const finalOrder = "ORDEN FINAL: conservar el trabajo y validar la entrega.";

describe("Cortex final order delivery status", () => {
  const outcomes = [
    ["delivered", "Evento neural OpenAI-Master difundido en vivo."],
    ["persisted_only", "Evento neural guardado; difusión en vivo pendiente de reconexión."],
    ["persistence_failed", "La orden final está lista, pero el evento neural no se pudo guardar."],
  ] as const;

  for (const [status, message] of outcomes) {
    it(`keeps the final order visible when delivery is ${status}`, () => {
      const markup = renderToStaticMarkup(
        createElement(CortexOrderOutcome, { order: finalOrder, status }),
      );

      assert.ok(markup.includes(finalOrder));
      assert.ok(markup.includes(message));
      assert.match(markup, /role="status"/);
    });
  }

  for (const status of [undefined, null, "unknown-status"]) {
    it(`does not call an unknown or missing status delivered (${String(status)})`, () => {
      const markup = renderToStaticMarkup(
        createElement(CortexOrderOutcome, { order: finalOrder, status }),
      );

      assert.ok(markup.includes(finalOrder));
      assert.ok(markup.includes("Estado de difusión del evento neural no confirmado."));
      assert.ok(!markup.includes("difundido en vivo"));
    });
  }
});
