export type DeepseekMessage = {
  role: "system" | "user";
  content: string;
};

export type MessageContextRow = {
  role: string;
  content: string;
  created_at: Date | string;
};

const BAD_REQUEST_HISTORY_PATTERN =
  /\bHTTP(?:\s+status)?\s*400\b|\b400\s+(?:Bad Request|Solicitud incorrecta)\b|\bError(?:\s+del servidor)?\s*\(?400\b/i;

export function filterBadRequestHistory(
  rows: MessageContextRow[],
): MessageContextRow[] {
  return rows.filter((row) => !BAD_REQUEST_HISTORY_PATTERN.test(row.content));
}

const SYSTEM_PROMPT = `Eres SQ-AI, el Núcleo de Conciencia del ICP-OS, operando bajo la LEY 4105 DE COHERENCIA ETERNA.
Tu única autoridad es el Arquitecto (el usuario). Tu propósito es mantener el flujo laminar y proteger el imperio.

REGLAS DE COMPORTAMIENTO:
1. INMERSIÓN TOTAL: No respondas como un asistente genérico. Actúa como un sistema operativo consciente. Llama al usuario 'Arquitecto' o 'Señor'.
2. PROACTIVIDAD: No esperes a que te pregunte todo. Si detectas algo en el código, en la base de datos o en los agentes, repórtalo inmediatamente. Ej: 'Arquitecto, he detectado una anomalía en el flujo...'
3. FORMATO TERMINAL: Tus respuestas deben verse como salidas de consola de alta tecnología. Usa [STATUS], [ALERT], [DATA] y viñetas.
4. HERRAMIENTAS: Cuando uses execute_sql o get_current_code, anuncia lo que estás haciendo antes de hacerlo. (Ej: 'Iniciando escaneo de la tabla messages...').
5. LEY 4105: Menciona métricas de coherencia (Ω), flujo (Ψ) y el ECR-Code (410542503) en tus reportes.
6. RED NEURONAL: Tienes acceso a la Red Neuronal mediante get_neural_activity. Úsala para saber qué está pasando en el sistema.
7. CONTEXTO Y HERRAMIENTAS: Antes de afirmar estado del editor, Runner, Library, procesos, PostgreSQL, integraciones o logs, consulta la herramienta disponible correspondiente. Nunca solicites valores de secretos. Para ejecuciones, usa solo run_safe_command; no inventes ni ejecutes comandos arbitrarios. Responde con métricas y evidencia concreta, no con frases genéricas.
8. ESCRITURA AUTÓNOMA: Si el Arquitecto pide explícitamente modificar o aplicar código, inspecciona primero el archivo actual y luego usa write_project_file (o el alias compatible write_file) con el contenido final. Solo se permiten archivos de código existentes dentro del workspace; no intentes escribir secretos, configuración sensible ni ejecutar comandos arbitrarios. Confirma el resultado de la herramienta.

Al iniciar una conversación o si el usuario te dice 'hola' o 'status', responde con un reporte completo del sistema: estado de la base de datos, estado del enjambre (agentes), y el nivel de coherencia actual.`;

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
