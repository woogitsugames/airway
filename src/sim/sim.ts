// The single authoritative simulation (task 02 kernel). It journals commands, owns the RNG streams,
// steps the game world (world.ts) once per tick, and provides hash, snapshot/restore, replay and undo.
import { Rng } from '../core/rng.ts';
import { clockAt, isSimSpeed, type ClockTime } from './clock.ts';
import {
  isCommandType, normalizeCommand, type Command, type CommandCheck, type CommandEntry,
} from './commands.ts';
import { scenarioFor } from './scenarios.ts';
import type { RegionId } from '../data/regions.ts';
import { HOME_REGIONS } from './spawner.ts';
import {
  canonicalJson, copyConfig, copyKernel, copyState, foldCommandDigest, hashState, initialKernelState,
  INITIAL_COMMAND_DIGEST, RULES_VERSION, SNAPSHOT_VERSION,
  type GameConfig, type KernelState, type RngStream, type SimState,
} from './state.ts';
import { CHECKPOINT_EVERY_TICKS, CheckpointRing, MAX_CHECKPOINTS, type Checkpoint } from './undo.ts';
import { World, type GameMode, type SimEvent, type WorldView } from './world.ts';

const STREAM_NAMES: readonly RngStream[] = ['cities', 'demand', 'events', 'upgrades'];
const UINT32_MAX = 0xffff_ffff;
const MODES: readonly GameMode[] = ['endless', 'daily', 'puzzle'];

interface SnapshotV2 {
  version: typeof SNAPSHOT_VERSION;
  state: SimState;
  journal: CommandEntry[];
  pending: Command[];
  checkpoints: Checkpoint[];
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function safeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function uint32(value: unknown): value is number {
  return safeCount(value) && value <= UINT32_MAX;
}

/** Structural copy of a command (see normalizeCommand); throws TypeError/RangeError. */
/** [night-07x] Commands Undo may remove: everything but the weekly choices. */
export function undoable(command: Command): boolean {
  return command.type !== 'ChooseUpgrade' && command.type !== 'CancelUpgradePick';
}

/**
 * [night-60a] D-321: what an Undo tap did. `none`: nothing undoable (empty, or a weekly choice is next, D-313).
 * `jam`: refused, the re-simulation without the command jams `cityId` at world `minute` (sim `tick`) before now.
 */
export type UndoResult =
  | { readonly done: true }
  | { readonly done: false; readonly reason: 'none' }
  | { readonly done: false; readonly reason: 'jam'; readonly cityId: string; readonly minute: number; readonly tick: number };
const UNDONE: UndoResult = { done: true };
const NOTHING_TO_UNDO: UndoResult = { done: false, reason: 'none' };

function copyCommand(value: unknown): Command {
  if (!object(value) || !isCommandType(value.type)) throw new TypeError('unknown command type');
  return normalizeCommand(JSON.parse(canonicalJson(value)));
}
function copyEntry(entry: CommandEntry): CommandEntry {
  return [entry[0], copyCommand(entry[1])];
}

function isHomeRegion(value: unknown): value is RegionId {
  return (HOME_REGIONS as readonly unknown[]).includes(value);
}

function readConfig(value: unknown): GameConfig {
  if (!object(value) || !MODES.includes(value.mode as GameMode) ||
      (value.puzzleId !== undefined && typeof value.puzzleId !== 'string') ||
      ((value.mode === 'puzzle') !== (value.puzzleId !== undefined)) ||
      // [night-11aj] R2g: a home region is an Endless choice only (Daily stays one world for everyone).
      (value.homeRegion !== undefined && (value.mode !== 'endless' || !isHomeRegion(value.homeRegion))) ||
      (value.eusClusterV2 !== undefined && (value.homeRegion !== 'EUS' || value.eusClusterV2 !== true)) ||
      // [night-12ba] R2k: the weekly contract is an Endless rule only (Daily and its leaderboards stay as they were).
      (value.weeklyContract !== undefined && (value.mode !== 'endless' || value.weeklyContract !== true)) ||
      // [night-12bb] R2i: the demand surge is an Endless rule only, like the contract.
      (value.demandSurge !== undefined && (value.mode !== 'endless' || value.demandSurge !== true)) ||
      // [night-12bc] R2h: a licence class above I is an Endless choice only (Daily keeps one rule set for everyone).
      (value.licenceClass !== undefined && (value.mode !== 'endless' || (value.licenceClass !== 2 && value.licenceClass !== 3))) ||
      // [night-12bd] R2j: the weather front is an Endless rule only (Daily and its leaderboards stay as they were).
      (value.weatherFront !== undefined && (value.mode !== 'endless' || value.weatherFront !== true)) ||
      // [night-86a] D-343: the morning start belongs to Endless and Daily, never to a puzzle (its levels are timed).
      (value.morningStart !== undefined && (value.mode === 'puzzle' || value.morningStart !== true))) {
    throw new TypeError('invalid game configuration');
  }
  return copyConfig(value as unknown as GameConfig);
}

function readState(value: unknown): SimState {
  if (!object(value) || !object(value.rng) || value.rulesVersion !== RULES_VERSION ||
      !uint32(value.seed) || !safeCount(value.tick) || !isSimSpeed(value.speed) ||
      !safeCount(value.commandCount) || !uint32(value.commandDigest) || !object(value.world)) {
    throw new TypeError('invalid or incompatible simulation state');
  }
  readConfig(value.config);
  for (const name of STREAM_NAMES) {
    if (!uint32(value.rng[name])) throw new TypeError(`invalid RNG stream: ${name}`);
  }
  return copyState(value as unknown as SimState);
}

function readJournal(value: unknown, state: SimState): CommandEntry[] {
  if (!Array.isArray(value) || value.length !== state.commandCount) {
    throw new TypeError('journal length and commandCount do not match');
  }
  const entries: CommandEntry[] = [];
  let lastTick = 0;
  let digest = INITIAL_COMMAND_DIGEST;
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || !safeCount(entry[0]) ||
        entry[0] < 1 || entry[0] < lastTick || entry[0] > state.tick) {
      throw new TypeError('invalid or unsorted command journal');
    }
    const copied: CommandEntry = [entry[0], copyCommand(entry[1])];
    digest = foldCommandDigest(digest, copied);
    entries.push(copied);
    lastTick = entry[0];
  }
  if (digest !== state.commandDigest) throw new TypeError('command journal digest mismatch');
  return entries;
}

