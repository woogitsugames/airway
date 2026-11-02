// The single authoritative simulation (task 02 kernel). It journals commands, owns the RNG streams,
// steps the game world (world.ts) once per tick, and provides hash, snapshot/restore, replay and undo.
import { Rng } from '../core/rng.ts';
import { clockAt, isSimSpeed, type ClockTime } from './clock.ts';
import {
  isCommandType, normalizeCommand, type Command, type CommandCheck, type CommandEntry,
} from './commands.ts';
import { scenarioFor } from './scenarios.ts';
import {
  canonicalJson, copyKernel, copyState, foldCommandDigest, hashState, initialKernelState,
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
function copyCommand(value: unknown): Command {
  if (!object(value) || !isCommandType(value.type)) throw new TypeError('unknown command type');
  return normalizeCommand(JSON.parse(canonicalJson(value)));
}
function copyEntry(entry: CommandEntry): CommandEntry {
  return [entry[0], copyCommand(entry[1])];
}

function readConfig(value: unknown): GameConfig {
  if (!object(value) || !MODES.includes(value.mode as GameMode) ||
      (value.puzzleId !== undefined && typeof value.puzzleId !== 'string') ||
      ((value.mode === 'puzzle') !== (value.puzzleId !== undefined))) {
    throw new TypeError('invalid game configuration');
  }
  return value.puzzleId === undefined ? { mode: value.mode as GameMode }
    : { mode: value.mode as GameMode, puzzleId: value.puzzleId as string };
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
export class Sim {
  private kernel: KernelState;
  /** Stream objects are stable for the world's lifetime; restore only rewinds their states. */
  private streams: Record<RngStream, Rng>;
  private worldValue: World;
  private journal: CommandEntry[] = [];
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
      return this.pending.some((cmd) => cmd.type === 'ChooseUpgrade') ? (speed === 0 ? 1 : speed) : 0;
    }
    return speed;
  }

  getState(): Readonly<SimState> { return this.fullState(); }
  getCommandLog(): CommandEntry[] { return this.journal.map(copyEntry); }
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
      if (cmd.type === 'SetSpeed') this.kernel.speed = cmd.speed;
      else this.worldValue.apply(cmd);
      const entry: CommandEntry = [this.kernel.tick, cmd];
      this.journal.push(entry);
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

  /** Replay does not use a wall-clock accumulator or external randomness. */
  static replay(seed: number, entries: readonly CommandEntry[], untilTick: number, config?: GameConfig): Sim {
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

  /** Remove the newest player command and exactly re-simulate up to the same tick. */
  undo(): boolean {
    if (this.pending.length) {
      this.pending.pop();
      return true;
    }
    if (this.journal.length === 0) return false;

    const targetTick = this.kernel.tick;
    const removedTick = this.journal[this.journal.length - 1][0];
    const retained = this.journal.slice(0, -1);
    const checkpoint = this.checkpoints.before(removedTick) ??
      { tick: 0, commandCount: 0, state: new Sim(this.kernel.seed, this.kernel.config).fullState() };
    this.loadState(checkpoint.state);
    this.journal = retained.slice(0, checkpoint.commandCount);
    this.pending.length = 0;
    this.checkpoints.truncateAfter(checkpoint.tick);

    let index = checkpoint.commandCount;
    while (this.kernel.tick < targetTick) {
      const nextTick = this.kernel.tick + 1;
      while (index < retained.length && retained[index][0] === nextTick) {
        this.pending.push(copyCommand(retained[index][1]));
        index++;
      }
      this.tick();
    }
    // Re-simulated ticks must not replay notifications the player has already seen.
    this.worldValue.clearEvents();
    return true;
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
