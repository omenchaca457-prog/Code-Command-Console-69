import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readProjectCode,
  validateExecuteSqlQuery,
} from "./deepseek-tool-safety.ts";

describe("DeepSeek tool permissions", () => {
  it("allows one SELECT against an application table", () => {
    assert.equal(
      validateExecuteSqlQuery("SELECT id, xp FROM agents LIMIT 5;"),
      "SELECT id, xp FROM agents LIMIT 5",
    );
  });

  it("rejects writes, multiple statements, and non-application tables", () => {
    assert.throws(() => validateExecuteSqlQuery("DELETE FROM agents"));
    assert.throws(() => validateExecuteSqlQuery("SELECT 1; SELECT 2"));
    assert.throws(() => validateExecuteSqlQuery("SELECT * FROM users"));
  });

  it("reads project source while blocking traversal and secret files", async () => {
    const source = await readProjectCode(
      "artifacts/api-server/src/routes/deepseek.ts",
    );
    assert.match(source, /DEEPSEEK_TOOLS/);
    await assert.rejects(() => readProjectCode("../../.env"));
    await assert.rejects(() => readProjectCode(".env"));
  });
});