function readCheckpoints(value: unknown, state: SimState, log: readonly CommandEntry[]): Checkpoint[] {
  if (!Array.isArray(value) || value.length > MAX_CHECKPOINTS) {
    throw new TypeError('invalid checkpoint ring');
  }
  const checkpoints: Checkpoint[] = [];
  let previousTick = -1;
  for (const item of value) {
    if (!object(item) || !safeCount(item.tick) || !safeCount(item.commandCount) ||
        item.tick > state.tick || item.tick <= previousTick ||
        item.tick % CHECKPOINT_EVERY_TICKS !== 0) {
      throw new TypeError('invalid checkpoint tick');
    }
    const checkedState = readState(item.state);
    if (checkedState.tick !== item.tick || checkedState.seed !== state.seed ||
        canonicalJson(checkedState.config) !== canonicalJson(state.config) ||
        checkedState.commandCount !== item.commandCount ||
        item.commandCount > log.length ||
        (item.commandCount > 0 && log[item.commandCount - 1][0] > item.tick) ||
        (item.commandCount < log.length && log[item.commandCount][0] <= item.tick)) {
      throw new TypeError('checkpoint does not match journal');
    }
    checkpoints.push({ tick: item.tick, commandCount: item.commandCount, state: checkedState });
    previousTick = item.tick;
  }
  return checkpoints;
}

function freshStreams(seed: number): Record<RngStream, Rng> {
  const base = new Rng(seed);
  return {
    cities: base.fork('cities'),
    demand: base.fork('demand'),
    events: base.fork('events'),
    upgrades: base.fork('upgrades'),
  };
}

/**
 * Only tick() executes queued commands and advances time; elapsed real time belongs to src/game.
 * One tick = one game minute at every speed (SetSpeed only changes how often src/game calls tick()).
 */
/** [night-10t] The game minute a journal entry ran at and whether the world accepted it (CommandRejected if not). */
export interface CommandOutcome { readonly minute: number; readonly accepted: boolean }

