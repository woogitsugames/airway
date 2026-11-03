// [task-15] Deterministic visual fixture until task 08 and the world renderer are merged.
import { createGameOverController } from './index';

export function mountGameOverPreview(host: HTMLElement): void {
  const query = new URLSearchParams(location.search);
  const requested = Number(query.get('seed') ?? '41321');
  const seed = Number.isSafeInteger(requested) ? requested >>> 0 : 41321;
  const reset = (nextSeed: number): void => {
    location.search = '?preview=gameover&seed=' + nextSeed;
  };
  const controller = createGameOverController({
    host,
    pauseSimulation: () => {},
    freezeScene: () => {},
    restartSameWorld: (identity) => reset(identity.seed),
    restartNewWorld: reset,
    returnToMenu: () => { location.search = ''; },
    reducedMotion: () => true,
    // Preview must not overwrite a player's best result.
    storage: { getItem: () => JSON.stringify({ score: 999999, weeks: 99, seed }), setItem: () => {} },
  });
  void controller.show({
    seed, initialHash: 'preview-seed-' + seed, hubId: 'LIS', hubCode: 'LIS',
    delivered: 1184, completedWeeks: 6, tip: true, // [night-11f] worst case: three causes and a tip
    ledger: {
      waiting: 100, capacity: 100, waitingByRegion: { NAM: 62, EUN: 18, AFR: 20 },
      seatsUnavailable: 28, congestedSeconds: 45,
    },
    departures: [
      { originHubId: 'LIS', flightNumber: 'AW 104', destinationCode: 'JFK', gate: 'A1' },
      { originHubId: 'LIS', flightNumber: 'AW 211', destinationCode: 'ACC', gate: 'B4' },
      { originHubId: 'LIS', flightNumber: 'AW 018', destinationCode: 'CDG', gate: 'C2' },
      { originHubId: 'LHR', flightNumber: 'AW 901', destinationCode: 'LIS', gate: 'D0' },
    ],
    // [night-10r] A seven-week timeline (more rows than the causes): the panel scrolls inside the causes' height.
    timeline: () => Promise.resolve({ endDay: 2, weeks: [
      { week: 1, routes: 3, extended: 0, removed: 0, aircraft: 4 },
      { week: 2, routes: 1, extended: 2, removed: 0, aircraft: 1, pick: { upgrade: 'widebody' } },
      { week: 3, routes: 0, extended: 1, removed: 1, aircraft: 2, pick: { upgrade: 'hub-expansion', hubId: 'LIS' } },
      { week: 4, routes: 0, extended: 0, removed: 0, aircraft: 0, pick: { upgrade: 'departure-slots', hubId: 'LIS' } },
      { week: 5, routes: 2, extended: 0, removed: 0, aircraft: 2, pick: { upgrade: 'turboprop' } },
      { week: 6, routes: 0, extended: 1, removed: 0, aircraft: 1, pick: { upgrade: 'widebody' } },
      { week: 7, routes: 1, extended: 0, removed: 0, aircraft: 0, pick: { upgrade: 'turboprop' } },
    ] }),
  });
}
