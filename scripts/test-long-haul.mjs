// [ext-02/ext-04] R6h, D-131/D-162…D-165: the puzzle pack "Long haul" (31–40). The pack is registered from 31 with
// ten levels, PL/EN titles and the board header with correct plurals; the curve is steeper than 26–30 (every margin
// at least 15 % and below the smallest margin of 26–30) and 36–40 offer more than 31–35; 36–40 each build on at least
// two newer mechanic tags; the reference network clears the goal in any order of its strips (ext-04, D-164: puzzle 35
// jammed in some orders; the 15 % margin is the reference order's); each level's tempting decoy network loses on the
// real Sim. Fixed seed 0xA1A1 (levels carry their own seeds).
let checked = 0;
let passed = 0;
const failures = [];
async function check(name, fn) {
  checked++;
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
const jet = (from, to) => ({ type: 'connect', from, to, plane: 'jet' });
const prop = (from, to) => ({ type: 'connect', from, to, plane: 'turboprop' });
const up = (city) => ({ type: 'upgradeHub', city });
const FIRST = 31;
const LAST = 40;
const ORDERS = 8; // deterministic shuffles of the reference strips per level
/** The idea a player is likely to try first; each must lose (jam, or the goal not met). */
const DECOYS = {
  '31': ['the shorter ocean leg from Suva', [prop('AKL', 'SYD'), prop('AKL', 'NOU'), prop('AKL', 'SUV'), jet('LAX', 'SUV')]],
  '32': ['São Paulo, the biggest city, as the hub', [prop('GRU', 'RIO'), prop('GRU', 'EZE'), jet('GRU', 'LOS')]],
  '33': ['Sydney flies to Tokyo on its own', [prop('SCL', 'LIM'), prop('SCL', 'EZE'), jet('SCL', 'AKL'), jet('SYD', 'TYO')]],
  '34': ['Perth through Singapore', [prop('SIN', 'KUL'), prop('SIN', 'JKT'), prop('SIN', 'BKK'), prop('SIN', 'HCM'), jet('SIN', 'JNB'), jet('SIN', 'PER')]],
  '35': ['Buenos Aires across the Pacific', [prop('SYD', 'MEL'), prop('SYD', 'BNE'), prop('SYD', 'AKL'), jet('SYD', 'SIN'), jet('SIN', 'JNB'), jet('AKL', 'LAX'), jet('AKL', 'EZE'), up('SYD')]],
  '36': ['every spoke straight to Tokyo', [prop('TYO', 'OSA'), prop('TYO', 'SEL'), prop('TYO', 'PUS'), prop('TYO', 'SHA'), jet('TYO', 'SFO')]],
  '37': ['Cape Town gets its own ocean leg', [prop('JNB', 'CPT'), prop('JNB', 'DUR'), prop('JNB', 'TNR'), prop('JNB', 'LUS'), jet('JNB', 'BOM'), jet('CPT', 'PER')]],
  '38': ['Bogotá flies everything itself', [prop('BOG', 'MDE'), prop('BOG', 'UIO'), prop('BOG', 'PTY'), prop('BOG', 'GYE'), jet('BOG', 'ACC'), jet('BOG', 'LIM')]],
  '39': ['the Bombay stopover', [prop('DXB', 'DOH'), prop('DXB', 'MCT'), prop('DXB', 'KWI'), prop('DXB', 'RUH'), jet('DXB', 'BOM'), jet('BOM', 'SYD'), jet('JNB', 'SIN')]],
  '40': ['Asia and Oceania through Dubai', [prop('NBO', 'ADD'), prop('NBO', 'DAR'), prop('NBO', 'KGL'), jet('NBO', 'DXB'), jet('BOM', 'DXB'), jet('BOM', 'SYD'), jet('NBO', 'GRU')]],
};

try {
  await import('./ts-test-loader.mjs');
  const { PUZZLES } = await import('../src/data/puzzles/index.ts');
  const { PUZZLE_PACKS } = await import('../src/data/puzzles/packs.ts').catch(() => ({ PUZZLE_PACKS: [] }));
  const engine = await import('../src/game/modes/puzzle.ts');
  const { en } = await import('../src/i18n/en.ts');
  const { pl } = await import('../src/i18n/pl.ts');
  const { setLanguage, t } = await import('../src/i18n/index.ts');
  const pack = PUZZLE_PACKS.find((item) => item.id === 'longHaul');
  const inRange = (from, to) => (level) => Number(level.id) >= from && Number(level.id) <= to;
  const levels = PUZZLES.filter(inRange(FIRST, LAST));
  const margin = (level) => engine.runReference(level).snapshot.marginPercent;
  const ids = Array.from({ length: LAST - FIRST + 1 }, (_, i) => String(FIRST + i));

  await check(`pack "Long haul" starts at ${FIRST} with ten levels ${FIRST}–${LAST}`, () => {
    assert(pack?.firstLevel === String(FIRST), `pack ${JSON.stringify(pack)}`);
    assert(levels.map((level) => level.id).join() === ids.join(), `levels ${levels.map((level) => level.id)}`);
    const next = PUZZLE_PACKS.map((item) => Number(item.firstLevel)).filter((first) => first > FIRST).sort((a, b) => a - b)[0];
    const size = (next ?? PUZZLES.length + 1) - FIRST;
    assert(size === 10, `the board header would count ${size} puzzles`);
  });
  await check('PL and EN titles, distinct from every other level', () => {
    for (const catalog of [en, pl]) {
      const titles = PUZZLES.map((level) => catalog[level.titleKey]);
      for (const id of ids) assert(typeof catalog[`puzzle.${id}.title`] === 'string' && catalog[`puzzle.${id}.title`].length > 3, `puzzle.${id}.title missing`);
      assert(new Set(titles).size === titles.length, 'duplicate puzzle title');
    }
    assert(pack && en[pack.nameKey] === 'Long haul' && pl[pack.nameKey] === 'Daleki zasięg', 'pack name');
  });
  await check('board header plurals (PL one/few/many, EN one/other) and "10 zadań / 10 puzzles"', () => {
    assert(pack, 'no pack');
    const line = (language, count) => { setLanguage(language); return t('puzzle.pack.line', { name: t(pack.nameKey), count }); };
    assert(line('pl', 1).endsWith('1 zadanie') && line('pl', 2).endsWith('2 zadania') && line('pl', 5).endsWith('5 zadań') &&
      line('pl', 12).endsWith('12 zadań') && line('pl', 22).endsWith('22 zadania'), `PL: ${line('pl', 5)}`);
    assert(line('pl', 10) === 'Paczka: Daleki zasięg · 10 zadań', `PL: ${line('pl', 10)}`);
    assert(line('en', 1).endsWith('1 puzzle') && line('en', 10) === 'Pack: Long haul · 10 puzzles', `EN: ${line('en', 10)}`);
  });
  await check('steeper curve: every margin ≥ 15 % and below the smallest of 26–30', () => {
    assert(levels.length === ids.length, `${levels.length} long-haul levels`);
    const before = Math.min(...PUZZLES.filter(inRange(26, 30)).map(margin));
    for (const level of levels) {
      const value = margin(level);
      assert(value >= 15 && value < before, `${level.id}: +${value}% (26–30 min +${before}%)`);
    }
  });
  await check('36–40 offer more than 31–35 (cities × strips) and each builds on ≥ 2 newer mechanics', () => {
    const late = PUZZLES.filter(inRange(36, 40));
    assert(late.length === 5, `${late.length} levels in 36–40`);
    const mean = (list) => list.reduce((sum, level) => sum + level.startCities.length * level.availableRoutes.length, 0) / list.length;
    const early = PUZZLES.filter(inRange(31, 35));
    assert(mean(late) > mean(early), `36–40 mean ${mean(late)} <= 31–35 mean ${mean(early)}`);
    for (const level of late) {
      const newer = (level.mechanics ?? []).filter((tag) => ['slots', 'curfew', 'week', 'mct'].includes(tag));
      assert(newer.length >= 2, `${level.id}: ${newer.join(', ') || 'none'}`);
      assert(level.durationTicks === 8640, `${level.id}: not two 3-day weeks`);
    }
  });
  for (const id of ids) {
    const level = levels.find((item) => item.id === id);
    await check(`${id}: the reference wins in ${ORDERS} orders of its strips`, () => {
      assert(level, `level ${id} missing`);
      const connects = level.referenceCommands.filter((command) => command.type === 'connect');
      const upgrades = level.referenceCommands.filter((command) => command.type !== 'connect');
      let seed = 0xA1A1 + Number(id);
      const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      for (let k = 0; k < ORDERS; k++) {
        const order = connects.slice();
        if (k === 1) order.reverse();
        else if (k > 1) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const run = engine.replayPuzzle(level, [...order, ...upgrades, { type: 'advance', ticks: level.durationTicks }]).snapshot;
        assert(run.status === 'won',
          `order ${order.map((command) => `${command.from}-${command.to}`).join(' ')}: ${run.status} ${run.reason} ${run.jammedCity ?? ''} +${run.marginPercent}%`);
      }
    });
  }
  for (const id of ids) {
    const level = levels.find((item) => item.id === id) ?? { id };
    const [idea, commands] = DECOYS[id];
    await check(`${id}: decoy "${idea}" loses`, () => {
      assert(level.referenceCommands, `level ${id} missing`);
      const run = engine.replayPuzzle(level, [...commands, { type: 'advance', ticks: level.durationTicks }]).snapshot;
      assert(run.status === 'lost', `decoy ${run.status} with ${run.delivered}`);
    });
  }
} catch (error) {
  failures.push('setup');
  console.error('FAIL setup: ' + (error instanceof Error ? error.message : String(error)));
}
console.log(`SUMMARY test:long-haul seed=0xA1A1 cases=${checked} passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;
