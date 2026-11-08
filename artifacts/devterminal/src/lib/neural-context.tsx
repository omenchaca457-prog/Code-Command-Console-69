import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getListNeuralEventsQueryKey,
  useCreateNeuralEvent,
  useListNeuralEvents,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export type NeuralOrigin = "terminal" | "runner" | "agents" | "creator" | "motor";
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

function mergeEvents(...batches: NeuralEvent[][]): NeuralEvent[] {
  const byId = new Map<number, NeuralEvent>();
  for (const event of batches.flat()) byId.set(event.id, event);
  return [...byId.values()]
    .sort((left, right) => right.id - left.id)
    .slice(0, 50);
}

function parseNeuralEvent(value: unknown): NeuralEvent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "number" ||
    !Number.isSafeInteger(candidate.id) ||
    typeof candidate.origin !== "string" ||
    typeof candidate.eventType !== "string" ||
    typeof candidate.content !== "string" ||
    typeof candidate.createdAt !== "string"
  ) return null;
  return candidate as NeuralEvent;
}

export function NeuralProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<NeuralEvent[]>([]);
  const [streamStatus, setStreamStatus] = useState<NeuralStreamStatus>("connecting");
  const { data, isFetched } = useListNeuralEvents({
    query: {
      queryKey: getListNeuralEventsQueryKey(),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  const createEvent = useCreateNeuralEvent();
  const { toast } = useToast();

  useEffect(() => {
    if (Array.isArray(data)) {
      const validEvents = data.map(parseNeuralEvent).filter((event): event is NeuralEvent => event !== null);
      setEvents((current) => mergeEvents(validEvents, current));
    }
  }, [data]);

  useEffect(() => {
    if (!isFetched) return;

    const afterId = Array.isArray(data)
      ? data.reduce((largest, event) => Math.max(largest, parseNeuralEvent(event)?.id ?? 0), 0)
      : 0;
    const source = new EventSource(`/api/neural-events/stream?after=${afterId}`);
    setStreamStatus("connecting");
    source.onopen = () => setStreamStatus("connected");
    source.onerror = () => setStreamStatus("reconnecting");
    source.onmessage = (message) => {
      try {
        const event = parseNeuralEvent(JSON.parse(message.data) as unknown);
        if (event) setEvents((current) => mergeEvents(current, [event]));
      } catch {
        // Ignore malformed frames; EventSource will keep delivering later events.
      }
    };

    return () => {
      source.close();
      setStreamStatus("connecting");
    };
  }, [data, isFetched]);

  const recordEvent = useCallback((event: NewNeuralEvent) => {
    createEvent.mutate({ data: event }, {
      onSuccess: created => setEvents(current => mergeEvents(current, [created])),
      onError: () => toast({ title: "No se pudo guardar la actividad neuronal.", variant: "destructive" }),
    });
  }, [createEvent, toast]);

  return (
    <NeuralContext.Provider value={{ events, streamStatus, recordEvent }}>
      {children}
    </NeuralContext.Provider>
  );
}

export function useNeuralContext() {
  const context = useContext(NeuralContext);
  if (!context) throw new Error("useNeuralContext debe usarse dentro de NeuralProvider");
  return context;
}
