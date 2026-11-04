// [night-12aa] Headless replay of the e2e bot plans in e2e/seeds.mjs on the current rules. It drives an
// EndlessRun exactly like the DEV window.aw adapter (src/main.ts autoplayUntil, session.forceOverload, the weekly
// board's card click) with the same bot (src/game/dev/autoplay.ts), so a rule change that ends a suite's run
// before its board fails here, in test:fast, instead of in a browser suite days later.
//
// The browser keeps the clock running between window.aw calls (a card click, waitForScreen, a screenshot), so a
// few real-time ticks pass without bot decisions and shift its 30-tick cadence. A seed is accepted only when the
// plan holds for every idle offset in IDLE_OFFSETS (the same idle ticks after the start and after every card).
import { EndlessRun } from '../../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../../src/game/dev/autoplay.ts';
import { TICKS_PER_WEEK, type UpgradeKind } from '../../src/sim/index.ts';

export type PlanStep =
  | { board: number }
  | { take: 'plain' | 'plane'; strict?: boolean }
  | { find: UpgradeKind; from: number; to: number; take: 'plain' | 'plane' }
  | { offers: number }
  | { overload: true }
  | { ticks: number };

export interface E2ePlan { name: string; steps: readonly PlanStep[] }
export interface PlanResult { ok: boolean; why?: string; week: number; minute: number; trace: string[] }

/** Idle ticks that may pass in the browser between two window.aw calls (10 ticks ≈ 1 s at 1x). */
export const IDLE_OFFSETS = [0, 1, 3, 7, 15, 30, 60] as const;

/** session.advance: step until the sim stops (unanswered board or game over). */
function advance(run: EndlessRun, ticks: number): void {
  for (let i = 0; i < ticks; i++) if (!run.step()) break;
}

/** src/main.ts autoplayUntil. */
function autoplay(run: EndlessRun, untilWeek: number): void {
  for (let guard = 0; guard < 200_000; guard++) {
    if (run.failed) break;
    const offer = run.weeklyUpgrade;
    if (offer && offer.week >= untilWeek && !offer.lastChoice) break;
    const command = nextAutoplayCommand(run.sim);
    if (command) run.queue(command);
    advance(run, AUTOPLAY_ACTION_INTERVAL);
  }
}

/** session.forceOverload. */
function forceOverload(run: EndlessRun): void {
  for (let guard = 0; guard < 400 && !run.failed; guard++) {
    const offer = run.weeklyUpgrade;
    if (offer && !offer.pendingHub) {
      const pick = offer.offers.find((item) => item.id !== 'hub-expansion' && item.id !== 'departure-slots') ?? offer.offers[0];
      if (pick) run.queue({ type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id });
    }
    advance(run, 500);
  }
}

const onBoard = (run: EndlessRun) => !run.failed && !!run.weeklyUpgrade && !run.weeklyUpgrade.lastChoice;

/** The card the suite clicks (index into the board's offers, as the DOM lists them), or -1. */
function cardIndex(run: EndlessRun, take: 'plain' | 'plane'): number {
  const offers = run.weeklyUpgrade?.offers ?? [];
  return take === 'plain'
    ? offers.findIndex((o) => o.id !== 'hub-expansion' && o.id !== 'departure-slots')
    : offers.findIndex((o) => o.id === 'turboprop' || o.id === 'widebody');
}

/** The weekly board's card click (session onCommand: queue, resolve the boundary), then idle ticks. */
function click(run: EndlessRun, index: number, idle: number): string {
  const offer = run.weeklyUpgrade!;
  const card = offer.offers[index]!;
  run.queue({ type: 'ChooseUpgrade', week: offer.week, upgrade: card.id });
  run.resolveBoundary();
  advance(run, idle);
  return card.id;
}

const weekOf = (run: EndlessRun) => run.weeklyUpgrade?.week ?? Math.floor(run.sim.world.minute / TICKS_PER_WEEK) + 1;

/** Replay one plan on one seed with `idle` real-time ticks after the start and after every card. */
export function playPlan(seed: number, plan: E2ePlan, idle = 0): PlanResult {
  const run = EndlessRun.create(seed);
  const trace: string[] = [];
  const result = (ok: boolean, why?: string): PlanResult => ({ ok, why, week: weekOf(run), minute: run.sim.world.minute, trace });
  advance(run, idle);
  for (const step of plan.steps) {
    if ('board' in step) {
      autoplay(run, step.board);
      if (!onBoard(run)) return result(false, `week-${step.board} board not reached (run ${run.failed ? 'over' : 'running'} at minute ${run.sim.world.minute})`);
      trace.push(`board ${run.weeklyUpgrade!.week}: ${run.weeklyUpgrade!.offers.map((o) => o.id).join(',')}`);
    } else if ('find' in step) {
      let found = false;
      for (let week = step.from; week <= step.to && !found; week++) {
        autoplay(run, week);
        if (!onBoard(run)) return result(false, `week-${week} board not reached while looking for ${step.find}`);
        const offers = run.weeklyUpgrade!.offers.map((o) => o.id);
        trace.push(`board ${run.weeklyUpgrade!.week}: ${offers.join(',')}`);
        if (offers.includes(step.find)) found = true;
        else trace.push(`take ${click(run, Math.max(0, cardIndex(run, step.take)), idle)}`);
      }
      if (!found) return result(false, `${step.find} not offered by week ${step.to}`);
    } else if ('take' in step) {
      if (!onBoard(run)) return result(false, 'no board to take a card from');
      const index = cardIndex(run, step.take);
      if (step.strict && index < 0) return result(false, `no ${step.take} card on the week-${run.weeklyUpgrade!.week} board`);
      trace.push(`take ${click(run, Math.max(0, index), idle)}`);
    } else if ('offers' in step) {
      const count = run.weeklyUpgrade?.offers.length ?? 0;
      if (count !== step.offers) return result(false, `board shows ${count} cards, want ${step.offers}`);
    } else if ('overload' in step) {
      forceOverload(run);
      if (!run.failed) return result(false, 'forced overload did not end the run');
      trace.push(`over at ${run.failed.cityId}, minute ${run.sim.world.minute}`);
    } else {
      advance(run, step.ticks);
    }
  }
  return result(true);
}

/** The plan on every idle offset; the first failing offset, or null when it holds for all. */
export function checkPlan(seed: number, plan: E2ePlan): { idle: number; result: PlanResult } | null {
  for (const idle of IDLE_OFFSETS) {
    const result = playPlan(seed, plan, idle);
    if (!result.ok) return { idle, result };
  }
  return null;
}

/**
 * First seed at or after `from` (deterministic order: from, from+1, …) for which every plan holds on every idle
 * offset; `accept` adds suite-specific checks on the idle-0 results.
 */
export function findSeed(plans: readonly E2ePlan[], from: number, limit = 2000,
  accept: (seed: number) => boolean = () => true): number | null {
  for (let seed = from >>> 0, n = 0; n < limit; n++, seed = (seed + 1) >>> 0) {
    if (plans.every((plan) => checkPlan(seed, plan) === null) && accept(seed)) return seed;
  }
  return null;
}
