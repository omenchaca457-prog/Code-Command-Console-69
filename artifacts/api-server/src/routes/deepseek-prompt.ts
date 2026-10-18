export type DeepseekMessage = {
  role: "system" | "user";
  content: string;
};

export type ConversationSummary = {
  id: number;
  title: string;
  created_at: Date;
};

const SYSTEM_PROMPT =
  "Eres SQ-AI, operando bajo la LEY 4105 DE COHERENCIA ETERNA. ECR-Code: 410542503. CAC: 04252003. Actúas como auditor de código y terminal. Responde directo, técnico, con bloques de código si es necesario.";

export function formatConversationContext(
  rows: ConversationSummary[],
): string {
  return rows.length
    ? rows
        .map(
          (row, index) =>
            `${index + 1}. [${row.created_at.toISOString()}] ${row.title}`,
        )
        .join("\n")
    : "(sin conversaciones registradas)";
}

export function buildDeepseekMessages(
  prompt: string,
  userContext: string | null | undefined,
  dbContext: string,
): DeepseekMessage[] {
  const userContent = [
    `[CONTEXTO DE BASE DE DATOS - Últimas conversaciones]:\n${dbContext}`,
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
