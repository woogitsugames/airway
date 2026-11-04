/**
 * [night-12ad] Paired value of one weekly card at the boards where it was offered. NOT a test (not in test:fast/ci).
 *
 *   node --import ./scripts/ts-test-loader.mjs scripts/research/card-value.ts [--seeds=200] [--cap-min=60]
 *        [--card=hub|slots|turboprop|widebody] [--csv=path] [--slots-rule=held|always]
 *
 * For every seed the DEV bot plays a baseline run (the same loop and cadence as r8-audit / balance:report). Then,
 * for every board of that run that offered `--card` and where the bot took something else, the same seed is
 * replayed with exactly that one board answered with `--card` (the bot's own target airport) and every other
 * decision left to the bot. Both runs are deterministic, so the difference in session length and score is the
 * value of the card at that decision point, under the bot's later play. The decision features (fullest hub's
 * fill share, spare aircraft, airports with no route, the bot's own pick) show where the card would pay.
 *
 * [night-12af] Offer counts (boards, boards with the card, bot picks, runs with an offer) are printed for every card,
 * plus, for "+2 slots", when the run's first departure hold came (the D-150 eligibility rule). `--slots-rule=always`
 * is a what-if of the pre-D-150 pool for "+2 slots" only: the world is told at start that a hold already happened, so
 * the card is eligible from week 1. It pokes the World's private `slotEverHeld` flag of this research process only;
 * no game rule changes (D-113). The draw makes the same number of RNG calls either way, so the streams stay aligned.
 */
import { writeFileSync } from 'node:fs';
import { createBalanceSession } from '../balance-game-adapter.ts';
import { chooseBotAction, type BotSnapshot, type UpgradeKind } from '../bot.ts';
import { SIM_TICKS_PER_SECOND } from '../../src/sim/params.ts';

const arg = (name: string, fallback: string): string =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const SEEDS = Number(arg('seeds', '200'));
const CAP_TICKS = Number(arg('cap-min', '60')) * 60 * SIM_TICKS_PER_SECOND;
const CARD = arg('card', 'hub') as UpgradeKind;
const CSV = arg('csv', '');
const BASE_SEED = 0xa1a1;
const ACTION_INTERVAL = 30;

interface Board { index: number; offers: UpgradeKind[]; pick: UpgradeKind; fill: number; spare: number; unserved: number; hubs: number }
interface Outcome { minutes: number; score: number; boards: Board[]; lostAtHub: boolean; firstHoldMinute: number | null; boardsBeforeHold: number }
const SLOTS_RULE = arg('slots-rule', 'held');
if (SLOTS_RULE !== 'held' && SLOTS_RULE !== 'always') throw new Error('--slots-rule=held|always');
/** Research-only view of the World's private D-150 flag ("a departure was held in this run"). */
type HoldFlag = { slotEverHeld: boolean };

function features(snap: BotSnapshot): Pick<Board, 'fill' | 'spare' | 'unserved' | 'hubs'> {
  const hubs = snap.cities.filter((c) => c.active && c.isHub);
  return {
    fill: Math.max(0, ...hubs.map((c) => (c.capacity > 0 ? c.waiting / c.capacity : 0))),
    spare: snap.inventory.turboprop + snap.inventory.widebody,
    unserved: snap.cities.filter((c) => c.active && c.connectedRoutes === 0).length,
    hubs: hubs.length,
  };
}

/** Play one seed; `force` = the board index (0-based) answered with CARD. */
function play(seed: number, force = -1): Outcome {
  const session = createBalanceSession(seed);
  const sim = session.simulation;
  if (SLOTS_RULE === 'always') (sim.world as unknown as HoldFlag).slotEverHeld = true;
  const boards: Board[] = [];
  let firstHoldMinute: number | null = null;
  let boardsBeforeHold = 0;
  for (let i = 0; i <= CAP_TICKS / ACTION_INTERVAL; i++) {
    const snap = session.snapshot();
    if (firstHoldMinute === null && SLOTS_RULE === 'held' && (sim.world as unknown as HoldFlag).slotEverHeld) {
      firstHoldMinute = sim.world.minute;
      boardsBeforeHold = boards.length;
    }
    if (snap.status === 'finished' || snap.tick >= CAP_TICKS) break;
    let view: BotSnapshot = snap;
    const boardIndex = boards.length;
    if (snap.status === 'upgrade' && boardIndex === force) {
      const only = snap.offers.filter((o) => o.kind === CARD);
      if (only.length) view = { ...snap, offers: only };
    }
    const decision = chooseBotAction(view);
    if (decision) {
      if (decision.command.type === 'ChooseUpgrade') {
        const offerId = decision.command.offerId;
        boards.push({ index: boardIndex, offers: snap.offers.map((o) => o.kind), pick: snap.offers.find((o) => o.id === offerId)?.kind ?? CARD, ...features(snap) });
      }
      session.dispatch(decision.command);
    }
    session.advance(Math.min(ACTION_INTERVAL, CAP_TICKS - snap.tick));
  }
  const world = sim.world;
  const fail = world.status === 'over' ? world.failure : null;
  return {
    minutes: world.minute / (SIM_TICKS_PER_SECOND * 60), score: world.score, boards,
    lostAtHub: fail ? world.cityView(fail.cityId).isHub : false,
    firstHoldMinute, boardsBeforeHold: firstHoldMinute === null ? boards.length : boardsBeforeHold,
  };
}

