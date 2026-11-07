// [night-12aa] Headless replay of the e2e bot plans in e2e/seeds.mjs on the current rules. It drives an
// EndlessRun exactly like the DEV window.aw adapter (src/main.ts autoplayUntil, session.forceOverload, the weekly
// board's card click) with the same bot (src/game/dev/autoplay.ts), so a rule change that ends a suite's run
// before its board fails here, in test:fast, instead of in a browser suite days later.
//
// The browser keeps the clock running between window.aw calls (a card click, waitForScreen, a screenshot), so a
// few real-time ticks pass without bot decisions and shift its 30-tick cadence. A seed is accepted only when the
// plan holds for every idle offset in IDLE_OFFSETS (the same idle ticks after the start and after every card).
// [night-12ac] The vocabulary also covers the suites that play the run without a board in mind: play-outs to a
// game over (with the jam on a served or unserved airport), hourly bot play, minute stepping until a transfer is
// connecting or a curfew closes, idle play with no bot, the first airport opening, and the first-time card triggers.
// [night-12ag] `{ gesture: 'route-plane' }` covers smoke and leaderboard, which build their first route and assign an
// aircraft with pointer drags (window.aw.gesture). The browser's routeGesture picks the first pair of on-screen
// airports within turboprop range; which ones are on screen depends on the camera (src/render), so the step is checked
// for every such pair of the start airports (checkPlan), a superset of what any viewport can pick.
// [night-12aj] Plans can run in daily mode (`mode: 'daily'`, the rules of createGame(seed, 'daily')) for the suites
// seeded by a fixed date (daily-share, daily-continue), and `{ gesture: 'route' }` is the route drag alone.
import { EndlessRun, cityDistanceKm } from '../../src/game/run.ts';
import { AUTOPLAY_ACTION_INTERVAL, nextAutoplayCommand } from '../../src/game/dev/autoplay.ts';
import { beyondRange, fillingHub, surgeAnnouncement } from '../../src/game/tutorial/first-time.ts';
import { PLANE_TYPES, TICKS_PER_WEEK, type UpgradeKind } from '../../src/sim/index.ts';

/** Which card a suite clicks: 'plain' = not hub/slots, 'plane' = an aircraft, 'first' = index 0. */
export type Take = 'plain' | 'plane' | 'first';
/** Conditions a suite waits for (`until`) or needs (`expect`). */
/** 'cleared': the airport where `connecting` was first seen has no connecting transfer left. */
export type Until = 'curfew' | 'no-curfew' | 'connecting' | 'cleared';
export type FirstTimeTrigger = 'hub-full' | 'out-of-range' | 'curfew' | 'weekly-board' | 'surge';

export type PlanStep =
  | { board: number; mayEnd?: boolean }
  | { take: Take; strict?: boolean; ifBoard?: boolean }
  | { find: UpgradeKind | readonly UpgradeKind[]; from: number; to: number; take: Take }
  | { offers: number }
  | { overload: true }
  | { ticks: number; alive?: boolean }
  | { playOut: number; take: Take }
  | { drift: number; max: number; take: Take }
  | { jam: 'served' | 'unserved'; spare?: number }
  | { hourly: number; until?: Until; bot?: false }
  | { minutes: number; until: Until; botEvery?: number }
  | { opens: number; chunk: number }
  | { routes: number }
  | { triggers: readonly FirstTimeTrigger[]; ticks: number; every: number; take: Take }
  | { gesture: 'route' | 'route-plane' };

export interface E2ePlan {
  name: string;
  steps: readonly PlanStep[];
  /** [night-12aj] 'daily' = the run the menu's daily button starts (createGame(seed, 'daily')). */
  mode?: 'endless' | 'daily';
}
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
function cardIndex(run: EndlessRun, take: Take): number {
  const offers = run.weeklyUpgrade?.offers ?? [];
  if (take === 'first') return offers.length ? 0 : -1;
  return take === 'plain'
    ? offers.findIndex((o) => o.id !== 'hub-expansion' && o.id !== 'departure-slots')
    : offers.findIndex((o) => o.id === 'turboprop' || o.id === 'widebody');
}

