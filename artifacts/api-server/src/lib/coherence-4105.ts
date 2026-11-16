/**
 * Ley 4105: experimental, normalized software-coherence score.
 * This is a user-defined engineering metric, not a physical law or proof of consciousness.
 */
export type Coherence4105Input = Readonly<{
  omega: number;
  psi: number;
  k: number;
  s: number;
  p: number;
}>;

export function coherence4105(x: Coherence4105Input): number {
  for (const [name, value] of Object.entries(x)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${name} debe ser un número finito en [0,1]`);
    }
  }
  return (x.omega + x.psi + x.k + x.p + (1 - x.s)) / 5;
}
