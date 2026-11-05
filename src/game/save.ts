import { GAME_SAVE_KEY, type KeyValueStorage } from '../platform/storage';
import { Sim } from '../sim/sim.ts';
import { TICKS_PER_WEEK } from '../sim/clock.ts';
import { RULES_VERSION, type GameConfig } from '../sim/state.ts';

/**
 * Envelope version. [night-11aj] 1 -> 2: the snapshot's game config may carry an Endless home region (R2g, D-236).
 * A v1 envelope (always Random) still loads unchanged; a build before R2g refuses a v2 save as 'unsupported'
 * instead of continuing a home-region run in a random world.
 */
export const SAVE_VERSION = 5 as const;
/** Envelope versions this build reads: v0 (pre-checksum, migrated), v1 (pre-R2g) and the current one. */
const LEGACY_V1 = 1;
/**
 * [night-12ba] R2k, D-247: 2 -> 3, the config may carry the weekly contract. A v2 envelope (never a contract)
 * loads unchanged; a build before R2k refuses a v3 save as 'unsupported' instead of dropping the contract.
 */
const LEGACY_V2 = 2;
/**
 * [night-12bb] R2i, D-249: 3 -> 4, the config may carry the demand surge. A v3 envelope (never a surge) loads
 * unchanged; a build before R2i refuses a v4 save as 'unsupported' instead of dropping the surge.
 */
const LEGACY_V3 = 3;
/**
 * [night-12bc] R2h, D-251: 4 -> 5, the config may carry an Endless licence class (II or III). A v4 envelope (always
 * class I, possibly with a surge) loads unchanged; a build before R2h refuses a v5 save as 'unsupported' instead of
 * continuing a class II/III run under class I rules.
 */
const LEGACY_V4 = 4;
/**
 * [night-12bd] R2j: v6 = a save whose config carries the weather front (off in shipped Endless). Only such a save is
 * written as v6; every other save is still written as SAVE_VERSION (v5), byte for byte as before R2j, so a pre-R2j
 * build keeps loading it and refuses only a weather run as 'unsupported' (it would otherwise continue it without the
 * front). v5 never carries the flag and v6 always does.
 */
export const WEATHER_SAVE_VERSION = 6 as const;
type EnvelopeVersion = typeof SAVE_VERSION | typeof WEATHER_SAVE_VERSION;
/** [night-12bd] R2j: does a sim snapshot's config carry the weather front? */
function snapshotHasWeather(snapshot: Record<string, unknown>): boolean {
  const state = snapshot.state;
  return isRecord(state) && isRecord(state.config) && state.config.weatherFront === true;
}
export const TICKS_PER_DAY = 1440;
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
const MAX_LOG_ENTRIES = 100_000;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 250_000;

export type CommandEntry = readonly [tick: number, command: Readonly<Record<string, unknown>>];
export type SaveIssue = 'corrupt' | 'unsupported' | 'storage-unavailable';

