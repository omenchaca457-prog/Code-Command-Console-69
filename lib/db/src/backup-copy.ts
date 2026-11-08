export type BackupConversation = {
  id: number;
  title: string;
  created_at: string;
};

export type BackupMessage = {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  created_at: string;
};

export type BackupSnippet = {
  id: number;
  title: string;
  code: string;
  language: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
};

export type CoreBackupData = {
  conversations: BackupConversation[];
  messages: BackupMessage[];
  snippets: BackupSnippet[];
};

const COPY_COLUMNS = {
  "public.conversations": ["id", "title", "created_at"],
  "public.messages": ["id", "conversation_id", "role", "content", "created_at"],
  "public.snippets": [
    "id", "title", "code", "language", "created_at", "updated_at", "last_run_at",
  ],
} as const;

function splitCopyFields(line: string): string[] {
  const fields: string[] = [];
  let field = "";

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === "\\") {
      const escaped = line[index + 1];
      if (escaped === undefined) throw new Error("Invalid COPY escape at end of row.");
      field += character + escaped;
      index += 1;
      continue;
    }
    if (character === "\t") {
      fields.push(field);
      field = "";
      continue;
    }
    field += character;
  }

  fields.push(field);
  return fields;
}

function decodeCopyField(raw: string): string | null {
  if (raw === "\\N") return null;
  let value = "";

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index]!;
    if (character !== "\\") {
      value += character;
      continue;
    }

    const escaped = raw[index + 1];
    if (escaped === undefined) throw new Error("Invalid COPY escape.");
    index += 1;

    const simpleEscapes: Record<string, string> = {
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
      "\\": "\\",
    };
    if (escaped in simpleEscapes) {
      value += simpleEscapes[escaped]!;
      continue;
    }

    if (escaped === "x") {
      const digits = raw.slice(index + 1, index + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(digits)) {
        throw new Error("Invalid hexadecimal COPY escape.");
      }
      value += String.fromCharCode(Number.parseInt(digits, 16));
      index += 2;
      continue;
    }

    if (/[0-7]/.test(escaped)) {
      const octal = escaped + (raw.slice(index + 1, index + 3).match(/^[0-7]{0,2}/)?.[0] ?? "");
      value += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length - 1;
      continue;
    }

    // PostgreSQL removes the escape marker for an unrecognized escaped byte.
    value += escaped;
  }

  return value;
}

function parseInteger(value: string | null, field: string): number {
  if (value === null || !/^-?\d+$/.test(value)) {
    throw new Error(`Backup contains an invalid ${field} value.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Backup contains an out-of-range ${field} value.`);
  }
  return parsed;
}

function requireText(value: string | null, field: string): string {
  if (value === null) throw new Error(`Backup contains a null ${field} value.`);
  return value;
}

function mapRow(table: keyof typeof COPY_COLUMNS, values: Array<string | null>) {
  if (table === "public.conversations") {
    return {
      id: parseInteger(values[0]!, "conversation id"),
      title: requireText(values[1]!, "conversation title"),
      created_at: requireText(values[2]!, "conversation created_at"),
    } satisfies BackupConversation;
  }
  if (table === "public.messages") {
    return {
      id: parseInteger(values[0]!, "message id"),
      conversation_id: parseInteger(values[1]!, "message conversation_id"),
      role: requireText(values[2]!, "message role"),
      content: requireText(values[3]!, "message content"),
      created_at: requireText(values[4]!, "message created_at"),
    } satisfies BackupMessage;
  }
  return {
    id: parseInteger(values[0]!, "snippet id"),
    title: requireText(values[1]!, "snippet title"),
    code: requireText(values[2]!, "snippet code"),
    language: requireText(values[3]!, "snippet language"),
    created_at: requireText(values[4]!, "snippet created_at"),
    updated_at: requireText(values[5]!, "snippet updated_at"),
    last_run_at: values[6]!,
  } satisfies BackupSnippet;
}

export function parseCoreBackupCopy(sqlDump: string): CoreBackupData {
  const output: CoreBackupData = {
    conversations: [],
    messages: [],
    snippets: [],
  };
  const seenTables = new Set<keyof typeof COPY_COLUMNS>();
  let currentTable: keyof typeof COPY_COLUMNS | null = null;

  for (const sourceLine of sqlDump.split(/\r?\n/)) {
    const line = sourceLine.endsWith("\r") ? sourceLine.slice(0, -1) : sourceLine;
    if (currentTable) {
      if (line === "\\.") {
        currentTable = null;
        continue;
      }

      const rawFields = splitCopyFields(line);
      const columns = COPY_COLUMNS[currentTable];
      if (rawFields.length !== columns.length) {
        throw new Error(`Backup row has an invalid field count for ${currentTable}.`);
      }
      const values = rawFields.map(decodeCopyField);
      const row = mapRow(currentTable, values);
      if (currentTable === "public.conversations") output.conversations.push(row as BackupConversation);
      else if (currentTable === "public.messages") output.messages.push(row as BackupMessage);
      else output.snippets.push(row as BackupSnippet);
      continue;
    }

    const header = /^COPY (public\.(?:conversations|messages|snippets)) \(([^)]+)\) FROM stdin;$/.exec(line);
    if (!header) continue;

    const table = header[1] as keyof typeof COPY_COLUMNS;
    const columns = header[2]!.split(",").map((column) => column.trim());
    if (columns.join("|") !== COPY_COLUMNS[table].join("|")) {
      throw new Error(`Backup column layout is not supported for ${table}.`);
    }
    if (seenTables.has(table)) throw new Error(`Backup contains duplicate COPY data for ${table}.`);
    seenTables.add(table);
    currentTable = table;
  }

  if (currentTable) throw new Error(`Backup COPY section was not terminated for ${currentTable}.`);
  for (const table of Object.keys(COPY_COLUMNS) as Array<keyof typeof COPY_COLUMNS>) {
    if (!seenTables.has(table)) throw new Error(`Backup is missing the ${table} data section.`);
  }

  const conversationIds = new Set(output.conversations.map((row) => row.id));
  const validateUniqueIds = (ids: number[], table: string) => {
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Backup contains duplicate IDs in ${table}.`);
    }
  };
  validateUniqueIds(output.conversations.map((row) => row.id), "conversations");
  validateUniqueIds(output.messages.map((row) => row.id), "messages");
  validateUniqueIds(output.snippets.map((row) => row.id), "snippets");
  if (output.messages.some((row) => !conversationIds.has(row.conversation_id))) {
    throw new Error("Backup contains messages with no matching conversation.");
  }

  return output;
}
