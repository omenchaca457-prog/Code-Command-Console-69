export class AgentRunLock {
  private readonly activeRuns = new Set<string>();

  acquire(agentId: string): boolean {
    if (this.activeRuns.has(agentId)) return false;
    this.activeRuns.add(agentId);
    return true;
  }

  isActive(agentId: string): boolean {
    return this.activeRuns.has(agentId);
  }

  release(agentId: string): void {
    this.activeRuns.delete(agentId);
  }
}
