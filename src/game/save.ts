import { GAME_SAVE_KEY, type KeyValueStorage } from '../platform/storage';
import { Sim } from '../sim/sim.ts';
import { RULES_VERSION } from '../sim/state.ts';

export const SAVE_VERSION = 1 as const;
export const TICKS_PER_DAY = 1440;
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
const MAX_LOG_ENTRIES = 100_000;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 250_000;

export type CommandEntry = readonly [tick: number, command: Readonly<Record<string, unknown>>];
export type SaveIssue = 'corrupt' | 'unsupported' | 'storage-unavailable';

export interface GameSaveV1 {
  v: typeof SAVE_VERSION;
  savedAt: number;
  seed: number;
  tick: number;
  /** Internal sim.snapshot() JSON, including its RNG state and own schema version. */
  snapshot: Record<string, unknown>;
  /** Full ordered [tick, command] journal, including commands in the saved snapshot. */
  commands: CommandEntry[];
  /** Persisted deterministic state hash, or null for v0 snapshots without a hash. */
  stateHash: string | null;
  paramsVersion: number | null;
  checksum: string;
}

export interface SaveSource {
  seed: number;
  tick: number;
  paramsVersion?: number;
  commandLog: readonly CommandEntry[];
  snapshot(): Record<string, unknown>;
  hash(): string | number;
}

export interface RestoreTarget {
  restore(snapshot: Record<string, unknown>, commands: readonly CommandEntry[]): void;
  hash(): string | number;
}

export type LoadResult =
  | { status: 'ok'; save: GameSaveV1; migrated: boolean }
  | { status: 'missing' }
  | { status: 'error'; issue: SaveIssue };

