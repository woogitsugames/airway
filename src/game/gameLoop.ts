/**
 * [night-12ay] R3i (D-245): Firebase Test Lab game-loop runs. Test Lab starts the app with the intent action
 * `com.google.intent.action.TEST_LOOP`, a scenario number and a result file URI; MainActivity hands both to the web
 * game (src/platform/gameLoop.ts), the game plays the scenario on the real session with the task-22 autoplay bot
 * through real Commands for a fixed real time, then writes one JSON report with the `.perf/scene.json` frame fields
 * and the activity finishes. Pure: no DOM, no clock of its own (callers pass timestamps), no Capacitor.
 */
export const GAME_LOOP_ACTION = 'com.google.intent.action.TEST_LOOP';

export interface GameLoopScenario {
  /** Test Lab's `--scenario-numbers` value (1-based, `com.google.test.loops` in the manifest). */
  readonly number: number;
  readonly id: string;
  /** Test Lab label (`com.google.test.loops.<label>` meta-data, `--scenario-labels`). */
  readonly label: string;
  readonly seed: number;
  /** Real (wall-clock) time the scenario is measured for. */
  readonly durationMs: number;
  /** Game speed (the HUD's 1×/2×/4×): 4× grows the network within the measured window. */
  readonly speed: 1 | 2 | 4;
  /** Ticks between bot decisions; the DEV autoplay and the balance report use the same cadence (30). */
  readonly decisionTicks: number;
}

/** The scenario table; the manifest's `com.google.test.loops` count equals its length (test:game-loop). */
export const GAME_LOOP_SCENARIOS: readonly GameLoopScenario[] = [
  { number: 1, id: 'autoplay-endless', label: 'perf', seed: 0xA1A1, durationMs: 120_000, speed: 4, decisionTicks: 30 },
];

/** The scenario Test Lab asked for; null for a number the game does not know (the report then says so). */
export function gameLoopScenario(number: number): GameLoopScenario | null {
  return GAME_LOOP_SCENARIOS.find((scenario) => scenario.number === number) ?? null;
}

/** Same budgets as `perf:scene` (docs/PERFORMANCE.md). */
export const GAME_LOOP_BUDGETS_MS = { midRangeAndroid: 16.7, lowEndAndroid: 33 } as const;
/** Frame intervals above this are not frames but pauses (app switch, GC storm); counted, not ranked. */
const MAX_FRAME_INTERVAL_MS = 1000;

export interface FrameSummary {
  readonly frames: number;
  readonly p50FrameIntervalMs: number | null;
  readonly p95FrameIntervalMs: number | null;
  readonly p99FrameIntervalMs: number | null;
  readonly maxFrameIntervalMs: number | null;
  readonly meanDeliveredFps: number | null;
  /** Frames slower than the low-end budget (33 ms, below 30 fps). */
  readonly framesOverLowEndBudget: number;
  readonly pauses: number;
}

/** Collects requestAnimationFrame timestamps (ms) and summarises the intervals between them. */
export class FrameRecorder {
  private readonly intervals: number[] = [];
  private last: number | null = null;
  private pauses = 0;

  push(timestampMs: number): void {
    if (!Number.isFinite(timestampMs)) return;
    if (this.last !== null) {
      const interval = timestampMs - this.last;
      if (interval > MAX_FRAME_INTERVAL_MS) this.pauses++;
      else if (interval > 0) this.intervals.push(interval);
    }
    this.last = timestampMs;
  }

  summarize(): FrameSummary {
    const sorted = this.intervals.slice().sort((a, b) => a - b);
    const at = (share: number): number | null => sorted.length ? round(sorted[Math.ceil(sorted.length * share) - 1]) : null;
    const total = sorted.reduce((sum, value) => sum + value, 0);
    return {
      frames: sorted.length,
      p50FrameIntervalMs: at(0.5),
      p95FrameIntervalMs: at(0.95),
      p99FrameIntervalMs: at(0.99),
      maxFrameIntervalMs: sorted.length ? round(sorted[sorted.length - 1]) : null,
      meanDeliveredFps: total > 0 ? round(sorted.length * 1000 / total) : null,
      framesOverLowEndBudget: sorted.filter((value) => value > GAME_LOOP_BUDGETS_MS.lowEndAndroid).length,
      pauses: this.pauses,
    };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface GameLoopRunFacts {
  readonly week: number;
  readonly passengers: number;
  readonly routes: number;
  readonly commands: number;
  readonly failed: boolean;
}

export interface GameLoopDevice {
  readonly userAgent: string;
  readonly renderer: string;
  readonly viewport: { readonly width: number; readonly height: number; readonly dpr: number };
  /** The Settings choice (auto/saver/low/medium/high) and the preset the renderer runs. */
  readonly graphics: string;
  readonly preset: string | null;
  readonly adaptations: readonly string[];
  readonly appVersion: string;
}

export interface GameLoopReport {
  readonly schema: 1;
  readonly kind: 'game-loop';
  readonly warning: string;
  readonly scenario: number;
  readonly scenarioId: string | null;
  readonly seed: number | null;
  readonly speed: number | null;
  readonly durationRequestedMs: number;
  readonly durationMeasuredMs: number;
  readonly viewport: GameLoopDevice['viewport'];
  readonly browser: { readonly userAgent: string; readonly renderer: string };
  readonly graphics: string;
  readonly preset: string | null;
  readonly adaptations: readonly string[];
  readonly appVersion: string;
  readonly budgetsMs: typeof GAME_LOOP_BUDGETS_MS;
  readonly summary: FrameSummary;
  readonly run: GameLoopRunFacts | null;
  readonly error?: string;
}

/** The result file's JSON: the `perf:scene` frame fields plus the device, the preset path and the run. */
export function gameLoopReport(input: {
  readonly scenarioNumber: number;
  readonly scenario: GameLoopScenario | null;
  readonly measuredMs: number;
  readonly frames: FrameSummary;
  readonly device: GameLoopDevice;
  readonly run: GameLoopRunFacts | null;
  readonly error?: string;
}): GameLoopReport {
  const { scenario, device } = input;
  return {
    schema: 1,
    kind: 'game-loop',
    warning: 'Real game, autoplay bot through real Commands, on a real device. Compare devices, not with SwiftShader.',
    scenario: input.scenarioNumber,
    scenarioId: scenario?.id ?? null,
    seed: scenario?.seed ?? null,
    speed: scenario?.speed ?? null,
    durationRequestedMs: scenario?.durationMs ?? 0,
    durationMeasuredMs: Math.round(input.measuredMs),
    viewport: device.viewport,
    browser: { userAgent: device.userAgent, renderer: device.renderer },
    graphics: device.graphics,
    preset: device.preset,
    adaptations: device.adaptations.slice(),
    appVersion: device.appVersion,
    budgetsMs: GAME_LOOP_BUDGETS_MS,
    summary: input.frames,
    run: input.run,
    ...(input.error ? { error: input.error } : {}),
  };
}

/** One line for logcat / the Test Lab console. */
export function gameLoopLogLine(report: GameLoopReport): string {
  const s = report.summary;
  return 'airway game-loop scenario=' + report.scenario + ' frames=' + s.frames + ' p50=' + s.p50FrameIntervalMs +
    'ms p95=' + s.p95FrameIntervalMs + 'ms preset=' + report.preset + ' adapt=' + report.adaptations.length +
    (report.error ? ' error=' + report.error : '');
}
