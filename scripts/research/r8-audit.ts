/**
 * [research R8] Read-only gameplay-depth audit on the real Sim (rules v5). NOT a test, NOT part of test:fast/ci.
 *
 *   node --import ./scripts/ts-test-loader.mjs scripts/research/r8-audit.ts [--seeds=200] [--cap-min=60]
 *        [--policy=bot|turboprop|widebody|hub|slots|all] [--csv=path]
 *
 * Plays the DEV bot (src/game/dev/bot-policy.ts) through scripts/balance-game-adapter.ts, same cadence as
 * `npm run balance:report` (one decision every 30 ticks), but with a longer cap so the session tail is visible.
 * `--policy=<kind>` makes the bot take that weekly card whenever it is offered (else its normal choice), to
 * measure the win-rate impact of each upgrade. Instrumentation only wraps prototype methods of this process
 * (passenger alight, curfew gate) to count events; it never changes their result or any game parameter.
 */
import { writeFileSync } from 'node:fs';
import { createBalanceSession } from '../balance-game-adapter.ts';
import { chooseBotAction, type BotSnapshot, type UpgradeKind } from '../bot.ts';
import { PassengerSimulation } from '../../src/sim/passengers.ts';
import { CurfewPlanner } from '../../src/sim/daynight.ts';
import { buildCauseReport } from '../../src/game/causes.ts';
import { SIM_MINUTES_PER_WEEK, SIM_TICKS_PER_SECOND, CURFEW_ENDLESS_START_WEEK } from '../../src/sim/params.ts';

const arg = (name: string, fallback: string): string =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SEEDS = Number(arg('seeds', '200'));
const CAP_TICKS = Number(arg('cap-min', '60')) * 60 * SIM_TICKS_PER_SECOND;
const POLICY = arg('policy', 'bot');
const CSV = arg('csv', '');
const BASE_SEED = 0xa1a1;
const ACTION_INTERVAL = 30;
let currentPolicy = POLICY;

// ---- instrumentation (counts only; original results are returned unchanged) ----
const counters = { delivered: 0, deliveredWithTransfer: 0, transfers: 0, curfewGround: 0, curfewAir: 0 };
let transferred = new Set<number>();
const origAlight = PassengerSimulation.prototype.alightAt;
PassengerSimulation.prototype.alightAt = function (this: PassengerSimulation, ...args: Parameters<typeof origAlight>) {
  const result = origAlight.apply(this, args);
  counters.transfers += result.transferred.length;
  for (const id of result.transferred) transferred.add(id);
  counters.delivered += result.delivered.length;
  for (const id of result.delivered) if (transferred.has(id)) { counters.deliveredWithTransfer++; transferred.delete(id); }
  return result;
};
const origSchedule = CurfewPlanner.prototype.canScheduleLeg;
CurfewPlanner.prototype.canScheduleLeg = function (this: CurfewPlanner, ...args: Parameters<typeof origSchedule>) {
  const ok = origSchedule.apply(this, args);
  if (!ok) counters.curfewGround++;
  return ok;
};
const origLand = CurfewPlanner.prototype.canLand;
CurfewPlanner.prototype.canLand = function (this: CurfewPlanner, ...args: Parameters<typeof origLand>) {
  const ok = origLand.apply(this, args);
  if (!ok) counters.curfewAir++;
  return ok;
};

const BOT_TO_KIND: Record<string, UpgradeKind> = { turboprop: 'turboprop', widebody: 'widebody', hub: 'hub', slots: 'slots' };

interface Run {
  seed: number; minutes: number; weeks: number; lossWeek: number; censored: boolean; score: number;
  failCity: string; failIsHub: boolean; failRoutes: number; failCapacity: number; failTopCause: string;
  failLeadPct: number; picks: string[]; offers: string[][]; slotHeldRuns: boolean; slotWaitMin: number;
  curfewWeeks: boolean; curfewGround: number; curfewAir: number; transfers: number; delivered: number;
  deliveredWithTransfer: number; maxPlanes: number; routes: number; cities: number; hubs: number;
  failAgeMin: number; reserveAtEnd: number; unservedAtEnd: number;
}

