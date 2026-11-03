// [ext-01] R6f, D-161: `npm run puzzle:report` — the difficulty table of every puzzle level, so a pack PR shows its
// curve. Each row comes from the real reference run (src/game/modes/puzzle.ts on the authoritative Sim):
// duration at 1x, goal, stock, reference actions, mechanics (tags and what the reference run actually met),
// reference result, margin over the target and the star thresholds.
// Usage: npm run puzzle:report [-- --json] [-- --from 31]   (runs with --import ./scripts/ts-test-loader.mjs)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PUZZLE_DIR, puzzleIds } from './puzzle-index.mjs';
import { SIM_TICKS_PER_SECOND } from '../src/sim/params.ts';

/** Stars: >= 30 % over the target -> 3, >= 15 % -> 2, cleared -> 1 (src/game/modes/puzzle.ts). */
const starAt = (target, percent) => Math.ceil((target * (100 + percent)) / 100);
const clock = (ticks) => {
  const seconds = Math.round(ticks / SIM_TICKS_PER_SECOND);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function loadLevels(dir = PUZZLE_DIR) {
  return puzzleIds(dir).map((id) => JSON.parse(readFileSync(resolve(dir, `${id}.json`), 'utf8')));
}

/** One report row per level; needs the TS test loader (scripts/ts-test-loader.mjs) to be registered. */
export async function puzzleReportRows(levels) {
  const engine = await import('../src/game/modes/puzzle.ts');
  const { createGame } = await import('../src/sim/index.ts');
  const { en } = await import('../src/i18n/en.ts');
  return levels.map((level) => {
    const run = engine.runReference(level).snapshot;
    // The same command stream on a bare Sim gives the cause ledger (slot waits) the puzzle snapshot hides.
    const sim = createGame(level.demandSeed, 'puzzle', level.id);
    for (const command of level.referenceCommands) {
      sim.apply(command.type === 'connect'
        ? { type: 'AddRoute', cityIds: [command.from, command.to], aircraft: command.plane === 'jet' ? 'widebody' : 'turboprop' }
        : { type: 'UpgradeHub', hubId: command.city });
      sim.tick();
    }
    while (sim.world.status === 'running') sim.tick();
    const slotWait = level.startCities.reduce((sum, city) => sum + sim.world.hubCauseLedger(city.id).slotWaitMinutes, 0);
    const connects = level.referenceCommands.filter((command) => command.type === 'connect');
    const goal = level.goal;
    return {
      id: level.id,
      title: en[level.titleKey] ?? level.titleKey,
      ticks: level.durationTicks,
      at1x: clock(level.durationTicks),
      goal: goal.kind === 'deliver' ? `deliver ${goal.targetDelivered}`
        : goal.kind === 'continents' ? `${goal.continents} continents, ${goal.targetDelivered}`
        : `${goal.nights} nights, ${goal.targetDelivered}`,
      target: goal.targetDelivered,
      cities: level.startCities.length,
      offered: level.availableRoutes.length,
      stock: `${level.stock.turboprops}T ${level.stock.jets}W ${level.stock.hubUpgrades}H`,
      actions: level.referenceCommands.length,
      widebodies: connects.filter((command) => command.plane === 'jet').length,
      mechanics: (level.mechanics ?? []).join(' ') || '—',
      slotWaitMinutes: slotWait,
      curfewAirports: level.startCities.filter((city) => city.curfew).length,
      status: run.status,
      delivered: run.delivered,
      marginPercent: run.marginPercent,
      stars: run.stars,
      twoStars: starAt(goal.targetDelivered, 15),
      threeStars: starAt(goal.targetDelivered, 30),
    };
  });
}

export function reportTable(rows) {
  const head = ['#', 'Title (EN)', '1x', 'Goal', 'Cities/routes', 'Stock', 'Actions', 'Mechanics', 'Slot wait',
    'Curfew', 'Reference', 'Margin', '★★ ≥', '★★★ ≥'];
  const body = rows.map((row) => [row.id, row.title, row.at1x, row.goal, `${row.cities}/${row.offered}`, row.stock,
    `${row.actions}${row.widebodies ? ` (${row.widebodies}W)` : ''}`, row.mechanics, `${row.slotWaitMinutes} min`,
    String(row.curfewAirports), `${row.delivered} ${'★'.repeat(row.stars)}${row.status === 'won' ? '' : ' LOST'}`,
    `+${row.marginPercent}%`, String(row.twoStars), String(row.threeStars)]);
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const total = rows.reduce((sum, row) => sum + row.ticks, 0);
  return [line(head), line(head.map(() => '---')), ...body.map(line), '',
    `${rows.length} levels, ${total} ticks = ${(total / SIM_TICKS_PER_SECOND / 3600).toFixed(2)} h at 1x; ` +
    `margin min +${Math.min(...rows.map((row) => row.marginPercent))}%, ` +
    `lost references: ${rows.filter((row) => row.status !== 'won').length}`].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const fromAt = args.indexOf('--from');
  const from = fromAt >= 0 ? Number(args[fromAt + 1]) : 1;
  const rows = (await puzzleReportRows(loadLevels())).filter((row) => Number(row.id) >= from);
  console.log(args.includes('--json') ? JSON.stringify(rows, null, 2) : reportTable(rows));
}
