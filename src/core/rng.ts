// [task-05] Minimal seeded RNG adapter until the simulation kernel (task 02) owns this file.
// Mulberry32 state is a serializable unsigned 32-bit integer. Never use Math.random in sim.
export interface RngStep {
  readonly value: number;
  readonly state: number;
}

export function nextRngUint32(state: number): RngStep {
  const nextState = (state + 0x6D2B79F5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: nextState };
}
