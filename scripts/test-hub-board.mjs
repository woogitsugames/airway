// [night-11ag] R4d: the hub cause board's rolling view (last game hour per airport) and its one-cause-per-row rule,
// without a DOM: fake read models for each cause, then a real EndlessRun driven into a jam to show the view reads the
// run and never changes its hash (D-13). Fails on the code before R4d: src/game/hubBoard.ts did not exist.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { HubDepartureLog, boardOpensOnTap, BOARD_WINDOW_MINUTES, HUB_BOARD_CAUSE_KEYS } = await import('../src/game/hubBoard.ts');
const { EndlessRun } = await import('../src/game/run.ts');
const { en } = await import('../src/i18n/en.ts');
const { pl } = await import('../src/i18n/pl.ts');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}

const REGION = { FRA: 'EUN', NYC: 'NAM', MAD: 'EUS', DXB: 'ME' };
const city = (id, waiting = [], extra = {}) => ({
  id, region: REGION[id], waiting, connecting: 0, capacity: 12, hub: false, jamTicksLeft: null, slotHeld: 0,
  nextSlotMinutes: 0, curfewClosed: false, lon: 0, lat: 0, ...extra,
});
const waitingAtFra = ['NAM', 'NAM', 'NAM', 'EUS', 'EUS', 'ME'];
function fake(minute, { routes = [['r1', 'FRA', 'NYC']], planes = [], fra = {} } = {}) {
  return {
    clockMinute: minute,
    cityList: () => [city('FRA', waitingAtFra, fra), city('NYC'), city('MAD'), city('DXB')],
    routeList: () => routes.map(([id, ...cityIds]) => ({ id, cityIds, aircraft: 'turboprop' })),
    planeList: () => planes,
  };
}
const plane = (phase, cityIndex, load, extra = {}) => ({
  id: 'p1', routeId: 'r1', type: 'turboprop', segment: 0, progress01: 0, direction: 1, load, capacity: 20, phase,
  cityIndex, slotWaitTicks: 0, ...extra,
});
const causes = (model) => Object.fromEntries(model.rows.map((row) => [row.region, row.cause]));

check('tap opens the board from 70 % full; never without capacity', () => {
  assert.equal(boardOpensOnTap(9, 12), true); // 75 %
  assert.equal(boardOpensOnTap(8, 12), false); // 67 %
  assert.equal(boardOpensOnTap(7, 10), true);
  assert.equal(boardOpensOnTap(12, 12), true);
  assert.equal(boardOpensOnTap(3, 0), false);
});

check('window is one game hour', () => assert.equal(BOARD_WINDOW_MINUTES, 60));

check('one row per waiting region, most waiting first, counts add up', () => {
  const log = new HubDepartureLog();
  const model = log.board(fake(100), 'FRA');
  assert.deepEqual(model.rows.map((row) => [row.region, row.waiting]), [['NAM', 3], ['EUS', 2], ['ME', 1]]);
  assert.equal(model.waiting, 6);
  assert.equal(model.capacity, 12);
  assert.equal(log.board(fake(100), 'XXX'), null);
  assert.deepEqual(log.board(fake(100), 'NYC').rows, []);
});

check('no onward flight: a region the network cannot reach; a reachable one with nothing recorded is "none"', () => {
  const model = new HubDepartureLog().board(fake(100), 'FRA');
  assert.deepEqual(causes(model), { NAM: 'none', EUS: 'no-route', ME: 'no-route' });
  const more = new HubDepartureLog().board(fake(100, { routes: [['r1', 'FRA', 'NYC'], ['r2', 'MAD', 'FRA', 'DXB']] }), 'FRA');
  assert.deepEqual(causes(more), { NAM: 'none', EUS: 'none', ME: 'none' });
});

check('curfew: every reachable row of a closed airport; no route still wins', () => {
  const model = new HubDepartureLog().board(fake(100, { fra: { curfewClosed: true } }), 'FRA');
  assert.deepEqual(causes(model), { NAM: 'curfew', EUS: 'no-route', ME: 'no-route' });
});

check('left full: a departure seen without a free seat marks its leg for one game hour', () => {
  const log = new HubDepartureLog();
  log.observe(fake(100, { planes: [plane('ground', 0, 0)] }));
  log.observe(fake(101, { planes: [plane('flight', 0, 20)] })); // took off full towards NYC
  assert.equal(causes(log.board(fake(101), 'FRA')).NAM, 'left-full');
  log.observe(fake(160, { planes: [plane('flight', 0, 20)] })); // same flight, no new departure
  assert.equal(causes(log.board(fake(160), 'FRA')).NAM, 'left-full', 'still inside the hour (59 min)');
  log.observe(fake(161, { planes: [plane('flight', 0, 20)] }));
  assert.equal(causes(log.board(fake(161), 'FRA')).NAM, 'none', 'out of the window after 60 min');
});

