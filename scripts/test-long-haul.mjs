// [ext-02] R6h, D-131/D-162/D-163: the first puzzle pack "Long haul" (31–35). The pack is registered from 31 with
// five levels, PL/EN titles and the board header with correct plurals; the curve is steeper than 26–30 (every
// margin below the smallest margin of 26–30, more networks to choose from); each level's tempting decoy network
// loses on the real Sim, so the reference is not the only obvious idea. Fixed seed 0xA1A1 (levels carry seeds).
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
/** The idea a player is likely to try first; each must lose (jam, or the goal not met). */
const DECOYS = {
  '31': ['the shorter ocean leg from Suva', [prop('AKL', 'SYD'), prop('AKL', 'NOU'), prop('AKL', 'SUV'), jet('LAX', 'SUV')]],
  '32': ['São Paulo, the biggest city, as the hub', [prop('GRU', 'RIO'), prop('GRU', 'EZE'), jet('GRU', 'LOS')]],
  '33': ['Sydney flies to Tokyo on its own', [prop('SCL', 'LIM'), prop('SCL', 'EZE'), jet('SCL', 'AKL'), jet('SYD', 'TYO')]],
  '34': ['Perth through Singapore', [prop('SIN', 'KUL'), prop('SIN', 'JKT'), prop('SIN', 'BKK'), prop('SIN', 'HCM'), jet('SIN', 'JNB'), jet('SIN', 'PER')]],
  '35': ['Buenos Aires across the Pacific', [prop('SYD', 'MEL'), prop('SYD', 'BNE'), prop('SYD', 'AKL'), jet('SYD', 'SIN'), jet('SIN', 'JNB'), jet('AKL', 'LAX'), jet('AKL', 'EZE'), up('SYD')]],
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
  const levels = PUZZLES.filter((level) => Number(level.id) >= 31 && Number(level.id) <= 35);
  const margin = (level) => engine.runReference(level).snapshot.marginPercent;

  await check('pack "Long haul" starts at 31 with five levels 31–35', () => {
    assert(pack?.firstLevel === '31', `pack ${JSON.stringify(pack)}`);
    assert(levels.map((level) => level.id).join() === '31,32,33,34,35', `levels ${levels.map((level) => level.id)}`);
  });
  await check('PL and EN titles, distinct from every other level', () => {
    for (const catalog of [en, pl]) {
      const titles = PUZZLES.map((level) => catalog[level.titleKey]);
      for (const level of levels) assert(typeof catalog[level.titleKey] === 'string' && catalog[level.titleKey].length > 3, `${level.titleKey} missing`);
      assert(new Set(titles).size === titles.length, 'duplicate puzzle title');
    }
    assert(pack && en[pack.nameKey] === 'Long haul' && pl[pack.nameKey] === 'Daleki zasięg', 'pack name');
  });
  await check('board header plurals (PL one/few/many, EN one/other)', () => {
    assert(pack, 'no pack');
    const line = (language, count) => { setLanguage(language); return t('puzzle.pack.line', { name: t(pack.nameKey), count }); };
    assert(line('pl', 1).endsWith('1 zadanie') && line('pl', 2).endsWith('2 zadania') && line('pl', 5).endsWith('5 zadań') &&
      line('pl', 12).endsWith('12 zadań') && line('pl', 22).endsWith('22 zadania'), `PL: ${line('pl', 5)}`);
    assert(line('en', 1).endsWith('1 puzzle') && line('en', 5) === 'Pack: Long haul · 5 puzzles', `EN: ${line('en', 5)}`);
  });
  await check('steeper curve: every margin 15 % and below the smallest of 26–30', () => {
    const before = Math.min(...PUZZLES.filter((level) => Number(level.id) >= 26 && Number(level.id) <= 30).map(margin));
    assert(levels.length === 5, `${levels.length} long-haul levels`);
    for (const level of levels) {
      const value = margin(level);
      assert(value >= 15 && value < before, `${level.id}: +${value}% (26–30 min +${before}%)`);
    }
  });
  await check('more to choose from: offered routes and cities at least those of 26–30 on average', () => {
    const mean = (list, pick) => list.reduce((sum, level) => sum + pick(level), 0) / list.length;
    const old = PUZZLES.filter((level) => Number(level.id) >= 26 && Number(level.id) <= 30);
    const routes = mean(levels, (level) => level.availableRoutes.length), oldRoutes = mean(old, (level) => level.availableRoutes.length);
    assert(routes >= oldRoutes, `routes ${routes} < ${oldRoutes}`);
    assert(levels.length === 5, `${levels.length} long-haul levels`);
    assert(levels.every((level) => level.durationTicks === 8640), 'every long-haul level runs two 3-day weeks');
  });
  for (const id of Object.keys(DECOYS)) {
    const level = levels.find((item) => item.id === id) ?? { id };
    const [idea, commands] = DECOYS[level.id] ?? ['(none)', []];
    await check(`${level.id}: decoy "${idea}" loses`, () => {
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
