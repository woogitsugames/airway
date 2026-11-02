/** Deterministic mulberry32 with explicit, portable 32-bit state. */
const UINT32_MAX = 0xffff_ffff;
const UINT32_SIZE = 0x1_0000_0000;
const STEP = 0x6d2b79f5;

function requireUint32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`);
  }
}

/** FNV-1a over UTF-8 bytes (including non-ASCII labels), independent of locale. */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  const addByte = (byte: number): void => {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  };

  for (let i = 0; i < text.length; i++) {
    let codePoint = text.codePointAt(i)!;
    if (codePoint > 0xffff) i++;
    // Encode unpaired UTF-16 surrogates as the UTF-8 replacement character.
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) codePoint = 0xfffd;

    if (codePoint < 0x80) {
      addByte(codePoint);
    } else if (codePoint < 0x800) {
      addByte(0xc0 | (codePoint >>> 6));
      addByte(0x80 | (codePoint & 63));
    } else if (codePoint < 0x10000) {
      addByte(0xe0 | (codePoint >>> 12));
      addByte(0x80 | ((codePoint >>> 6) & 63));
      addByte(0x80 | (codePoint & 63));
    } else {
      addByte(0xf0 | (codePoint >>> 18));
      addByte(0x80 | ((codePoint >>> 12) & 63));
      addByte(0x80 | ((codePoint >>> 6) & 63));
      addByte(0x80 | (codePoint & 63));
    }
  }
  return hash;
}

export class Rng {
  private readonly initialSeed: number;
  private currentState: number;

  constructor(seed: number) {
    requireUint32(seed, 'seed');
    this.initialSeed = seed;
    this.currentState = seed;
  }

  get seed(): number { return this.initialSeed; }
  get state(): number { return this.currentState; }

  setState(state: number): void {
    requireUint32(state, 'RNG state');
    this.currentState = state;
  }

  /** Returns a value in [0, 1), advancing the stream exactly once. */
  next(): number {
    const a = (this.currentState + STEP) >>> 0;
    this.currentState = a;
    let mixed = Math.imul(a ^ (a >>> 15), a | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_SIZE;
  }

  /** Integer in [min, max), or [0, max) when only one argument is supplied. */
  int(min: number, max?: number): number {
    const from = max === undefined ? 0 : min;
    const to = max === undefined ? min : max;
    const span = to - from;
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || span <= 0 || span > UINT32_SIZE) {
      throw new RangeError('int bounds must be safe integers with a positive span <= 2^32');
    }
    return from + Math.floor(this.next() * span);
  }

  /** Floating-point value in [min, max); do not use for authoritative sim quantities. */
  range(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) {
      throw new RangeError('range bounds must be finite and ordered');
    }
    return min + (max - min) * this.next();
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new RangeError('cannot pick from an empty array');
    return values[this.int(values.length)];
  }

  chance(probability: number): boolean {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError('chance probability must be in [0, 1]');
    }
    return this.next() < probability;
  }

  /** Forks from the ORIGINAL seed, not the consumption-dependent current state. */
  fork(label: string): Rng {
    if (!label) throw new RangeError('RNG fork label must be nonempty');
    return new Rng(seedFromString(`airway/rng/v1/${this.initialSeed}/${label.length}:${label}`));
  }
}

// Render-only convenience (src/render/globe/decorations.ts); the simulation always uses Rng streams.
/** Render-time decorative randomness (never used by the simulation). */
export function createDecorativeRng(seed: number): () => number {
  const rng = new Rng(seed >>> 0);
  return () => rng.next();
}