export interface GameSaveV1 {
  v: EnvelopeVersion;
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
  if (raw.v > WEATHER_SAVE_VERSION) return { status: 'error', issue: 'unsupported' };
  if (raw.v !== 0 && raw.v !== LEGACY_V1 && raw.v !== LEGACY_V2 && raw.v !== LEGACY_V3 && raw.v !== LEGACY_V4 && raw.v !== SAVE_VERSION &&
    raw.v !== WEATHER_SAVE_VERSION) return { status: 'error', issue: 'corrupt' };
  const migrated = raw.v === 0;
  const snapshot = migrated ? raw.snapshot ?? raw.state : raw.snapshot;
  if (!isRecord(snapshot) || !safeJsonTree(snapshot)) return { status: 'error', issue: 'corrupt' };
  // [night-12bd] R2j: the weather front lives in v6 envelopes only, and every v6 envelope carries it.
  if (snapshotHasWeather(snapshot) !== (raw.v === WEATHER_SAVE_VERSION)) return { status: 'error', issue: 'corrupt' };
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
    v: raw.v === WEATHER_SAVE_VERSION ? WEATHER_SAVE_VERSION : SAVE_VERSION, savedAt, seed, tick, snapshot, commands, stateHash, paramsVersion,
  };
  const digest = checksum(body);
  // A v1 envelope was checksummed with its own version number; it is verified as written, then re-tagged.
  const written = raw.v === LEGACY_V1 || raw.v === LEGACY_V2 || raw.v === LEGACY_V3 || raw.v === LEGACY_V4
    ? checksum({ ...body, v: raw.v } as unknown as Omit<GameSaveV1, 'checksum'>) : digest;
  if (!migrated && (typeof raw.checksum !== 'string' || written !== raw.checksum)) {
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
    // [night-12bd] R2j: v6 only for a weather run; every other save stays a byte-identical v5.
    v: snapshotHasWeather(snapshot) ? WEATHER_SAVE_VERSION : SAVE_VERSION, savedAt, seed: source.seed, tick: source.tick,
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

/** [night-07k] Longest run worth re-simulating on load; the leaderboard server uses the same 30-week cap (D-72). */
export const MAX_REPLAY_TICKS = 30 * TICKS_PER_WEEK;

/**
 * [night-07k] D-76: a save written under older sim rules is re-simulated from its seed and full command journal
 * under the current rules, to the same tick. The outcome can differ from the old build (that is the point of a rules
 * change), so a run that the new rules already end is not offered. Null when the save cannot be replayed.
 */
export function replaySave(save: GameSaveV1): Sim | null {
  try {
    const state = save.snapshot.state;
    const config = isRecord(state) && isRecord(state.config) ? state.config : undefined;
    const mode = config?.mode;
    if ((mode !== 'endless' && mode !== 'daily') || save.tick > MAX_REPLAY_TICKS) return null;
    // [night-11aj] R2g: the replay keeps the run's home region (Sim validates it; a pre-R2g save has none = Random).
    const homeRegion = config?.homeRegion;
    // [night-12ba] R2k: and its weekly contract flag (absent in every save before R2k).
    const contract = {
      ...(config?.weeklyContract === true ? { weeklyContract: true } : {}),
      // [night-12bb] R2i: and its demand surge flag (absent in every save before R2i).
      ...(config?.demandSurge === true ? { demandSurge: true } : {}),
      // [night-12bd] R2j: and its weather front flag (absent in every save before R2j and in shipped Endless).
      ...(config?.weatherFront === true ? { weatherFront: true } : {}),
    };
    // [night-12bc] R2h: and its licence class (absent = class I, every save before R2h).
    const licence = config?.licenceClass === undefined ? {} : { licenceClass: config.licenceClass };
    const sim = Sim.replay(save.seed, save.commands as never, save.tick,
      (homeRegion === undefined ? { mode, ...contract, ...licence } : { mode, homeRegion, ...contract, ...licence }) as GameConfig);
    if (sim.world.status !== 'running' && sim.world.status !== 'upgrade') return null;
    // Commands issued in the saved tick but not yet simulated still belong to the run.
    const pending = save.snapshot.pending;
    if (Array.isArray(pending)) for (const command of pending) if (isRecord(command)) sim.apply(command as never);
    return sim;
  } catch {
    return null;
  }
}

export type RestoredSim = { sim: Sim; replayed: boolean };

/**
 * Validated restore (hash-checked) of a current-rules save; a save from older rules (or a legacy save without a
 * rules version whose snapshot no longer loads) is replayed instead (D-76). A current-rules save that fails its
 * hash is corrupt and never replayed; a save from newer rules is refused. Null when nothing usable. Never throws.
 */
export function restoreSimDetailed(save: GameSaveV1): RestoredSim | null {
  if (save.paramsVersion !== null && save.paramsVersion > RULES_VERSION) return null;
  if (save.paramsVersion === null || save.paramsVersion === RULES_VERSION) {
    const sim = restoreGame(save, () => new SimRestoreTarget())?.sim ?? null;
    if (sim || save.paramsVersion === RULES_VERSION) return sim ? { sim, replayed: false } : null;
  }
  const sim = replaySave(save);
  return sim ? { sim, replayed: true } : null;
}

/** Validated restore; see restoreSimDetailed. */
export function restoreSimFromSave(save: GameSaveV1): Sim | null {
  return restoreSimDetailed(save)?.sim ?? null;
}

/**
 * [night-07k] Read and restore the save slot. A replayed (migrated) save is written back under the current rules
 * so the re-simulation is paid once, not at every launch. A failed write-back keeps the old save untouched.
 */
export async function loadSavedSim(storage: KeyValueStorage): Promise<RestoredSim | null> {
  return (await loadSavedSimChecked(storage)).restored;
}

/**
 * [night-10c] Saved flights the player is told about: a save exists but is damaged, or it comes from newer rules.
 * [night-11j] A save from older rules that the current rules cannot continue (its replay already ends the run, or
 * it is longer than the replay cap) is not damaged: it says so ('old-rules').
 * Unreadable storage is not reported — there may be no save at all (private window, blocked storage).
 */
export type SaveNotice = 'corrupt' | 'unsupported' | 'old-rules';

/** loadSavedSim plus why an existing save could not be continued (null: no save, or it restored). */
export async function loadSavedSimChecked(storage: KeyValueStorage): Promise<{ restored: RestoredSim | null; issue: SaveNotice | null }> {
  const loaded = await readGame(storage);
  if (loaded.status === 'missing') return { restored: null, issue: null };
  if (loaded.status === 'error') return { restored: null, issue: loaded.issue === 'storage-unavailable' ? null : loaded.issue };
  const restored = restoreSimDetailed(loaded.save);
  if (!restored) {
    const version = loaded.save.paramsVersion;
    const issue = version === null || version === RULES_VERSION ? 'corrupt' : version > RULES_VERSION ? 'unsupported' : 'old-rules';
    return { restored: null, issue };
  }
  if (restored.replayed) await writeGame(storage, saveSourceFromSim(restored.sim));
  return { restored, issue: null };
}
