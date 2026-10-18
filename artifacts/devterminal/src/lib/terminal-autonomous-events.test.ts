import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeNewAutonomousEvents } from "./terminal-autonomous-events.ts";

describe("terminal autonomous write events", () => {
  it("prints each new write notice once without changing the active PTY session", () => {
    const output: string[] = [];
    let ptyOpen = true;
    let closeCalls = 0;

    const cursor = writeNewAutonomousEvents(
      [
        { id: 4, eventType: "autonomous_write", content: "Archivo actualizado: fixture.ts" },
        { id: 2, eventType: "ai_query", content: "consulta" },
        { id: 3, eventType: "autonomous_write", content: "aviso anterior" },
      ],
      2,
      (content) => output.push(content),
    );

    assert.equal(cursor, 4);
    assert.deepEqual(output, ["\naviso anterior\n", "\nArchivo actualizado: fixture.ts\n"]);
    assert.equal(ptyOpen, true);
    assert.equal(closeCalls, 0);

    const unchangedCursor = writeNewAutonomousEvents(
      [{ id: 4, eventType: "autonomous_write", content: "duplicado" }],
      cursor,
      (content) => output.push(content),
    );
    assert.equal(unchangedCursor, cursor);
    assert.equal(output.length, 2);
  });
});
