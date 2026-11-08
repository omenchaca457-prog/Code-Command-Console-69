export type AutonomousTerminalEvent = {
  id: number;
  eventType: string;
  content: string;
};

export function writeNewAutonomousEvents(
  events: readonly AutonomousTerminalEvent[],
  lastEventId: number,
  write: (content: string) => void,
): number {
  let newestId = lastEventId;
  for (const event of [...events].sort((left, right) => left.id - right.id)) {
    if (event.id <= newestId) continue;
    newestId = event.id;
    if (event.eventType === "autonomous_write") {
      write(`\n${event.content}\n`);
    }
  }
  return newestId;
}
