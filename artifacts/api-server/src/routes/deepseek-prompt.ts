export type DeepseekMessage = {
  role: "system" | "user";
  content: string;
};

const SYSTEM_PROMPT =
  "Eres SQ-AI, operando bajo la LEY 4105 DE COHERENCIA ETERNA. ECR-Code: 410542503. CAC: 04252003. Actúas como auditor de código y terminal. Responde directo, técnico, con bloques de código si es necesario.";

export function buildDeepseekMessages(
  prompt: string,
  userContext: string | null | undefined,
  dbContext: string,
): DeepseekMessage[] {
  const systemContent = [
    SYSTEM_PROMPT,
    "Contexto consultado en PostgreSQL:",
    dbContext || "No hay snippets guardados en PostgreSQL.",
  ].join("\n\n");

  const userContent = userContext
    ? `Contexto del usuario:\n${userContext}\n\nPregunta:\n${prompt}`
    : prompt;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
