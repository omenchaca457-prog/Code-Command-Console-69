const MAX_CELL_CHARS = 4000;

function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonSafe(nested)]),
    );
  }
  return value;
}

export function serializeSqlRows(
  rows: Record<string, unknown>[],
): Record<string, string | null>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const safe = toJsonSafe(value);
        const text = typeof safe === "string" ? safe : JSON.stringify(safe);
        return [key, text?.slice(0, MAX_CELL_CHARS) ?? null];
      }),
    ),
  );
}
