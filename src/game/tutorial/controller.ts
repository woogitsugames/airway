// [task-23] Training progression is independent of renderer and simulation implementations.
export const TUTORIAL_KEY = 'aw-tutorial';
export const TUTORIAL_VERSION = 1;
export const TUTORIAL_STEPS = [
  'route', 'aircraft', 'transfer', 'dawn', 'upgrade', 'congestion', 'complete',
] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
export type UpgradeChoice = 'hub' | 'aircraft' | 'slots';
export type TutorialAction =
  | { type: 'route'; from: 'LON'; to: 'PAR' }
  | { type: 'assign-aircraft'; route: 'LON-PAR' }
  | { type: 'inspect-transfer'; hub: 'PAR' }
  | { type: 'watch-dawn' }
  | { type: 'upgrade'; choice: UpgradeChoice }
  | { type: 'relieve'; from: 'LON'; to: 'ROM' };

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
  readonly selectedUpgrade: UpgradeChoice | null;
}

type SavedTutorial = {
  version: number;
  status: 'in-progress' | 'completed' | 'skipped';
  step?: TutorialStep;
  selectedUpgrade?: UpgradeChoice;
};

const ACTION_FOR_STEP: Record<Exclude<TutorialStep, 'complete'>, TutorialAction['type']> = {
  route: 'route',
  aircraft: 'assign-aircraft',
  transfer: 'inspect-transfer',
  dawn: 'watch-dawn',
  upgrade: 'upgrade',
  congestion: 'relieve',
};

function isStep(value: unknown): value is TutorialStep {
  return typeof value === 'string' && TUTORIAL_STEPS.some((step) => step === value);
}
function isUpgrade(value: unknown): value is UpgradeChoice {
  return value === 'hub' || value === 'aircraft' || value === 'slots';
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
    if (candidate.selectedUpgrade !== undefined && !isUpgrade(candidate.selectedUpgrade)) return null;
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
      selectedUpgrade: saved?.selectedUpgrade ?? null,
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
    const selectedUpgrade = action.type === 'upgrade' ? action.choice : before.selectedUpgrade;
    this.change({ visible: true, step: next, busy: false, selectedUpgrade });
    if (next === 'complete') {
      this.save({ version: TUTORIAL_VERSION, status: 'completed', step: next, selectedUpgrade: selectedUpgrade ?? undefined });
      this.port.setPaused(false);
    } else {
      this.save({ version: TUTORIAL_VERSION, status: 'in-progress', step: next, selectedUpgrade: selectedUpgrade ?? undefined });
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
    this.change({ visible: true, step: 'route', busy: false, selectedUpgrade: null });
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
      case 'dawn': return action.type === 'watch-dawn';
      case 'upgrade': return action.type === 'upgrade' && isUpgrade(action.choice);
      case 'congestion': return action.type === 'relieve' && action.from === 'LON' && action.to === 'ROM';
      case 'complete': return false;
    }
  }
}

export function browserTutorialStorage(): TutorialStorage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; }
  catch { return null; }
}
