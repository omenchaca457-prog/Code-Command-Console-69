import React, { type ReactNode } from "react";
import {
  getNeuralEventDeliveryPresentation,
  type NeuralEventDeliveryStatus,
} from "@/lib/cortex-event-delivery";

type CortexOrderOutcomeProps = {
  order: ReactNode;
  status: unknown;
  isLoading?: boolean;
};

function getDeliveryMessage(status: unknown) {
  if (
    status === "delivered"
    || status === "persisted_only"
    || status === "persistence_failed"
  ) {
    return getNeuralEventDeliveryPresentation(status as NeuralEventDeliveryStatus);
  }
  return {
    message: "Estado de difusión del evento neural no confirmado.",
    className: "border-white/[0.1] bg-white/[0.025] text-[#9aa59e]",
  };
}

export function CortexOrderOutcome({ order, status, isLoading = false }: CortexOrderOutcomeProps) {
  const delivery = getDeliveryMessage(status);

  return (
    <>
      <div className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-[#b4c0b9] sm:text-[13px]">
        {order}
        {isLoading && (
          <span
            aria-label="Escribiendo"
            className="ml-1 inline-block h-3.5 w-1 animate-pulse align-middle"
            style={{ background: "#b69cff" }}
          />
        )}
      </div>
      <p role="status" className={`mt-3 border px-3 py-2 font-mono text-[10px] leading-5 ${delivery.className}`}>
        {delivery.message}
      </p>
    </>
  );
}