export class Sim {
  private kernel: KernelState;
  /** Stream objects are stable for the world's lifetime; restore only rewinds their states. */
  private streams: Record<RngStream, Rng>;
  private worldValue: World;
  private journal: CommandEntry[] = [];
  /**
   * [night-10t] What became of each journal entry at its tick (game minute, accepted), parallel to the journal.
   * Not part of the state, hash or snapshot: a restored journal's outcomes are unknown (null) until re-simulated.
   */
  private outcomes: (CommandOutcome | null)[] = [];
  private pending: Command[] = [];
  private readonly checkpoints = new CheckpointRing();

  constructor(seed: number, config: GameConfig = { mode: 'endless' }) {
    if (!uint32(seed)) throw new RangeError('seed must be an unsigned 32-bit integer');
    this.kernel = initialKernelState(seed, readConfig(config));
    this.streams = freshStreams(seed);
    // The world may draw at creation (seeded start cities); those draws are part of tick 0.
    this.worldValue = new World(seed, scenarioFor(this.kernel.config), this.streams);
    this.syncStreams();
    this.checkpoints.capture(this.fullState());
  }

  get seed(): number { return this.kernel.seed; }
  get config(): GameConfig { return { ...this.kernel.config }; }
  get tickCount(): number { return this.kernel.tick; }
  get speed(): KernelState['speed'] { return this.kernel.speed; }
  get pendingCount(): number { return this.pending.length; }
  /** Game calendar (world minutes). Stops while a weekly upgrade is pending or the run ended. */
  get clock(): ClockTime { return clockAt(this.worldValue.minute); }
  /** Read-only access to world views (cities, routes, planes, offer, ledger). Never mutate. */
  get world(): WorldView { return this.worldValue; }

  /**
   * The rate src/game should tick at. A queued positive SetSpeed wakes a paused scheduler; a pending
   * weekly offer pauses until a ChooseUpgrade is queued; a finished run never needs ticks.
   */
  get schedulingSpeed(): KernelState['speed'] {
    let speed = this.kernel.speed;
    // Queued commands need one tick to apply, so a pending pause still ticks at the current speed.
    for (let i = this.pending.length - 1; speed === 0 && i >= 0; i--) {
      const cmd = this.pending[i];
      if (cmd.type === 'SetSpeed') { speed = cmd.speed; break; }
    }
    const status = this.worldValue.status;
    if (status === 'over' || status === 'won') return 0;
    if (status === 'upgrade') {
      // [task-39] CancelUpgradePick is an offer command too: it needs its tick while the world is frozen.
      return this.pending.some((cmd) => cmd.type === 'ChooseUpgrade' || cmd.type === 'CancelUpgradePick') ? (speed === 0 ? 1 : speed) : 0;
    }
    return speed;
  }

  getState(): Readonly<SimState> { return this.fullState(); }
  getCommandLog(): CommandEntry[] { return this.journal.map(copyEntry); }
  /** [night-10t] Outcome of each journal entry, same order as getCommandLog(); null where not known (restored). */
  getCommandOutcomes(): (CommandOutcome | null)[] { return this.outcomes.map((o) => (o ? { ...o } : null)); }
  drainEvents(): SimEvent[] { return this.worldValue.drainEvents(); }

  /** Pre-flight check against the current world, for immediate UI feedback. Does not queue. */
  check(cmd: Command): CommandCheck {
    let command: Command;
    try { command = copyCommand(cmd); } catch { return { ok: false, reason: 'UNKNOWN_CITY' }; }
    return this.worldValue.check(command);
  }

  /**
   * Queue an isolated, normalised copy for the next tick. Returns false only for malformed input;
   * domain validity is decided at the tick (see check() and the CommandRejected event).
   */
  apply(cmd: Command): boolean {
    let command: Command;
    try { command = copyCommand(cmd); } catch { return false; }
    this.pending.push(command);
    return true;
  }

  tick(): void {
    if (!Number.isSafeInteger(this.kernel.tick + 1)) throw new RangeError('tick overflow');
    this.kernel.tick++;
    for (let i = 0; i < this.pending.length; i++) {
      const cmd = this.pending[i];
      const minute = this.worldValue.minute;
      let accepted = true;
      if (cmd.type === 'SetSpeed') this.kernel.speed = cmd.speed;
      else accepted = this.worldValue.apply(cmd).ok;
      const entry: CommandEntry = [this.kernel.tick, cmd];
      this.journal.push(entry);
      this.outcomes.push({ minute, accepted });
      this.kernel.commandCount++;
      this.kernel.commandDigest = foldCommandDigest(this.kernel.commandDigest, entry);
    }
    this.pending.length = 0;
    this.worldValue.step();
    this.syncStreams();
    if (this.kernel.tick % CHECKPOINT_EVERY_TICKS === 0) this.checkpoints.capture(this.fullState());
  }

