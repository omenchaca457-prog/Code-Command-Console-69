export type AgentCircuitState = "CLOSED" | "OPEN" | "HALF-OPEN";

export type AgentCircuitSnapshot = {
  state: AgentCircuitState;
  consecutiveFailures: number;
  remainingMs: number;
  probeInFlight: boolean;
  lastFailure: string | null;
};

export type AgentCircuitTransition = AgentCircuitSnapshot & {
  agentId: string;
  previousState: AgentCircuitState;
};

type CircuitRecord = {
  state: AgentCircuitState;
  consecutiveFailures: number;
  openUntil: number;
  inFlight: boolean;
  lastFailure: string | null;
};

export type AgentCircuitOptions = {
  failureThreshold?: number;
  /** Cooldown in milliseconds. */
  recovery_timeout?: number;
  now?: () => number;
  onTransition?: (event: AgentCircuitTransition) => void;
};

/** A verified invariant violation must stop propagation immediately. */
export class AgentSafetyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentSafetyViolation";
  }
}

/** Only server-authored messages are safe to persist as failure details. */
export class AgentTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTaskValidationError";
  }
}

export class AgentCircuitBlockedError extends Error {
  public readonly agentId: string;
  public readonly circuit: AgentCircuitSnapshot;

  constructor(
    agentId: string,
    circuit: AgentCircuitSnapshot,
  ) {
    super(circuit.probeInFlight
      ? "El agente ya tiene una ejecución o auditoría en curso."
      : "Agente congelado por el disyuntor de seguridad.");
    this.name = "AgentCircuitBlockedError";
    this.agentId = agentId;
    this.circuit = circuit;
  }
}

export class AgentCircuitBreaker {
  private readonly states = new Map<string, CircuitRecord>();
  private readonly threshold: number;
  private readonly recoveryTimeout: number;
  private readonly now: () => number;
  private readonly onTransition?: AgentCircuitOptions["onTransition"];

  constructor(options: AgentCircuitOptions = {}) {
    this.threshold = options.failureThreshold ?? 3;
    this.recoveryTimeout = options.recovery_timeout ?? 30_000;
    if (!Number.isSafeInteger(this.threshold) || this.threshold < 1) {
      throw new RangeError("failureThreshold debe ser un entero positivo.");
    }
    if (!Number.isSafeInteger(this.recoveryTimeout) || this.recoveryTimeout < 1) {
      throw new RangeError("recovery_timeout debe ser un entero positivo en milisegundos.");
    }
    this.now = options.now ?? Date.now;
    this.onTransition = options.onTransition;
  }

  private record(agentId: string): CircuitRecord {
    let record = this.states.get(agentId);
    if (!record) {
      record = { state: "CLOSED", consecutiveFailures: 0, openUntil: 0, inFlight: false, lastFailure: null };
      this.states.set(agentId, record);
    }
    return record;
  }

  private snapshot(record: CircuitRecord): AgentCircuitSnapshot {
    return {
      state: record.state,
      consecutiveFailures: record.consecutiveFailures,
      remainingMs: Math.max(0, record.openUntil - this.now()),
      probeInFlight: record.inFlight,
      lastFailure: record.lastFailure,
    };
  }

  private transition(agentId: string, record: CircuitRecord, state: AgentCircuitState) {
    const previousState = record.state;
    record.state = state;
    if (previousState !== state) {
      // Observability must never release the safety lock or change task outcome.
      try {
        this.onTransition?.({ agentId, previousState, ...this.snapshot(record) });
      } catch {
        // The production observer handles and logs delivery failures separately.
      }
    }
  }

  getSnapshot(agentId: string): AgentCircuitSnapshot {
    const record = this.record(agentId);
    // Lazy automatic transition: no background agent runs or unbounded timers.
    if (record.state === "OPEN" && this.now() >= record.openUntil) {
      this.transition(agentId, record, "HALF-OPEN");
    }
    return this.snapshot(record);
  }

  /**
   * One execution per agent, including the HALF-OPEN audit. Validate inside the
   * task, before publishing/persisting its output. Resolve only after persistence.
   */
  async execute<T>(agentId: string, task: () => Promise<T>): Promise<T> {
    const snapshot = this.getSnapshot(agentId);
    const record = this.record(agentId);
    if (snapshot.state === "OPEN" || record.inFlight) {
      throw new AgentCircuitBlockedError(agentId, snapshot);
    }
    record.inFlight = true;
    try {
      const result = await task();
      record.consecutiveFailures = 0;
      record.lastFailure = null;
      record.openUntil = 0;
      this.transition(agentId, record, "CLOSED");
      return result;
    } catch (error) {
      record.consecutiveFailures += 1;
      // Do not copy arbitrary provider output or source code into safety logs.
      record.lastFailure = error instanceof AgentSafetyViolation || error instanceof AgentTaskValidationError
        ? error.message
        : "Excepción o validación fallida durante la tarea del agente.";
      if (error instanceof AgentSafetyViolation ||
          record.state === "HALF-OPEN" ||
          record.consecutiveFailures >= this.threshold) {
        record.openUntil = this.now() + this.recoveryTimeout;
        this.transition(agentId, record, "OPEN");
      }
      throw error;
    } finally {
      record.inFlight = false;
    }
  }
}
