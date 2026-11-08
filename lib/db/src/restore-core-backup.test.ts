import assert from "node:assert/strict";
import { it } from "node:test";
import { restoreCoreBackupIntoEmptyDatabase } from "./restore-core-backup.ts";
import type { CoreBackupData } from "./backup-copy.ts";

it("refuses to import into any populated core table before inserting backup rows", async () => {
  const calls: string[] = [];
  let released = false;
  const pool = {
    async connect() {
      return {
        async query(sql: string) {
          calls.push(sql.trim());
          if (sql.includes("SELECT\n        EXISTS")) {
            return {
              rows: [{
                conversations_populated: false,
                messages_populated: true,
                snippets_populated: false,
              }],
            };
          }
          return { rows: [] };
        },
        release() {
          released = true;
        },
      };
    },
  };
  const emptyBackup: CoreBackupData = {
    conversations: [],
    messages: [],
    snippets: [],
  };

  await assert.rejects(
    restoreCoreBackupIntoEmptyDatabase(pool as never, emptyBackup),
    /must all be empty/,
  );
  assert.equal(calls.some((sql) => sql.startsWith("INSERT INTO")), false);
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(released, true);
});
