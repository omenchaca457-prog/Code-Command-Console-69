import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseCoreBackupCopy } from "./backup-copy.ts";

describe("PostgreSQL backup compatibility", () => {
  it("decodes COPY text escapes, nulls, and preserves the supplied core records", async () => {
    const fixture = [
      "COPY public.conversations (id, title, created_at) FROM stdin;",
      "1\tA\\tB\t2026-01-01 00:00:00+00",
      "\\.",
      "COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;",
      "1\t1\tuser\tline one\\nline two\t2026-01-01 00:00:00+00",
      "\\.",
      "COPY public.snippets (id, title, code, language, created_at, updated_at, last_run_at) FROM stdin;",
      "1\tdemo\t\\\\N\tjavascript\t2026-01-01 00:00:00\t2026-01-01 00:00:00\t\\N",
      "\\.",
    ].join("\n");
    const parsed = parseCoreBackupCopy(fixture);
    assert.equal(parsed.conversations[0]?.title, "A\tB");
    assert.equal(parsed.messages[0]?.content, "line one\nline two");
    assert.equal(parsed.snippets[0]?.code, "\\N");
    assert.equal(parsed.snippets[0]?.last_run_at, null);
  });

  it("recognizes the supplied dump row counts without returning row contents", async () => {
    const dumpPath = fileURLToPath(new URL("../../../backup_neuron_quant.sql", import.meta.url));
    const dump = await readFile(dumpPath, "utf8");
    const parsed = parseCoreBackupCopy(dump);
    assert.deepEqual(
      {
        conversations: parsed.conversations.length,
        messages: parsed.messages.length,
        snippets: parsed.snippets.length,
      },
      { conversations: 40, messages: 120, snippets: 3 },
    );
  });

  it("rejects a backup with an orphaned message reference", () => {
    const fixture = [
      "COPY public.conversations (id, title, created_at) FROM stdin;",
      "\\.",
      "COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;",
      "1\t9\tuser\ttext\t2026-01-01 00:00:00+00",
      "\\.",
      "COPY public.snippets (id, title, code, language, created_at, updated_at, last_run_at) FROM stdin;",
      "\\.",
    ].join("\n");
    assert.throws(() => parseCoreBackupCopy(fixture), /no matching conversation/);
  });
});
