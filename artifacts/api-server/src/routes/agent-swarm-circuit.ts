import { logger } from "../lib/logger";
import { AgentCircuitBreaker } from "./agent-circuit-breaker";

/**
 * Shared by AI analyses and synthetic tasks, so neither entry point can bypass
 * an OPEN circuit on the other. Configuration is server-owned, not model-owned.
 */
export const agentSwarmCircuit = new AgentCircuitBreaker({
  failureThreshold: 3,
  recovery_timeout: 30_000,
  onTransition(event) {
    const details = { event: "agent_circuit_transition", law: "4105", ...event };
    if (event.state === "OPEN") {
      logger.error(details, "Agent Swarm: congelamiento de seguridad");
    } else {
      logger.info(details, "Agent Swarm: transición del disyuntor");
    }
    void (async () => {
      const { db, neuralEventsTable } = await import("@workspace/db");
      const { publishNeuralEvent } = await import("./neural-event-bus");
      const [saved] = await db.insert(neuralEventsTable).values({
        origin: "agents",
        eventType: event.state === "OPEN" ? "agent_circuit_open" : "agent_circuit_recovery",
        content: JSON.stringify(details),
      }).returning();
      await publishNeuralEvent({
        id: saved.id,
        origin: "agents",
        eventType: saved.eventType,
        content: saved.content,
        createdAt: saved.createdAt.toISOString(),
      });
    })().catch((err: unknown) => logger.error(
      { err, agentId: event.agentId, state: event.state },
      "No se pudo persistir o transmitir la alerta; el disyuntor conserva su estado",
    ));
  },
});
