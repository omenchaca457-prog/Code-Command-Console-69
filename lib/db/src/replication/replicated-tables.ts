export const REPLICATED_TABLES = [
  {
    name: "conversations",
    keyType: "integer",
    columns: ["id", "title", "created_at"],
  },
  {
    name: "agents",
    keyType: "text",
    columns: [
      "id", "name", "xp", "failed_analyses", "successful_tasks",
      "failed_tasks", "last_omega", "last_failure", "status", "updated_at",
    ],
  },
  {
    name: "messages",
    keyType: "integer",
    columns: [
      "id", "conversation_id", "role", "content", "created_at", "idempotency_key",
    ],
  },
  {
    name: "prompts",
    keyType: "integer",
    columns: ["id", "agent_id", "conversation_id", "name", "content", "created_at"],
  },
  {
    name: "snippets",
    keyType: "integer",
    columns: ["id", "title", "code", "language", "created_at", "updated_at", "last_run_at"],
  },
  {
    name: "neural_events",
    keyType: "integer",
    columns: ["id", "origin", "event_type", "content", "created_at"],
  },
  {
    name: "simulation_logs",
    keyType: "integer",
    columns: ["id", "vector", "coherence", "turbulence", "vectors_processed", "created_at"],
  },
] as const;

export type ReplicatedTableName = (typeof REPLICATED_TABLES)[number]["name"];
export type ReplicationOperation = "upsert" | "delete";

export type ReplicationEvent = {
  id: number | string;
  event_id: string;
  table_name: ReplicatedTableName;
  record_key: string;
  operation: ReplicationOperation;
  payload: Record<string, unknown>;
  attempts: number;
};

export function isReplicatedTableName(value: string): value is ReplicatedTableName {
  return REPLICATED_TABLES.some((table) => table.name === value);
}

export function getReplicatedTable(name: string) {
  return REPLICATED_TABLES.find((table) => table.name === name);
}