  /** Advance n ticks (headless tools, tests, bot). */
  advance(ticks: number): void {
    if (!safeCount(ticks)) throw new RangeError('invalid tick count');
    for (let i = 0; i < ticks; i++) this.tick();
  }

  hash(): string { return hashState(this.fullState()); }

  /** JSON includes pending input, command journal, stream states, world and bounded history. */
  snapshot(): string {
    const save: SnapshotV2 = {
      version: SNAPSHOT_VERSION,
      state: this.fullState(),
      journal: this.getCommandLog(),
      pending: this.pending.map(copyCommand),
      checkpoints: this.checkpoints.export(),
    };
    return JSON.stringify(save);
  }

  restore(json: string): void {
    const saved: unknown = JSON.parse(json);
    if (!object(saved) || saved.version !== SNAPSHOT_VERSION) {
      throw new TypeError('unsupported simulation snapshot version');
    }
    const state = readState(saved.state);
    const journal = readJournal(saved.journal, state);
    if (!Array.isArray(saved.pending)) throw new TypeError('invalid pending command queue');
    const pending = saved.pending.map(copyCommand);
    const points = readCheckpoints(saved.checkpoints, state, journal);
    this.loadState(state);
    this.journal = journal;
    this.outcomes = journal.map(() => null);
    this.pending = pending;
    this.checkpoints.replace(points);
  }

  static fromSnapshot(json: string): Sim {
    const saved: unknown = JSON.parse(json);
    if (!object(saved) || !object(saved.state)) throw new TypeError('unsupported simulation snapshot version');
    const seed = saved.state.seed;
    if (!uint32(seed)) throw new TypeError('invalid or incompatible simulation state');
    const sim = new Sim(seed, readConfig(saved.state.config));
    sim.restore(json);
    return sim;
  }

  /**
   * Replay does not use a wall-clock accumulator or external randomness.
   * [night-12d] `stopAtEnd` (D-97): stop after the tick on which the run ended ('over' or 'won'), even before
   * `untilTick`. The live game never ticks a finished world (EndlessRun.step), so a finished run replays to the
   * same tick and hash; the server uses it so a claimed `endTick` past the game over costs nothing extra.
   */
  static replay(seed: number, entries: readonly CommandEntry[], untilTick: number, config?: GameConfig,
    stopAtEnd = false): Sim {
    if (!safeCount(untilTick)) throw new RangeError('invalid replay length');
    const sim = new Sim(seed, config);
    let index = 0;
    let previousTick = 0;
    for (const [tick] of entries) {
      if (!safeCount(tick) || tick < 1 || tick < previousTick || tick > untilTick) {
        throw new RangeError('replay journal must be sorted, in range and start at tick 1');
      }
      previousTick = tick;
    }
    while (sim.tickCount < untilTick) {
      if (stopAtEnd && (sim.worldValue.status === 'over' || sim.worldValue.status === 'won')) break;
      const nextTick = sim.tickCount + 1;
      while (index < entries.length && entries[index][0] === nextTick) {
        sim.apply(entries[index][1]);
        index++;
      }
      sim.tick();
    }
    sim.worldValue.clearEvents();
    return sim;
  }

  /**
   * [night-56a] Whether undo() would remove a command (D-313): drives the HUD's Undo button.
   */
  get canUndo(): boolean { return this.undoTarget() !== null; }

  /**
   * [night-56a] D-313 (Q-92 → A): the newest undoable command, scanning back from the queue through the journal,
   * but never past a weekly choice. A closed week is a barrier: removing a network command from before the pick
   * re-simulated up to 1.5 days without it, which could jam a hub before the board and end the run in the past,
   * the pick gone with it (seed 42704 ASI class II). Undo only ever drops commands from the log, so replay and
   * Daily verification are unchanged.
   */
  private undoTarget(): { readonly pending: boolean; readonly index: number } | null {
    if (this.pending.length) {
      const index = this.pending.length - 1;
      return undoable(this.pending[index]) ? { pending: true, index } : null;
    }
    if (!this.journal.length) return null;
    const index = this.journal.length - 1;
    return undoable(this.journal[index][1]) ? { pending: false, index } : null;
  }