check('left full: the latest departure counts (spare seats clear the mark); the other direction does not', () => {
  const log = new HubDepartureLog();
  log.observe(fake(100, { planes: [plane('ground', 0, 0)] }));
  log.observe(fake(101, { planes: [plane('flight', 0, 20)] }));
  log.observe(fake(120, { planes: [plane('ground', 1, 0, { direction: -1 })] }));
  log.observe(fake(125, { planes: [plane('flight', 1, 20, { direction: -1 })] })); // NYC → FRA full: not a FRA departure
  assert.equal(causes(log.board(fake(125), 'FRA')).NAM, 'left-full');
  log.observe(fake(140, { planes: [plane('ground', 0, 0)] }));
  log.observe(fake(141, { planes: [plane('flight', 0, 12)] })); // FRA → NYC with 8 seats free
  assert.equal(causes(log.board(fake(141), 'FRA')).NAM, 'none');
  const first = new HubDepartureLog(); // a plane first seen in flight has no known departure
  first.observe(fake(100, { planes: [plane('flight', 0, 20)] }));
  assert.equal(causes(first.board(fake(100), 'FRA')).NAM, 'none');
});

check('slot: aircraft-minutes held on the ground for this leg in the last hour', () => {
  const log = new HubDepartureLog();
  log.observe(fake(100, { planes: [plane('ground', 0, 0)] }));
  log.observe(fake(110, { planes: [plane('ground', 0, 0, { slotWaitTicks: 7 })] }));
  log.observe(fake(115, { planes: [plane('ground', 0, 0, { slotWaitTicks: 12 })] }));
  const model = log.board(fake(115), 'FRA');
  const nam = model.rows.find((row) => row.region === 'NAM');
  assert.equal(nam.cause, 'slot');
  assert.equal(nam.minutes, 12);
  assert.equal(model.rows.find((row) => row.region === 'EUS').minutes, 0);
  log.observe(fake(176, { planes: [plane('ground', 0, 0)] }));
  assert.equal(causes(log.board(fake(176), 'FRA')).NAM, 'none', 'slot holds older than an hour drop out');
});

check('left full outranks a slot hold; the clock going back (undo) starts the view over', () => {
  const log = new HubDepartureLog();
  log.observe(fake(100, { planes: [plane('ground', 0, 0)] }));
  log.observe(fake(105, { planes: [plane('ground', 0, 0, { slotWaitTicks: 5 })] }));
  log.observe(fake(106, { planes: [plane('flight', 0, 20)] }));
  assert.equal(causes(log.board(fake(106), 'FRA')).NAM, 'left-full');
  log.observe(fake(90, { planes: [plane('flight', 0, 20)] }));
  assert.equal(causes(log.board(fake(90), 'FRA')).NAM, 'none');
});

check('every mark has its sentence in EN and PL; three are the game-over cause strings', () => {
  assert.equal(HUB_BOARD_CAUSE_KEYS['no-route'], 'gameover.cause.noRoute');
  assert.equal(HUB_BOARD_CAUSE_KEYS['left-full'], 'gameover.cause.seatShortage');
  assert.equal(HUB_BOARD_CAUSE_KEYS.slot, 'gameover.cause.slotWait');
  for (const key of Object.values(HUB_BOARD_CAUSE_KEYS)) {
    assert.ok(en[key] && pl[key], `missing ${key}`);
  }
});

check('real run: a forced jam (no routes) gives one no-route row per waiting region, and the hash is untouched', () => {
  const run = EndlessRun.create(0xA1A1);
  const log = new HubDepartureLog();
  let jammed = null;
  for (let tick = 0; tick < 20000 && !jammed && !run.failed; tick++) {
    if (!run.step()) {
      const offer = run.weeklyUpgrade;
      const pick = offer?.offers.find((item) => item.id !== 'hub-expansion' && item.id !== 'departure-slots');
      if (!offer || !pick) break;
      run.queue({ type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id });
      continue;
    }
    if (tick % 7 === 0) log.observe(run);
    jammed = run.cityList().find((item) => item.jamTicksLeft !== null) ?? null;
  }
  assert.ok(jammed, 'no airport jammed');
  const before = run.hash();
  log.observe(run);
  const model = log.board(run, jammed.id);
  assert.equal(run.hash(), before, 'the board changed the sim hash');
  assert.equal(model.jammed, true);
  assert.ok(boardOpensOnTap(model.waiting, model.capacity));
  assert.equal(model.rows.reduce((sum, row) => sum + row.waiting, 0), jammed.waiting.length);
  assert.equal(new Set(model.rows.map((row) => row.region)).size, model.rows.length);
  assert.ok(model.rows.every((row) => row.cause === 'no-route'), JSON.stringify(model.rows));
  console.log(`  jam at ${jammed.id} minute ${run.clockMinute}: ${model.rows.map((row) => row.region + '×' + row.waiting).join(' ')}`);
});

console.log(`SUMMARY test:hub-board seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
