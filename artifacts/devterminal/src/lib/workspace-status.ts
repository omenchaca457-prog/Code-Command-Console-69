import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const statusSchema = z.object({
  database: z.enum(["connected", "disconnected"]),
  node: z.string(),
  uptime: z.number().finite().nonnegative(),
  integrations: z.array(
    z.object({ id: z.string(), name: z.string(), configured: z.boolean() }),
  ),
});

export interface WorkspaceStatus {
  database: "connected" | "disconnected";
  node: string;
  uptime: number;
  integrations: { id: string; name: string; configured: boolean }[];
}
export function useWorkspaceStatus() {
  return useQuery<WorkspaceStatus>({
    queryKey: ["workspace-status"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/workspace/status", { signal });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("No se pudo conectar con el servidor.");
      return statusSchema.parse(await response.json());
    },
    retry: 1,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