export type WriteResult = { ok: true; save: GameSaveV1 } | { ok: false; issue: 'invalid' | 'storage-unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isTick = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isSeed = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;

/** Reject pathological nesting/prototype keys before passing untrusted data to Sim.restore. */
function safeJsonTree(root: unknown): boolean {
  const work: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let count = 0;
  while (work.length > 0) {
    const { value, depth } = work.pop()!;
    if (++count > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) return false;
    if (value === null || typeof value === 'boolean' || typeof value === 'string') continue;
    if (typeof value === 'number') { if (!Number.isFinite(value)) return false; continue; }
    if (typeof value !== 'object') return false;
    if (Array.isArray(value)) {
      if (value.length > MAX_JSON_NODES) return false;
      for (const item of value) work.push({ value: item, depth: depth + 1 });
    } else {
      for (const [key, item] of Object.entries(value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
        work.push({ value: item, depth: depth + 1 });
      }
    }
  }
  return true;
}

/** FNV-1a of a fixed field order; checksum detects modified/truncated valid JSON. */
function checksum(save: Omit<GameSaveV1, 'checksum'>): string {
  const data = JSON.stringify([save.v, save.savedAt, save.seed, save.tick, save.snapshot,
    save.commands, save.stateHash, save.paramsVersion]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function commandLogOk(value: unknown): value is CommandEntry[] {
  return Array.isArray(value) && value.length <= MAX_LOG_ENTRIES && value.every((entry) =>
    Array.isArray(entry) && entry.length === 2 && isTick(entry[0]) &&
    isRecord(entry[1]) && typeof entry[1].type === 'string' && entry[1].type.length > 0,
  );
}

function normaliseAndValidate(raw: unknown): LoadResult {
  if (!isRecord(raw)) return { status: 'error', issue: 'corrupt' };
  if (typeof raw.v !== 'number' || !Number.isSafeInteger(raw.v) || raw.v < 0) {
    return { status: 'error', issue: 'corrupt' };
  }
  if (raw.v > SAVE_VERSION) return { status: 'error', issue: 'unsupported' };
  if (raw.v !== 0 && raw.v !== SAVE_VERSION) return { status: 'error', issue: 'corrupt' };
  const migrated = raw.v === 0;
  const snapshot = migrated ? raw.snapshot ?? raw.state : raw.snapshot;
  if (!isRecord(snapshot) || !safeJsonTree(snapshot)) return { status: 'error', issue: 'corrupt' };
  const tick = raw.tick ?? (migrated ? snapshot.tick : undefined);
  const seed = raw.seed ?? (migrated ? snapshot.seed : undefined);
  const commands = migrated ? raw.commands ?? raw.commandLog ?? raw.log ?? [] : raw.commands;
  const stateHash = migrated ? (typeof raw.stateHash === 'string' ? raw.stateHash : null) : raw.stateHash;
  const paramsVersion = raw.paramsVersion ?? null;
  if ((isTick(snapshot.tick) && snapshot.tick !== tick) ||
    (isSeed(snapshot.seed) && snapshot.seed !== seed)) return { status: 'error', issue: 'corrupt' };
  const savedAt = raw.savedAt ?? (migrated ? 0 : undefined);
  if (!isTick(tick) || !isSeed(seed) || !isTick(savedAt) || !commandLogOk(commands) ||
    (stateHash !== null && (typeof stateHash !== 'string' || stateHash.length === 0 || stateHash.length > 128)) ||
    (paramsVersion !== null && !isTick(paramsVersion)) || !safeJsonTree(commands)) {
    return { status: 'error', issue: 'corrupt' };
  }
  const body: Omit<GameSaveV1, 'checksum'> = {
    v: SAVE_VERSION, savedAt, seed, tick, snapshot, commands, stateHash, paramsVersion,
  };
  const digest = checksum(body);
  if (!migrated && (typeof raw.checksum !== 'string' || digest !== raw.checksum)) {
    return { status: 'error', issue: 'corrupt' };
  }
  return { status: 'ok', save: { ...body, checksum: digest }, migrated };
}

export function decodeSave(text: string): LoadResult {
  if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES) return { status: 'error', issue: 'corrupt' };
  try { return normaliseAndValidate(JSON.parse(text) as unknown); }
  catch { return { status: 'error', issue: 'corrupt' }; }
}

export function encodeSave(source: SaveSource, savedAt = Date.now()): GameSaveV1 {
  // JSON round-trip provides a detached, validated snapshot/journal, not mutable Sim references.
  const snapshot = source.snapshot();
  const body = {
    v: SAVE_VERSION, savedAt, seed: source.seed, tick: source.tick,
    snapshot, commands: source.commandLog, stateHash: String(source.hash()),
    paramsVersion: source.paramsVersion ?? null,
  };
  const text = JSON.stringify(body);
  if (!text || text.length > MAX_SAVE_BYTES) throw new Error('Save exceeds size limit');
  const parsed = JSON.parse(text) as unknown;
  // Reuse validation so new and migrated saves follow the same strict contract.
  if (!isRecord(parsed) || !isRecord(parsed.snapshot) || !safeJsonTree(parsed) ||
    !isTick(parsed.savedAt) || !isSeed(parsed.seed) || !isTick(parsed.tick) ||
    !commandLogOk(parsed.commands) || (!isTick(parsed.paramsVersion) && parsed.paramsVersion !== null) ||
    typeof parsed.stateHash !== 'string' || parsed.stateHash.length === 0 || parsed.stateHash.length > 128) {
    throw new Error('Invalid simulation snapshot or command journal');
  }
  const verified = parsed as unknown as Omit<GameSaveV1, 'checksum'>;
  const result: GameSaveV1 = { ...verified, checksum: checksum(verified) };
  if (JSON.stringify(result).length > MAX_SAVE_BYTES) throw new Error('Save exceeds size limit');
  return result;
}

export async function writeGame(storage: KeyValueStorage, source: SaveSource): Promise<WriteResult> {
  let save: GameSaveV1;
  try { save = encodeSave(source); }
  catch { return { ok: false, issue: 'invalid' }; }
  try {
    await storage.set(GAME_SAVE_KEY, JSON.stringify(save));
    return { ok: true, save };
  } catch {
    return { ok: false, issue: 'storage-unavailable' };
  }
}

export async function readGame(storage: KeyValueStorage): Promise<LoadResult> {
  try {
    const text = await storage.get(GAME_SAVE_KEY);
    if (text === null) return { status: 'missing' };
    return decodeSave(text);
  } catch {
    return { status: 'error', issue: 'storage-unavailable' };
  }
}

/**
 * Build a fresh Sim, then restore into the candidate. Never mutate a running Sim
 * until validation and hash comparison have succeeded.
 */
export function restoreGame<T extends RestoreTarget>(
  save: GameSaveV1,
  factory: (seed: number, paramsVersion: number | null) => T,
): T | null {
  try {
    const game = factory(save.seed, save.paramsVersion);
    // Detach the validated save from any mutation performed by Sim.restore().
    game.restore(structuredClone(save.snapshot), structuredClone(save.commands));
    if (save.stateHash !== null && String(game.hash()) !== save.stateHash) return null;
    return game;
  } catch {
    return null;
  }
}

export type StartupResult<T> = {
  game: T;
  /** True only after a validated save has been restored. UI must show a Resume action. */
  requiresResume: boolean;
  /** UI translates this code; no hard-coded player-facing message. */
  issue?: SaveIssue;
};

/** Corrupt/unsupported/unreadable saves never crash startup or delete user data. */
export async function startOrRestore<T extends RestoreTarget>(
  storage: KeyValueStorage,
  createNewGame: () => T,
  createFromSave: (seed: number, paramsVersion: number | null) => T,
): Promise<StartupResult<T>> {
  const loaded = await readGame(storage);
  if (loaded.status === 'ok') {
    const game = restoreGame(loaded.save, createFromSave);
    if (game !== null) return { game, requiresResume: true };
    return { game: createNewGame(), requiresResume: false, issue: 'corrupt' };
  }
  return {
    game: createNewGame(), requiresResume: false,
    ...(loaded.status === 'error' ? { issue: loaded.issue } : {}),
  };
}

/** Save the authoritative Sim: its snapshot (state, RNG streams, journal, checkpoints) plus the journal. */
export function saveSourceFromSim(sim: Sim): SaveSource {
  return {
    seed: sim.seed,
    tick: sim.tickCount,
    paramsVersion: RULES_VERSION,
    commandLog: sim.getCommandLog() as unknown as readonly CommandEntry[],
    snapshot: () => JSON.parse(sim.snapshot()) as Record<string, unknown>,
    hash: () => sim.hash(),
  };
}

/** Restore target wrapping a Sim; the envelope's journal must match the snapshot's own journal. */
export class SimRestoreTarget implements RestoreTarget {
  sim: Sim | null = null;
  restore(snapshot: Record<string, unknown>, commands: readonly CommandEntry[]): void {
    const sim = Sim.fromSnapshot(JSON.stringify(snapshot));
    if (JSON.stringify(sim.getCommandLog()) !== JSON.stringify(commands)) {
      throw new Error('Save journal does not match the simulation snapshot');
    }
    this.sim = sim;
  }
  hash(): string {
    if (!this.sim) throw new Error('Nothing restored');
    return this.sim.hash();
  }
}

/** Validated restore (hash-checked); null for corrupt or incompatible saves. Never throws. */
export function restoreSimFromSave(save: GameSaveV1): Sim | null {
  if (save.paramsVersion !== null && save.paramsVersion !== RULES_VERSION) return null;
  return restoreGame(save, () => new SimRestoreTarget())?.sim ?? null;
}
