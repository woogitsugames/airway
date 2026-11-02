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
    delivered: 1184, completedWeeks: 6,
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
  });
}
