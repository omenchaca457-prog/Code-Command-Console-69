import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getListNeuralEventsQueryKey,
  useCreateNeuralEvent,
  useListNeuralEvents,
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

const NeuralContext = createContext<{
  events: NeuralEvent[];
  recordEvent: (event: NewNeuralEvent) => void;
} | null>(null);

export function NeuralProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<NeuralEvent[]>([]);
  const { data } = useListNeuralEvents({
    query: {
      queryKey: getListNeuralEventsQueryKey(),
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  });
  const createEvent = useCreateNeuralEvent();
  const { toast } = useToast();

  useEffect(() => {
    if (data) setEvents(data);
  }, [data]);

  const recordEvent = useCallback((event: NewNeuralEvent) => {
    createEvent.mutate({ data: event }, {
      onSuccess: created => setEvents(current =>
        [created, ...current.filter(item => item.id !== created.id)].slice(0, 50),
      ),
      onError: () => toast({ title: "No se pudo guardar la actividad neuronal.", variant: "destructive" }),
    });
  }, [createEvent, toast]);

  return <NeuralContext.Provider value={{ events, recordEvent }}>{children}</NeuralContext.Provider>;
}

export function useNeuralContext() {
  const context = useContext(NeuralContext);
  if (!context) throw new Error("useNeuralContext debe usarse dentro de NeuralProvider");
  return context;
}
