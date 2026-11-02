// Shared fixtures for the passenger-subsystem tests (task 08).
import './ts-test-loader.mjs';
const { Rng } = await import('../src/core/rng.ts');

/** The kernel's real seeded 'demand' stream. */
export function demandRng(seed) {
  return new Rng(seed >>> 0).fork('demand');
}
export function city(cityId, regionId, population = 0, utcOffsetH = 0) {
  return { cityId, regionId, population, utcOffsetH };
}
export function distances(data) {
  return (a, b) => {
    if (a === b) return 0;
    const km = data[`${a}:${b}`] ?? data[`${b}:${a}`];
    if (km === undefined) throw new Error(`Missing test distance ${a}:${b}`);
    return km;
  };
}
export function fullyConnectedDistances(ids, distance = 700) {
  return (a, b) => a === b ? 0 : distance +
    (ids.indexOf(a) + ids.indexOf(b)) * 3;
}
export function assertBalance(assert, sim) {
  const b = sim.passengerBalance();
  assert.equal(b.created, b.waiting + b.airborne + b.delivered, 'passenger conservation');
}
