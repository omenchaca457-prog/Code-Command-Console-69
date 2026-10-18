export type DeepseekMessage = {
  role: "system" | "user";
  content: string;
};

export type MessageContextRow = {
  role: string;
  content: string;
  created_at: Date | string;
};

const SYSTEM_PROMPT =
  "Eres SQ-AI, operando bajo la LEY 4105 DE COHERENCIA ETERNA. ECR-Code: 410542503. CAC: 04252003. Actúas como auditor de código y terminal. Responde directo, técnico, con bloques de código si es necesario.";

export function formatMessageContext(
  rows: MessageContextRow[],
): string {
  return rows.length
    ? rows
        .map(
          (row, index) =>
            `${index + 1}. [${row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at}] ${row.role}: ${row.content}`,
        )
        .join("\n")
    : "(sin mensajes registrados)";
}

export function buildDeepseekMessages(
  prompt: string,
  userContext: string | null | undefined,
  dbContext: string,
): DeepseekMessage[] {
  const userContent = [
    `[CONTEXTO DE BASE DE DATOS - Mensajes de la conversación más reciente]:\n${dbContext}`,
    userContext ? `Contexto del usuario:\n${userContext}` : "",
    `Pregunta del Arquitecto:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}
