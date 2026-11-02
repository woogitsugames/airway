// [task-15] World identity is carried through restart without re-rolling simulation RNG.
export interface WorldIdentity {
  readonly seed: number;
  readonly initialHash: string;
}

export function sameWorldIdentity(identity: WorldIdentity): WorldIdentity {
  return { seed: identity.seed >>> 0, initialHash: identity.initialHash };
}

export function nextWorldSeed(currentSeed: number, entropy: number): number {
  const current = currentSeed >>> 0;
  const candidate = Number.isFinite(entropy) ? entropy >>> 0 : ((current + 1) >>> 0);
  return candidate === current ? ((current + 1) >>> 0) : candidate;
}