function play(seed: number): Run {
  for (const key of Object.keys(counters) as (keyof typeof counters)[]) counters[key] = 0;
  transferred = new Set();
  const session = createBalanceSession(seed);
  const sim = session.simulation;
  const picks: string[] = [];
  const offers: string[][] = [];
  let slotHeld = false;
  const openedAt = new Map<string, number>();
  for (let i = 0; i <= CAP_TICKS / ACTION_INTERVAL; i++) {
    const snap = session.snapshot();
    for (const c of snap.cities) if (!openedAt.has(c.id)) openedAt.set(c.id, snap.tick);
    if (snap.status === 'finished' || snap.tick >= CAP_TICKS) break;
    let view: BotSnapshot = snap;
    if (snap.status === 'upgrade' && currentPolicy !== 'bot') {
      const preferred = snap.offers.filter((o) => o.kind === BOT_TO_KIND[currentPolicy]);
      if (preferred.length) view = { ...snap, offers: preferred };
    }
    const decision = chooseBotAction(view);
    if (decision) {
      if (decision.command.type === 'ChooseUpgrade') {
        offers.push(snap.offers.map((o) => o.kind).sort());
        picks.push(snap.offers.find((o) => o.id === (decision.command as { offerId: string }).offerId)?.kind ?? '?');
      }
      session.dispatch(decision.command);
    }
    session.advance(Math.min(ACTION_INTERVAL, CAP_TICKS - snap.tick));
  }
  const world = sim.world;
  const cities = world.cities();
  const slotWait = cities.reduce((sum, c) => sum + world.hubCauseLedger(c.id).slotWaitMinutes, 0);
  slotHeld = slotWait > 0;
  const fail = world.status === 'over' ? world.failure : null;
  const failView = fail ? world.cityView(fail.cityId) : null;
  const top = fail ? buildCauseReport(world.hubCauseLedger(fail.cityId))[0]?.kind ?? 'none' : '';
  return {
    seed, minutes: world.minute / (SIM_TICKS_PER_SECOND * 60), weeks: world.minute / SIM_MINUTES_PER_WEEK,
    lossWeek: Math.floor(world.minute / SIM_MINUTES_PER_WEEK) + 1, censored: !fail, score: world.score,
    failCity: fail?.cityId ?? '', failIsHub: failView?.isHub ?? false, failRoutes: failView?.routes ?? 0,
    failCapacity: fail?.capacity ?? 0, failTopCause: top, failLeadPct: fail?.leadingRegionPercent ?? 0,
    picks, offers, slotHeldRuns: slotHeld, slotWaitMin: slotWait,
    curfewWeeks: world.minute >= (CURFEW_ENDLESS_START_WEEK - 1) * SIM_MINUTES_PER_WEEK,
    curfewGround: counters.curfewGround, curfewAir: counters.curfewAir, transfers: counters.transfers,
    delivered: counters.delivered, deliveredWithTransfer: counters.deliveredWithTransfer,
    maxPlanes: world.planes.length, routes: world.routes().length, cities: cities.length,
    hubs: cities.filter((c) => c.isHub).length,
    failAgeMin: fail ? (world.minute - (openedAt.get(fail.cityId) ?? world.minute)) : 0,
    reserveAtEnd: world.reserve.turboprop + world.reserve.widebody,
    unservedAtEnd: cities.filter((c) => c.routes === 0).length,
  };
}

