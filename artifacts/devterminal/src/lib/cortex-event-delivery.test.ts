import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNeuralEventDeliveryPresentation } from "./cortex-event-delivery.ts";

describe("Cortex neural-event delivery presentation", () => {
  it("shows a distinct page message for every delivery outcome", () => {
    assert.deepEqual(getNeuralEventDeliveryPresentation("delivered"), {
      message: "Evento neural OpenAI-Master difundido en vivo.",
      className: "border-[#00ff41]/20 bg-[#00ff41]/[0.035] text-[#83c991]",
    });
    assert.deepEqual(getNeuralEventDeliveryPresentation("persisted_only"), {
      message: "Evento neural guardado; difusión en vivo pendiente de reconexión.",
      className: "border-[#ffcf5c]/20 bg-[#ffcf5c]/[0.035] text-[#e5c779]",
    });
    assert.deepEqual(getNeuralEventDeliveryPresentation("persistence_failed"), {
      message: "La orden final está lista, pero el evento neural no se pudo guardar.",
      className: "border-[#ff4562]/20 bg-[#ff4562]/[0.05] text-[#ff8798]",
    });
  });
});
