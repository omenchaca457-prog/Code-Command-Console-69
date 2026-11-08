import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeSqlRows } from "./deepseek-serialization.ts";

describe("DeepSeek SQL result serialization", () => {
  it("serializes BigInt and Date values, including nested values", () => {
    assert.deepEqual(
      serializeSqlRows([{
        id: 9007199254740993n,
        created_at: new Date("2026-10-17T12:00:00.000Z"),
        metadata: { count: 3n },
      }]),
      [{
        id: "9007199254740993",
        created_at: "2026-10-17T12:00:00.000Z",
        metadata: '{"count":"3"}',
      }],
    );
  });
});
