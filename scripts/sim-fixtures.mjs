// [task-08] Deterministic RNG contract fixture until task 02 exports its seeded streams.
export function rngRoot(seed) {
  return {
    fork(label) {
      if (label !== 'demand') throw new Error('Only the demand stream is used by task 08');
      let state = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
      return {
        next() {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return (state >>> 0) / 0x100000000;
        },
        snapshot() { return state >>> 0; },
        restore(value) { state = value >>> 0; },
      };
    },
  };
}
export function city(cityId, regionId, population = 0, utcOffsetMinutes = 0) {
  return { cityId, regionId, population, utcOffsetMinutes };
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
