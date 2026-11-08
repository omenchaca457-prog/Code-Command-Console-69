export type NeuralEventDeliveryStatus =
  | "delivered"
  | "persisted_only"
  | "persistence_failed";

export function getNeuralEventDeliveryPresentation(
  status: NeuralEventDeliveryStatus,
) {
  if (status === "delivered") {
    return {
      message: "Evento neural OpenAI-Master difundido en vivo.",
      className: "border-[#00ff41]/20 bg-[#00ff41]/[0.035] text-[#83c991]",
    };
  }
  if (status === "persisted_only") {
    return {
      message: "Evento neural guardado; difusión en vivo pendiente de reconexión.",
      className: "border-[#ffcf5c]/20 bg-[#ffcf5c]/[0.035] text-[#e5c779]",
    };
  }
  return {
    message: "La orden final está lista, pero el evento neural no se pudo guardar.",
    className: "border-[#ff4562]/20 bg-[#ff4562]/[0.05] text-[#ff8798]",
  };
}
