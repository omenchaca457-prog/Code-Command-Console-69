const MAX_EDITOR_CODE = 12_000;
const MAX_ACTIVITY_ITEMS = 12;

type CortexInput = {
  editor?: { language?: unknown; code?: unknown };
  activity?: unknown;
};

export function validateCortexInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El contexto de Cortex debe ser un objeto.");
  }
  const input = value as CortexInput;
  const language = typeof input.editor?.language === "string"
    ? input.editor.language.slice(0, 80)
    : "desconocido";
  const code = typeof input.editor?.code === "string"
    ? input.editor.code.slice(0, MAX_EDITOR_CODE)
    : "";
  const activity = Array.isArray(input.activity)
    ? input.activity.slice(0, MAX_ACTIVITY_ITEMS).map((event) => {
      if (!event || typeof event !== "object") return null;
      const item = event as Record<string, unknown>;
      return {
        origin: typeof item.origin === "string" ? item.origin.slice(0, 40) : "unknown",
        eventType: typeof item.eventType === "string" ? item.eventType.slice(0, 80) : "unknown",
        content: typeof item.content === "string" ? item.content.slice(0, 400) : "",
        createdAt: typeof item.createdAt === "string" ? item.createdAt.slice(0, 40) : "",
      };
    }).filter(Boolean)
    : [];
  return { editor: { language, code }, activity };
}

export { MAX_EDITOR_CODE };
