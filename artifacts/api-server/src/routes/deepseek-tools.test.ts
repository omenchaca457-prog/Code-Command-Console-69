import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readProjectCode,
  validateDeepseekToolArguments,
  validateExecuteSqlQuery,
} from "./deepseek-tool-safety.ts";

describe("DeepSeek tool permissions", () => {
  it("allows one SELECT against an application table", () => {
    assert.equal(
      validateExecuteSqlQuery("SELECT id, xp FROM agents LIMIT 5;"),
      "SELECT id, xp FROM agents LIMIT 5",
    );
  });

  it("rejects DROP, DELETE, UPDATE, multiple statements, and non-application tables", () => {
    assert.throws(() => validateExecuteSqlQuery("DROP TABLE agents"));
    assert.throws(() => validateExecuteSqlQuery("DELETE FROM agents"));
    assert.throws(() => validateExecuteSqlQuery("UPDATE agents SET xp = 0"));
    assert.throws(() => validateExecuteSqlQuery("SELECT 1; SELECT 2"));
    assert.throws(() => validateExecuteSqlQuery("SELECT * FROM users"));
  });

  it("reads project source while blocking traversal and secret files", async () => {
    const source = await readProjectCode(
      "artifacts/api-server/src/routes/deepseek.ts",
    );
    assert.match(source, /DEEPSEEK_TOOLS/);
    const neuralToolSource = await readProjectCode(
      "artifacts/api-server/src/routes/deepseek-tools.ts",
    );
    assert.match(neuralToolSource, /get_neural_activity/);
    assert.match(neuralToolSource, /LIMIT 10/);
    await assert.rejects(() => readProjectCode("../../.env"));
    await assert.rejects(() => readProjectCode(".env"));
    await assert.rejects(() => readProjectCode(".ENV"));
  });

  it("requires exact tool argument keys and rejects destructive queries", () => {
    assert.throws(
      () => validateDeepseekToolArguments("execute_sql", { query: "SELECT 1", authorized: true }),
      /Argumentos inválidos/,
    );
    assert.throws(
      () => validateDeepseekToolArguments("execute_sql", { query: "UPDATE agents SET xp = 0" }),
      /solo permite una consulta SELECT/,
    );
    assert.throws(
      () => validateDeepseekToolArguments("get_current_code", { path: "package.json", allowSensitive: true }),
      /Argumentos inválidos/,
    );
    assert.throws(
      () => validateDeepseekToolArguments("get_current_code", { path: ".ENV" }),
      /relativa/,
    );
  });

  it("accepts an empty argument object for neural activity lookup", () => {
    assert.deepEqual(
      validateDeepseekToolArguments("get_neural_activity", {}),
      {},
    );
  });

  it("only accepts fixed, read-only diagnostic commands", () => {
    assert.deepEqual(
      validateDeepseekToolArguments("run_safe_command", { command: "git_status" }),
      { command: "git_status" },
    );
    assert.throws(
      () => validateDeepseekToolArguments("run_safe_command", { command: "bash -c rm" }),
      /lista segura/,
    );
    assert.deepEqual(
      validateDeepseekToolArguments("get_runtime_diagnostics", {}),
      {},
    );
  });

});