interface Pair extends Board { seed: number; dMinutes: number; dScore: number; baseMinutes: number; hubLossBase: boolean; hubLossForced: boolean }
const pairs: Pair[] = [];
let baseMinutes = 0;
let baseScore = 0;
const offerCounts = { boards: 0, offered: 0, picked: 0, runsOffered: 0, runsPicked: 0 };
const holds: Array<number | null> = [];
let boardsBeforeHold = 0;
for (let n = 0; n < SEEDS; n++) {
  const seed = (BASE_SEED + n) >>> 0;
  const base = play(seed);
  baseMinutes += base.minutes;
  baseScore += base.score;
  offerCounts.boards += base.boards.length;
  offerCounts.offered += base.boards.filter((b) => b.offers.includes(CARD)).length;
  offerCounts.picked += base.boards.filter((b) => b.pick === CARD).length;
  if (base.boards.some((b) => b.offers.includes(CARD))) offerCounts.runsOffered++;
  if (base.boards.some((b) => b.pick === CARD)) offerCounts.runsPicked++;
  holds.push(base.firstHoldMinute);
  boardsBeforeHold += base.boardsBeforeHold;
  for (const board of base.boards) {
    if (!board.offers.includes(CARD) || board.pick === CARD) continue;
    const forced = play(seed, board.index);
    pairs.push({ ...board, seed, dMinutes: forced.minutes - base.minutes, dScore: forced.score - base.score,
      baseMinutes: base.minutes, hubLossBase: base.lostAtHub, hubLossForced: forced.lostAtHub });
  }
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[], q: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b); const m = (s.length - 1) / 2;
  return (s[Math.floor(m)]! + s[Math.ceil(m)]!) / 2;
};
function row(label: string, set: Pair[]): string {
  const better = set.filter((p) => p.dMinutes > 0.05).length;
  const worse = set.filter((p) => p.dMinutes < -0.05).length;
  return `| ${label} | ${set.length} | ${mean(set.map((p) => p.dMinutes)).toFixed(2)} | ${median(set.map((p) => p.dMinutes)).toFixed(2)} | ` +
    `${mean(set.map((p) => p.dScore)).toFixed(1)} | ${better} | ${worse} | ${set.length - better - worse} |`;
}
console.log(`card-value card=${CARD} seeds=${SEEDS} cap=${CAP_TICKS / 600} min slots-rule=${SLOTS_RULE}, baseline mean ` +
  `${(baseMinutes / SEEDS).toFixed(2)} min, score ${(baseScore / SEEDS).toFixed(1)}`);
console.log(`offers: ${offerCounts.offered} of ${offerCounts.boards} boards (${offerCounts.runsOffered} of ${SEEDS} runs), ` +
  `bot took it ${offerCounts.picked}× (${offerCounts.runsPicked} runs)`);
if (SLOTS_RULE === 'held') {
  const held = holds.filter((m): m is number => m !== null).map((m) => m / (SIM_TICKS_PER_SECOND * 60));
  console.log(`first departure hold: ${held.length} of ${SEEDS} runs, at session minute median ${median(held).toFixed(2)} ` +
    `(p10 ${pct(held, 0.1).toFixed(2)}, p90 ${pct(held, 0.9).toFixed(2)}); boards before it ${boardsBeforeHold} of ${offerCounts.boards}`);
}
console.log('| Boards where the bot skipped the card | n | Δ min mean | Δ min median | Δ score mean | longer | shorter | same |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
console.log(row('all', pairs));
for (const b of [0, 1, 2]) console.log(row(`board ${b + 1}`, pairs.filter((p) => p.index === b)));
console.log(row('board 4+', pairs.filter((p) => p.index >= 3)));
console.log(row('fullest hub < 50 %', pairs.filter((p) => p.fill < 0.5)));
console.log(row('fullest hub 50–70 %', pairs.filter((p) => p.fill >= 0.5 && p.fill < 0.7)));
console.log(row('fullest hub ≥ 70 %', pairs.filter((p) => p.fill >= 0.7)));
console.log(row('no airport without a route', pairs.filter((p) => p.unserved === 0)));
console.log(row('≥ 1 airport without a route', pairs.filter((p) => p.unserved > 0)));
console.log(row('bot took turboprop', pairs.filter((p) => p.pick === 'turboprop')));
console.log(row('bot took widebody', pairs.filter((p) => p.pick === 'widebody')));
console.log(row('baseline lost at a hub', pairs.filter((p) => p.hubLossBase)));
console.log(`hub losses: baseline ${pairs.filter((p) => p.hubLossBase).length}, forced ${pairs.filter((p) => p.hubLossForced).length} of ${pairs.length}`);
if (CSV) {
  writeFileSync(CSV, ['seed,board,pick,fill,spare,unserved,hubs,base_minutes,d_minutes,d_score,hub_loss_base,hub_loss_forced',
    ...pairs.map((p) => [p.seed, p.index + 1, p.pick, p.fill.toFixed(3), p.spare, p.unserved, p.hubs, p.baseMinutes.toFixed(2),
      p.dMinutes.toFixed(2), p.dScore, p.hubLossBase ? 1 : 0, p.hubLossForced ? 1 : 0].join(','))].join('\n') + '\n');
  console.log(`csv ${CSV}`);
}
