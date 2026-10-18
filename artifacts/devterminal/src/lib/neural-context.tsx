import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  useCreateNeuralEvent,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export type NeuralOrigin = "terminal" | "runner" | "agents";
export type NeuralEvent = {
  id: number;
  origin: NeuralOrigin;
  eventType: string;
  content: string;
  createdAt: string;
};
export type NewNeuralEvent = Pick<NeuralEvent, "origin" | "eventType" | "content">;
export type NeuralStreamStatus = "connecting" | "connected" | "reconnecting";

const NeuralContext = createContext<{
  events: NeuralEvent[];
  streamStatus: NeuralStreamStatus;
  recordEvent: (event: NewNeuralEvent) => void;
} | null>(null);

export function NeuralProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<NeuralEvent[]>([]);
  const [streamStatus, setStreamStatus] = useState<NeuralStreamStatus>("connecting");
  const createEvent = useCreateNeuralEvent();
  const { toast } = useToast();

  useEffect(() => {
    const source = new EventSource("/api/neural-events/stream");
    const mergeEvents = (incoming: NeuralEvent[]) => {
      setEvents((current) => {
        const byId = new Map<number, NeuralEvent>();
        for (const event of [...incoming, ...current]) byId.set(event.id, event);
        return [...byId.values()]
          .sort((a, b) => b.id - a.id)
          .slice(0, 50);
      });
    };
    source.onopen = () => setStreamStatus("connected");
    source.onerror = () => setStreamStatus("reconnecting");
    source.addEventListener("snapshot", (rawEvent) => {
      try {
        mergeEvents(JSON.parse((rawEvent as MessageEvent<string>).data) as NeuralEvent[]);
      } catch {
        // Ignore malformed snapshots; EventSource will reconnect and request a fresh one.
      }
    });
    source.addEventListener("neural-event", (rawEvent) => {
      try {
        mergeEvents([(JSON.parse((rawEvent as MessageEvent<string>).data)) as NeuralEvent]);
      } catch {
        // Ignore malformed event frames without interrupting the stream.
      }
    });
    return () => {
      source.close();
    };
  }, []);

  const recordEvent = useCallback((event: NewNeuralEvent) => {
    createEvent.mutate({ data: event }, {
      onSuccess: created => setEvents(current =>
        [created, ...current.filter(item => item.id !== created.id)].slice(0, 50),
      ),
      onError: () => toast({ title: "No se pudo guardar la actividad neuronal.", variant: "destructive" }),
    });
  }, [createEvent, toast]);

  return <NeuralContext.Provider value={{ events, streamStatus, recordEvent }}>{children}</NeuralContext.Provider>;
}

export function useNeuralContext() {
  const context = useContext(NeuralContext);
  if (!context) throw new Error("useNeuralContext debe usarse dentro de NeuralProvider");
  return context;
}
