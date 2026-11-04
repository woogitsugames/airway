// [task-23] Training progression is independent of renderer and simulation implementations.
export const TUTORIAL_KEY = 'aw-tutorial';
// [night-11p] D-130: three steps before the first run; upgrades, congestion and the night became first-time cards in
// the real game (first-time.ts). The version stays 1: completed and skipped saves are still valid, and an
// in-progress save at a removed step fails `isStep` and simply starts the (now short) flight again.
export const TUTORIAL_VERSION = 1;
export const TUTORIAL_STEPS = ['route', 'aircraft', 'transfer', 'complete'] as const;
/** Steps the player acts on (the progress counter's total). */
export const TUTORIAL_ACTION_STEPS = TUTORIAL_STEPS.length - 1;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
export type TutorialAction =
  | { type: 'route'; from: 'LON'; to: 'PAR' }
  | { type: 'assign-aircraft'; route: 'LON-PAR' }
  | { type: 'inspect-transfer'; hub: 'PAR' };

export interface TutorialPort {
  /** Return true only after the game accepted the actual command or observed the event. */
  perform(action: TutorialAction): boolean | Promise<boolean>;
  /** Suspend authoritative ticks while waiting for the player's next action. */
  setPaused(paused: boolean): void;
  /** Rebuild the isolated three-city vignette for manual replay. */
  reset?(): void;
}

export interface TutorialStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TutorialState {
  readonly visible: boolean;
  readonly step: TutorialStep;
  readonly busy: boolean;
}

type SavedTutorial = {
  version: number;
  status: 'in-progress' | 'completed' | 'skipped';
  step?: TutorialStep;
};

const ACTION_FOR_STEP: Record<Exclude<TutorialStep, 'complete'>, TutorialAction['type']> = {
  route: 'route',
  aircraft: 'assign-aircraft',
  transfer: 'inspect-transfer',
};

function isStep(value: unknown): value is TutorialStep {
  return typeof value === 'string' && TUTORIAL_STEPS.some((step) => step === value);
}
function readSave(storage: TutorialStorage | null): SavedTutorial | null {
  try {
    const raw = storage?.getItem(TUTORIAL_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const candidate = data as Partial<SavedTutorial>;
    if (candidate.version !== TUTORIAL_VERSION) return null;
    if (!['in-progress', 'completed', 'skipped'].includes(candidate.status ?? '')) return null;
    if (candidate.step !== undefined && !isStep(candidate.step)) return null;
    return candidate as SavedTutorial;
  } catch {
    // Quota, unavailable storage and malformed saves must not block play.
    return null;
  }
}

export class TutorialController {
  private readonly port: TutorialPort;
  private readonly storage: TutorialStorage | null;
  private listeners = new Set<(state: TutorialState) => void>();
  private current: TutorialState;
  private generation = 0;

  constructor(port: TutorialPort, storage: TutorialStorage | null = null) {
    this.port = port;
    this.storage = storage;
    const saved = readSave(storage);
    const visible = saved === null || saved.status === 'in-progress';
    this.current = {
      visible,
      step: saved?.status === 'in-progress' && saved.step ? saved.step : 'route',
      busy: false,
    };
    this.port.setPaused(visible && this.current.step !== 'complete');
  }

  getState(): TutorialState { return this.current; }
  subscribe(listener: (state: TutorialState) => void): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => { this.listeners.delete(listener); };
  }

  async submit(action: TutorialAction): Promise<boolean> {
    const before = this.current;
    if (!before.visible || before.busy || before.step === 'complete' ||
      ACTION_FOR_STEP[before.step] !== action.type) return false;
    if (!this.isExpectedAction(before.step, action)) return false;
    this.change({ ...before, busy: true });
    const generation = this.generation;
    let accepted = false;
    try { accepted = await this.port.perform(action); } catch { accepted = false; }
    if (generation !== this.generation) return false;
    if (!accepted) {
      this.change({ ...before, busy: false });
      return false;
    }
    const next = TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(before.step) + 1];
    this.change({ visible: true, step: next, busy: false });
    if (next === 'complete') {
      this.save({ version: TUTORIAL_VERSION, status: 'completed', step: next });
      this.port.setPaused(false);
    } else {
      this.save({ version: TUTORIAL_VERSION, status: 'in-progress', step: next });
      this.port.setPaused(true);
    }
    return true;
  }

  skip(): void {
    this.generation++;
    this.change({ ...this.current, visible: false, busy: false });
    this.save({ version: TUTORIAL_VERSION, status: 'skipped' });
    this.port.setPaused(false);
  }
  close(): void {
    if (this.current.step !== 'complete') return;
    this.change({ ...this.current, visible: false });
    this.port.setPaused(false);
  }
  replay(): void {
    this.generation++;
    this.port.reset?.();
    this.change({ visible: true, step: 'route', busy: false });
    this.save({ version: TUTORIAL_VERSION, status: 'in-progress', step: 'route' });
    this.port.setPaused(true);
  }
  dispose(): void {
    this.generation++;
    this.listeners.clear();
    this.port.setPaused(false);
  }

  private save(data: SavedTutorial): void {
    try { this.storage?.setItem(TUTORIAL_KEY, JSON.stringify(data)); } catch { /* Optional storage. */ }
  }
  private change(state: TutorialState): void {
    this.current = state;
    this.listeners.forEach((listener) => listener(state));
  }
  private isExpectedAction(step: TutorialStep, action: TutorialAction): boolean {
    switch (step) {
      case 'route': return action.type === 'route' && action.from === 'LON' && action.to === 'PAR';
      case 'aircraft': return action.type === 'assign-aircraft' && action.route === 'LON-PAR';
      case 'transfer': return action.type === 'inspect-transfer' && action.hub === 'PAR';
      case 'complete': return false;
    }
  }
}

export function browserTutorialStorage(): TutorialStorage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; }
  catch { return null; }
}
