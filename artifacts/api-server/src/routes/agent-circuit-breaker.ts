type CircuitState = {
  consecutiveFailures: number;
  openUntil: number;
};

export class AgentCircuitBreaker {
  private readonly states = new Map<string, CircuitState>();
  private readonly threshold: number;
  private readonly baseCooldownMs: number;
  private readonly maxCooldownMs: number;

  constructor(
    threshold = 3,
    baseCooldownMs = 30_000,
    maxCooldownMs = 5 * 60_000,
  ) {
    this.threshold = threshold;
    this.baseCooldownMs = baseCooldownMs;
    this.maxCooldownMs = maxCooldownMs;
  }

  remainingMs(agentId: string, now = Date.now()) {
    const state = this.states.get(agentId);
    return Math.max(0, (state?.openUntil ?? 0) - now);
  }

  recordSuccess(agentId: string) {
    this.states.delete(agentId);
  }

  recordFailure(agentId: string, now = Date.now()) {
    const current = this.states.get(agentId) ?? { consecutiveFailures: 0, openUntil: 0 };
    current.consecutiveFailures += 1;
    if (current.consecutiveFailures >= this.threshold) {
      const exponent = current.consecutiveFailures - this.threshold;
      current.openUntil = now + Math.min(this.baseCooldownMs * 2 ** exponent, this.maxCooldownMs);
    }
    this.states.set(agentId, current);
    return {
      consecutiveFailures: current.consecutiveFailures,
      remainingMs: Math.max(0, current.openUntil - now),
    };
  }
}