const pct = (n: number, d: number): string => d ? `${Math.round((100 * n) / d)}%` : '—';
function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q; const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function summarise(policy: string, runs: Run[]): void {
  const m = runs.map((r) => r.minutes);
  const lost = runs.filter((r) => !r.censored);
  console.log(`\n=== policy=${policy} seeds=${runs.length} cap=${CAP_TICKS / 600} min ===`);
  console.log(`minutes p10=${quantile(m, 0.1).toFixed(1)} p25=${quantile(m, 0.25).toFixed(1)} p50=${quantile(m, 0.5).toFixed(2)} ` +
    `p75=${quantile(m, 0.75).toFixed(1)} p90=${quantile(m, 0.9).toFixed(1)} min=${Math.min(...m).toFixed(1)} max=${Math.max(...m).toFixed(1)} ` +
    `mean=${(m.reduce((a, b) => a + b, 0) / m.length).toFixed(2)} censored=${runs.length - lost.length}`);
  const byWeek = new Map<number, Run[]>();
  for (const r of lost) byWeek.set(r.lossWeek, [...(byWeek.get(r.lossWeek) ?? []), r]);
  console.log('loss week | n | hub | unserved(0 routes) | top cause');
  for (const w of [...byWeek.keys()].sort((a, b) => a - b)) {
    const list = byWeek.get(w)!;
    const causes = new Map<string, number>();
    for (const r of list) causes.set(r.failTopCause, (causes.get(r.failTopCause) ?? 0) + 1);
    console.log(`W${w} | ${list.length} | ${list.filter((r) => r.failIsHub).length} | ${list.filter((r) => r.failRoutes === 0).length} | ` +
      [...causes].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
  }
  const causeAll = new Map<string, number>();
  for (const r of lost) causeAll.set(r.failTopCause, (causeAll.get(r.failTopCause) ?? 0) + 1);
  console.log('top causes all: ' + [...causeAll].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v} (${pct(v, lost.length)})`).join(' '));
  console.log(`fail at hub ${pct(lost.filter((r) => r.failIsHub).length, lost.length)}; fail routes: ` +
    [0, 1, 2, 3].map((k) => `${k}${k === 3 ? '+' : ''}=${lost.filter((r) => (k === 3 ? r.failRoutes >= 3 : r.failRoutes === k)).length}`).join(' ') +
    `; leading region ≥50% in ${pct(lost.filter((r) => r.failLeadPct >= 50).length, lost.length)}`);
  const unserved = lost.filter((r) => r.failRoutes === 0);
  console.log(`unserved-airport losses: ${unserved.length}/${lost.length}; their airport age (game min) p50=${quantile(unserved.map((r) => r.failAgeMin), 0.5)} ` +
    `p10=${quantile(unserved.map((r) => r.failAgeMin), 0.1)}; spare aircraft at loss p50=${quantile(lost.map((r) => r.reserveAtEnd), 0.5)} ` +
    `(0 spare in ${pct(lost.filter((r) => r.reserveAtEnd === 0).length, lost.length)}); unserved airports at loss p50=${quantile(lost.map((r) => r.unservedAtEnd), 0.5)} p90=${quantile(lost.map((r) => r.unservedAtEnd), 0.9)}`);
  // Upgrades
  const offered = new Map<string, number>(); const picked = new Map<string, number>();
  const pickByWeek = new Map<number, Map<string, number>>();
  for (const r of runs) {
    r.offers.forEach((o, i) => {
      for (const k of o) offered.set(k, (offered.get(k) ?? 0) + 1);
      const k = r.picks[i]; picked.set(k, (picked.get(k) ?? 0) + 1);
      const wk = pickByWeek.get(i + 1) ?? new Map(); wk.set(k, (wk.get(k) ?? 0) + 1); pickByWeek.set(i + 1, wk);
    });
  }
  console.log('upgrade | offered | picked | pick rate when offered');
  for (const k of ['turboprop', 'widebody', 'hub', 'slots']) {
    console.log(`${k} | ${offered.get(k) ?? 0} | ${picked.get(k) ?? 0} | ${pct(picked.get(k) ?? 0, offered.get(k) ?? 0)}`);
  }
  for (const [w, map] of [...pickByWeek].sort((a, b) => a[0] - b[0])) {
    console.log(`board ${w}: ` + [...map].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
  }
  // Reached boards
  console.log('reached board N: ' + [1, 2, 3, 4, 5, 6].map((n) => `${n}=${pct(runs.filter((r) => r.picks.length >= n).length, runs.length)}`).join(' '));
  // Mechanics
  const cw = runs.filter((r) => r.curfewWeeks);
  console.log(`curfew weeks reached (≥ week ${CURFEW_ENDLESS_START_WEEK}): ${cw.length}/${runs.length} (${pct(cw.length, runs.length)}); ` +
    `of those with any curfew hold: ${cw.filter((r) => r.curfewGround + r.curfewAir > 0).length}; ` +
    `median curfew aircraft-min ground ${quantile(cw.map((r) => r.curfewGround), 0.5) || 0} air ${quantile(cw.map((r) => r.curfewAir), 0.5) || 0}`);
  console.log(`slot hold in ${runs.filter((r) => r.slotHeldRuns).length}/${runs.length} runs; slot-wait aircraft-min p50=${quantile(runs.map((r) => r.slotWaitMin), 0.5)} ` +
    `p90=${quantile(runs.map((r) => r.slotWaitMin), 0.9)} max=${Math.max(...runs.map((r) => r.slotWaitMin))}`);
  const del = runs.reduce((a, r) => a + r.delivered, 0); const dwt = runs.reduce((a, r) => a + r.deliveredWithTransfer, 0);
  console.log(`delivered=${del} with ≥1 transfer=${dwt} (${pct(dwt, del)}); runs with any transfer delivery ${runs.filter((r) => r.deliveredWithTransfer > 0).length}/${runs.length}; ` +
    `per-run transfer share p50=${(quantile(runs.map((r) => r.delivered ? r.deliveredWithTransfer / r.delivered : 0), 0.5) * 100).toFixed(0)}%`);
  console.log(`end network: cities p50=${quantile(runs.map((r) => r.cities), 0.5)} routes p50=${quantile(runs.map((r) => r.routes), 0.5)} ` +
    `hubs p50=${quantile(runs.map((r) => r.hubs), 0.5)} planes p50=${quantile(runs.map((r) => r.maxPlanes), 0.5)} score p50=${quantile(runs.map((r) => r.score), 0.5)}`);
}

const policies = POLICY === 'all' ? ['bot', 'turboprop', 'widebody', 'hub', 'slots'] : [POLICY];
const rows: string[] = ['policy,seed,minutes,weeks,censored,score,fail_city,fail_is_hub,fail_routes,fail_top_cause,picks,slot_wait_min,curfew_ground,curfew_air,delivered,delivered_with_transfer,cities,routes,hubs,planes,fail_age_min,reserve_at_end,unserved_at_end'];
for (const policy of policies) {
  const runs: Run[] = [];
  for (let i = 0; i < SEEDS; i++) {
    currentPolicy = policy;
    runs.push(play(BASE_SEED + i));
  }
  summarise(policy, runs);
  for (const r of runs) rows.push([policy, r.seed, r.minutes.toFixed(2), r.weeks.toFixed(2), r.censored ? 1 : 0, r.score, r.failCity,
    r.failIsHub ? 1 : 0, r.failRoutes, r.failTopCause, r.picks.join('|'), r.slotWaitMin, r.curfewGround, r.curfewAir, r.delivered,
    r.deliveredWithTransfer, r.cities, r.routes, r.hubs, r.maxPlanes, r.failAgeMin, r.reserveAtEnd, r.unservedAtEnd].join(','));
}
if (CSV) writeFileSync(CSV, rows.join('\n') + '\n');