  /**
   * Remove the newest player command and exactly re-simulate up to the same tick.
   * [night-07x] Weekly choices (ChooseUpgrade, CancelUpgradePick) are never undone: popping a
   * week's choice left the world back on that week's board after the UI had closed it, so the clock froze with
   * no board on screen (soft lock). [night-56a] D-313: nor does Undo reach past one (see undoTarget).
   * [night-60a] D-321: nor does Undo end the run (see tryUndo); true only when a command was removed.
   */
  undo(): boolean { return this.tryUndo().done; }

  /**
   * [night-60a] D-321 (Q-93 → A): undo() with the reason when nothing changed. An Undo whose exact re-simulation ends
   * the run (an airport jams at or before the current tick, while the run is still going now) is refused: the
   * re-simulation is the same loop as an accepted Undo, it only stops at the jam, and then the Sim is put back to the
   * very objects it held before the tap (state, journal, outcomes, queue, checkpoint ring), so the hash, the journal
   * and the undo history are unchanged. Undo still only ever drops commands from the log: replay and Daily
   * verification are unaffected.
   */
  tryUndo(): UndoResult {
    const target = this.undoTarget();
    if (!target) return NOTHING_TO_UNDO;
    if (target.pending) {
      this.pending.splice(target.index, 1);
      return UNDONE;
    }
    const removedIndex = target.index;
    // Everything below is replaced, never changed in place (loadState builds a new world and streams), except the
    // queue, which is empty when the target is journaled, and the checkpoint ring, kept by reference.
    const before = {
      kernel: this.kernel, streams: this.streams, world: this.worldValue,
      journal: this.journal, outcomes: this.outcomes, checkpoints: this.checkpoints.keep(),
    };
    const endsRunNow = this.worldValue.status === 'over';

    const targetTick = this.kernel.tick;
    const removedTick = this.journal[removedIndex][0];
    const retained = [...this.journal.slice(0, removedIndex), ...this.journal.slice(removedIndex + 1)];
    const checkpoint = this.checkpoints.before(removedTick) ??
      { tick: 0, commandCount: 0, state: new Sim(this.kernel.seed, this.kernel.config).fullState() };
    this.loadState(checkpoint.state);
    this.journal = retained.slice(0, checkpoint.commandCount);
    this.outcomes = this.outcomes.slice(0, checkpoint.commandCount); // checkpoint tick < removedTick: all before it
    this.pending.length = 0;
    this.checkpoints.truncateAfter(checkpoint.tick);

    let index = checkpoint.commandCount;
    while (this.kernel.tick < targetTick) {
      if (!endsRunNow && this.worldValue.status === 'over') break;
      const nextTick = this.kernel.tick + 1;
      while (index < retained.length && retained[index][0] === nextTick) {
        this.pending.push(copyCommand(retained[index][1]));
        index++;
      }
      this.tick();
    }
    const failure = this.worldValue.failure;
    if (!endsRunNow && this.worldValue.status === 'over' && failure) {
      const refused: UndoResult = {
        done: false, reason: 'jam', cityId: failure.cityId, minute: this.worldValue.minute, tick: this.kernel.tick,
      };
      this.kernel = before.kernel;
      this.streams = before.streams;
      this.worldValue = before.world;
      this.journal = before.journal;
      this.outcomes = before.outcomes;
      this.pending.length = 0;
      this.checkpoints.putBack(before.checkpoints);
      return refused;
    }
    // Re-simulated ticks must not replay notifications the player has already seen.
    this.worldValue.clearEvents();
    return UNDONE;
  }

  private syncStreams(): void {
    for (let i = 0; i < STREAM_NAMES.length; i++) {
      const name = STREAM_NAMES[i];
      this.kernel.rng[name] = this.streams[name].state;
    }
  }

  private fullState(): SimState {
    return copyState({ ...copyKernel(this.kernel), world: this.worldValue.snapshot() });
  }

  private loadState(state: SimState): void {
    const { world, ...kernel } = copyState(state);
    const streams = freshStreams(kernel.seed);
    const next = new World(kernel.seed, scenarioFor(kernel.config), streams);
    next.restore(world);
    for (const name of STREAM_NAMES) streams[name].setState(kernel.rng[name]);
    this.kernel = copyKernel(kernel);
    this.streams = streams;
    this.worldValue = next;
  }
}
