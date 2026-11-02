import { Rng } from '../core/rng.ts';
import { clockAt, isSimSpeed, type ClockTime } from './clock.ts';
import { isCommandType, validateCommand, type Command, type CommandEntry } from './commands.ts';
import {
  canonicalJson, copyState, foldCommandDigest, hashState, initialState,
  RULES_VERSION, SNAPSHOT_VERSION, type RngStream, type SimState,
} from './state.ts';
import { CHECKPOINT_EVERY_TICKS, CheckpointRing, MAX_CHECKPOINTS, type Checkpoint } from './undo.ts';

const STREAM_NAMES: readonly RngStream[] = ['cities', 'demand', 'events', 'upgrades'];
const UINT32_MAX = 0xffff_ffff;

interface SnapshotV1 {
  version: 1;
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

/** Structural JSON checks only; gameplay feasibility remains a future task. */
function copyCommand(value: unknown): Command {
  const parsed: unknown = JSON.parse(canonicalJson(value));
  if (!object(parsed) || !isCommandType(parsed.type)) {
    throw new TypeError('unknown command type');
  }
  const requiredStrings: Record<Command['type'], readonly string[]> = {
    AddRoute: ['routeId', 'fromCityId', 'toCityId'],
    ExtendRoute: ['routeId', 'cityId'],
    RemoveRoute: ['routeId'],
    AssignPlane: ['planeId', 'routeId'],
    UnassignPlane: ['planeId'],
    UpgradeHub: ['hubId'],
    ChooseUpgrade: ['upgradeId'],
    SetSpeed: [],
  };
  for (const field of requiredStrings[parsed.type]) {
    if (typeof parsed[field] !== 'string' || parsed[field].length === 0) {
      throw new TypeError(`command field ${field} must be a nonempty string`);
    }
  }
  if ((parsed.type === 'AddRoute' || parsed.type === 'ExtendRoute') &&
      (!safeCount(parsed.flightTicks) || parsed.flightTicks === 0)) {
    throw new RangeError('flightTicks must be a positive integer');
  }
  if (parsed.type === 'SetSpeed' && !isSimSpeed(parsed.speed)) {
    throw new RangeError('invalid SetSpeed value');
  }
  return parsed as Command;
}

function copyEntry(entry: CommandEntry): CommandEntry {
  return [entry[0], copyCommand(entry[1])];
}

function readState(value: unknown): SimState {
  if (!object(value) || !object(value.rng) || value.rulesVersion !== RULES_VERSION ||
      !uint32(value.seed) || !safeCount(value.tick) || !isSimSpeed(value.speed) ||
      !safeCount(value.commandCount) || !uint32(value.commandDigest)) {
    throw new TypeError('invalid or incompatible simulation state');
  }
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
  let digest = initialState(state.seed).commandDigest;
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

function rngForState(state: SimState): Record<RngStream, Rng> {
  const base = new Rng(state.seed);
  const streams = {
    cities: base.fork('cities'),
    demand: base.fork('demand'),
    events: base.fork('events'),
    upgrades: base.fork('upgrades'),
  };
  for (const name of STREAM_NAMES) streams[name].setState(state.rng[name]);
  return streams;
}

/** Only tick() executes queued commands; elapsed real time belongs to src/game. */
export class Sim {
  private state: SimState;
  private streams: Record<RngStream, Rng>;
  private journal: CommandEntry[] = [];
  private pending: Command[] = [];
  private readonly checkpoints = new CheckpointRing();

  constructor(seed: number) {
    this.state = initialState(seed);
    this.streams = rngForState(this.state);
    this.checkpoints.capture(this.state);
  }

  get seed(): number { return this.state.seed; }
  get tickCount(): number { return this.state.tick; }
  get speed(): SimState['speed'] { return this.state.speed; }
  /** While paused, a queued resume command must wake the external scheduler. */
  get schedulingSpeed(): SimState['speed'] {
    if (this.state.speed !== 0) return this.state.speed;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const cmd = this.pending[i];
      if (cmd.type === 'SetSpeed') return cmd.speed;
    }
    return 0;
  }
  get pendingCount(): number { return this.pending.length; }
  get clock(): ClockTime { return clockAt(this.state.tick); }

  getState(): Readonly<SimState> { return copyState(this.state); }
  getCommandLog(): CommandEntry[] { return this.journal.map(copyEntry); }

  /** Queue an isolated copy; callers cannot mutate a scheduled action. */
  apply(cmd: Command): boolean {
    const command = copyCommand(cmd);
    if (!validateCommand(command)) return false;
    this.pending.push(command);
    return true;
  }

  tick(): void {
    if (!Number.isSafeInteger(this.state.tick + 1)) throw new RangeError('tick overflow');
    this.state.tick++;
    for (let i = 0; i < this.pending.length; i++) {
      const cmd = this.pending[i];
      if (cmd.type === 'SetSpeed') this.state.speed = cmd.speed;
      // Other commands are intentionally journal-only until game rules arrive.
      const entry: CommandEntry = [this.state.tick, cmd];
      this.journal.push(entry);
      this.state.commandCount++;
      this.state.commandDigest = foldCommandDigest(this.state.commandDigest, entry);
    }
    this.pending.length = 0;
    // Save explicit stream states even when no consumer drew during this tick.
    for (let i = 0; i < STREAM_NAMES.length; i++) {
      const name = STREAM_NAMES[i];
      this.state.rng[name] = this.streams[name].state;
    }
    if (this.state.tick % CHECKPOINT_EVERY_TICKS === 0) this.checkpoints.capture(this.state);
  }

  /** Reserved for future world rules: deterministic RNG draws only during tick(). */
  protected nextRandom(stream: RngStream): number {
    const sample = this.streams[stream].next();
    this.state.rng[stream] = this.streams[stream].state;
    return sample;
  }

  hash(): string { return hashState(this.state); }

  /** JSON includes pending input, command journal, stream states and bounded history. */
  snapshot(): string {
    const save: SnapshotV1 = {
      version: SNAPSHOT_VERSION,
      state: copyState(this.state),
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
    this.state = state;
    this.journal = journal;
    this.pending = pending;
    this.streams = rngForState(state);
    this.checkpoints.replace(points);
  }

  static fromSnapshot(json: string): Sim {
    const sim = new Sim(0);
    sim.restore(json);
    return sim;
  }

  /** Replay does not use a wall-clock accumulator or external randomness. */
  static replay(seed: number, entries: readonly CommandEntry[], untilTick: number): Sim {
    if (!safeCount(untilTick)) throw new RangeError('invalid replay length');
    const sim = new Sim(seed);
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
    return sim;
  }

  /** Remove the newest player command and exactly re-simulate up to the same tick. */
  undo(): boolean {
    if (this.pending.length) {
      this.pending.pop();
      return true;
    }
    if (this.journal.length === 0) return false;

    const targetTick = this.state.tick;
    const removedTick = this.journal[this.journal.length - 1][0];
    const retained = this.journal.slice(0, -1);
    const checkpoint = this.checkpoints.before(removedTick) ?? {
      tick: 0, commandCount: 0, state: initialState(this.state.seed),
    };
    this.state = copyState(checkpoint.state);
    this.streams = rngForState(this.state);
    this.journal = retained.slice(0, checkpoint.commandCount);
    this.pending.length = 0;
    this.checkpoints.truncateAfter(checkpoint.tick);

    let index = checkpoint.commandCount;
    while (this.state.tick < targetTick) {
      const nextTick = this.state.tick + 1;
      while (index < retained.length && retained[index][0] === nextTick) {
        this.pending.push(copyCommand(retained[index][1]));
        index++;
      }
      this.tick();
    }
    return true;
  }
}