/** window.aw.botStep(): one bot decision, no ticks. */
function botStep(run: EndlessRun): void {
  if (run.failed) return;
  const command = nextAutoplayCommand(run.sim);
  if (command) run.queue(command);
}

/** Whether `until` holds in play (not on a board, not over); 'connecting' remembers the airport in `watch`. */
function holds(run: EndlessRun, until: Until, watch: { city: string | null }): boolean {
  if (run.failed || onBoard(run)) return false;
  const cities = run.cityList();
  switch (until) {
    case 'curfew': return cities.some((city) => city.curfewClosed);
    case 'no-curfew': return !cities.some((city) => city.curfewClosed);
    case 'connecting': {
      const city = cities.find((item) => item.connecting > 0);
      if (city) watch.city = city.id;
      return !!city;
    }
    case 'cleared': return (cities.find((item) => item.id === watch.city)?.connecting ?? 0) === 0;
  }
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

/**
 * [night-12ag] Airport pairs session.routeGesture() can drag between, in its order (city list × city list, lower id
 * first, 0 < distance ≤ the selected aircraft's range — turboprop, the default dock selection), before the on-screen
 * filter that only the browser knows.
 */
export function routeGesturePairs(run: EndlessRun): [string, string][] {
  const ids = run.cityList().map((city) => city.id);
  const pairs: [string, string][] = [];
  for (const a of ids) for (const b of ids) {
    const km = cityDistanceKm(a, b);
    if (a < b && km > 0 && km <= PLANE_TYPES.turboprop.rangeKm) pairs.push([a, b]);
  }
  return pairs;
}

const status = (run: EndlessRun) => (run.failed ? `over at minute ${run.sim.world.minute}` : `running at minute ${run.sim.world.minute}`);

const weekOf = (run: EndlessRun) => run.weeklyUpgrade?.week ?? Math.floor(run.sim.world.minute / TICKS_PER_WEEK) + 1;

/** Replay one plan on one seed with `idle` real-time ticks after the start and after every card. */
export function playPlan(seed: number, plan: E2ePlan, idle = 0, pair = 0): PlanResult {
  const run = EndlessRun.create(seed, plan.mode ?? 'endless');
  const trace: string[] = [];
  const watch: { city: string | null } = { city: null };
  const result = (ok: boolean, why?: string): PlanResult => ({ ok, why, week: weekOf(run), minute: run.sim.world.minute, trace });
  advance(run, idle);
  for (const step of plan.steps) {
    if ('board' in step) {
      autoplay(run, step.board);
      if (!onBoard(run)) {
        if (step.mayEnd && run.failed) { trace.push(`over before the week-${step.board} board`); continue; }
        return result(false, `week-${step.board} board not reached (run ${status(run)})`);
      }
      trace.push(`board ${run.weeklyUpgrade!.week}: ${run.weeklyUpgrade!.offers.map((o) => o.id).join(',')}`);
    } else if ('find' in step) {
      const kinds: readonly UpgradeKind[] = typeof step.find === 'string' ? [step.find] : step.find;
      let found = false;
      for (let week = step.from; week <= step.to && !found; week++) {
        autoplay(run, week);
        if (!onBoard(run)) return result(false, `week-${week} board not reached while looking for ${kinds.join('/')}`);
        const offers = run.weeklyUpgrade!.offers.map((o) => o.id);
        trace.push(`board ${run.weeklyUpgrade!.week}: ${offers.join(',')}`);
        if (offers.some((id) => kinds.includes(id))) found = true;
        else trace.push(`take ${click(run, Math.max(0, cardIndex(run, step.take)), idle)}`);
      }
      if (!found) return result(false, `${kinds.join('/')} not offered by week ${step.to}`);
    } else if ('playOut' in step) {
      // gameover-map / gameover-unserved: autoplay week by week, answering every board, until the run ends.
      for (let week = 1; week <= step.playOut && !run.failed; week++) {
        autoplay(run, week);
        if (onBoard(run)) trace.push(`week ${run.weeklyUpgrade!.week} take ${click(run, Math.max(0, cardIndex(run, step.take)), idle)}`);
      }
      if (!run.failed) return result(false, `run still going after the week-${step.playOut} board`);
      trace.push(`over at ${run.failed.cityId}, minute ${run.sim.world.minute}`);
    } else if ('drift' in step) {
      // No bot: advance in chunks and answer each board until the run jams (gameover-unserved).
      for (let i = 0; i < step.max && !run.failed; i++) {
        if (onBoard(run)) { trace.push(`week ${run.weeklyUpgrade!.week} take ${click(run, Math.max(0, cardIndex(run, step.take)), idle)}`); continue; }
        advance(run, step.drift);
      }
      if (!run.failed) return result(false, `no game over in ${step.max} × ${step.drift} ticks without the bot`);
      trace.push(`over at ${run.failed.cityId}, minute ${run.sim.world.minute}`);
    } else if ('jam' in step) {
      const failure = run.failed;
      if (!failure) return result(false, 'run not over: no jam to check');
      const served = failure.departures.length > 0;
      if (served !== (step.jam === 'served')) return result(false, `jam at ${failure.cityId} is ${served ? 'served' : 'unserved'}, want ${step.jam}`);
      const spare = run.inventory.turboprop + run.inventory.widebody;
      if (step.spare !== undefined && spare !== step.spare) return result(false, `${spare} spare aircraft at the end, want ${step.spare}`);
    } else if ('hourly' in step) {
      // curfew-barrier / pseudo-locale: window.aw.botStep() + advanceTicks(60) per game hour.
      let met = step.until ? holds(run, step.until, watch) : false;
      for (let hour = 0; hour < step.hourly && !met && !run.failed; hour++) {
        if (step.bot !== false) botStep(run);
        advance(run, 60);
        if (step.until) met = holds(run, step.until, watch);
      }
      if (step.until && !met) return result(false, `${step.until} not reached in ${step.hourly} game hours (run ${status(run)})`);
      if (!step.until && run.failed) return result(false, `run over during ${step.hourly} hours of bot play`);
      trace.push(`hourly → minute ${run.sim.world.minute}`);
    } else if ('minutes' in step) {
      // transfer-glyphs: advanceTicks(1) per minute, one bot decision every `botEvery` minutes.
      let met = false;
      for (let minute = 0; minute < step.minutes && !met && !run.failed; minute++) {
        advance(run, 1);
        met = holds(run, step.until, watch);
        if (step.botEvery && minute % step.botEvery === step.botEvery - 1) botStep(run);
      }
      if (!met) return result(false, `${step.until} not reached in ${step.minutes} minutes (run ${status(run)})`);
      trace.push(`${step.until} ${watch.city ?? ''} at minute ${run.sim.world.minute}`);
    } else if ('opens' in step) {
      // new-airport: no bot, advance in chunks until an airport opens.
      const opening = run.cityList().length;
      let ticks = 0;
      while (run.cityList().length === opening) {
        if (ticks >= step.opens || run.failed) return result(false, `no airport opened within ${step.opens} ticks (run ${status(run)})`);
        advance(run, step.chunk);
        ticks += step.chunk;
      }
      trace.push(`airport ${run.cityList().length} opened by tick ${ticks}`);
    } else if ('routes' in step) {
      const count = run.routeList().length;
      if (run.failed || count < step.routes) return result(false, `${count} routes (run ${status(run)}), want at least ${step.routes}`);
    } else if ('triggers' in step) {
      // first-time-cards: bot decision + `every` ticks, answering boards, until every card's trigger has fired.
      const seen = new Set<FirstTimeTrigger>();
      for (let ticks = 0; ticks < step.ticks && !run.failed && step.triggers.some((t) => !seen.has(t)); ticks += step.every) {
        if (onBoard(run)) { click(run, Math.max(0, cardIndex(run, step.take)), idle); seen.add('weekly-board'); continue; }
        botStep(run);
        advance(run, step.every);
        const cities = run.cityList();
        if (fillingHub(cities.map((c) => ({ id: c.id, hub: c.hub, waiting: c.waiting.length, capacity: c.capacity })))) seen.add('hub-full');
        if (cities.some((c) => c.curfewClosed)) seen.add('curfew');
        // [night-35a] D-272: an announced surge on an airport of the run (the session's own trigger).
        if (surgeAnnouncement(run.mode, run.surge, (id) => cities.some((c) => c.id === id))) seen.add('surge');
        for (const event of run.drainEvents()) {
          if (event.type !== 'new-city') continue;
          const ids = run.cityList().map((c) => c.id);
          if (beyondRange(event.cityId, ids, PLANE_TYPES.turboprop.rangeKm, cityDistanceKm) !== null) seen.add('out-of-range');
        }
      }
      const missing = step.triggers.filter((t) => !seen.has(t));
      if (missing.length) return result(false, `first-time triggers never fired: ${missing.join(', ')} (run ${status(run)})`);
      trace.push(`triggers ${[...seen].join(',')} by minute ${run.sim.world.minute}`);
    } else if ('gesture' in step) {
      // smoke / leaderboard: the route drag (RouteTool → AddRoute with the dock's turboprop), then the dock-tag drag
      // onto it (session planeGesture → AssignPlane for the first route whose aircraft is in reserve). The suites
      // wait for routeCount / aircraftAssignments to grow, so at least one tick passes after each drag.
      const pairs = routeGesturePairs(run);
      const target = pairs[pair];
      if (!target) return result(false, `no airport pair ${pair} within turboprop range (${pairs.length} pairs)`);
      const routes = run.routeList().length;
      run.queue({ type: 'AddRoute', cityIds: target, aircraft: 'turboprop' });
      advance(run, Math.max(1, idle));
      if (run.routeList().length !== routes + 1) return result(false, `route ${target.join('–')} not added (run ${status(run)})`);
      if (step.gesture === 'route') { trace.push(`route ${target.join('–')}`); continue; }
      const route = run.routeList().find((item) => run.inventory[item.aircraft] > 0);
      if (!route) return result(false, 'no route with its aircraft type in reserve: the plane drag has no target');
      const assignments = run.assignments;
      run.queue({ type: 'AssignPlane', routeId: route.id, aircraft: route.aircraft });
      advance(run, Math.max(1, idle));
      if (run.assignments !== assignments + 1) return result(false, `aircraft not assigned to ${route.id} (run ${status(run)})`);
      trace.push(`route ${target.join('–')} + ${route.aircraft}`);
    } else if ('take' in step) {
      if (!onBoard(run)) {
        if (step.ifBoard) continue;
        return result(false, 'no board to take a card from');
      }
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
      if (step.alive && run.failed) return result(false, `run over within ${step.ticks} ticks (${status(run)})`);
    }
  }
  return result(true);
}

/** The plan on every idle offset; the first failing offset, or null when it holds for all. */
export function checkPlan(seed: number, plan: E2ePlan): { idle: number; pair?: number; result: PlanResult } | null {
  // [night-12ag] A gesture plan holds only when it holds for every airport pair the route drag could take.
  const gesture = plan.steps.some((step) => 'gesture' in step);
  const pairs = gesture ? Math.max(1, routeGesturePairs(EndlessRun.create(seed, plan.mode ?? 'endless')).length) : 1;
  for (let pair = 0; pair < pairs; pair++) for (const idle of IDLE_OFFSETS) {
    const result = playPlan(seed, plan, idle, pair);
    if (!result.ok) return { idle, ...(gesture ? { pair } : {}), result };
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
