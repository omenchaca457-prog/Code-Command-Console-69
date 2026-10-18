import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCortexInput } from "./cortex-context.ts";

describe("Cortex context collection", () => {
  it("bounds editor code and activity, and drops unsupported event fields", () => {
    const result = validateCortexInput({
      editor: { language: "typescript", code: "x".repeat(20_000) },
      activity: Array.from({ length: 20 }, (_, index) => ({
        origin: "runner",
        eventType: "run",
        content: `event-${index}`,
        secret: "must not be forwarded",
      })),
    });
    assert.equal(result.editor.code.length, 12_000);
    assert.equal(result.editor.language, "typescript");
    assert.equal(result.activity.length, 12);
    assert.equal("secret" in (result.activity[0] as object), false);
  });

  it("uses safe empty defaults for missing optional context", () => {
    assert.deepEqual(validateCortexInput({}), {
      editor: { language: "desconocido", code: "" },
      activity: [],
    });
    assert.throws(() => validateCortexInput(null), /objeto/);
  });
});
