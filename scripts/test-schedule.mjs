import assert from 'node:assert/strict';
import { harness } from './test-plane-support.mjs';

const SEED = '0xA1A1';
const WEEK_TICKS = 7 * 1440;

harness('schedule', SEED, ({ planes, schedule, params }, check) => {
  const km = (a, b) => ({
    'AAA-BBB': 112,
    'BBB-CCC': 196,
  })[[a, b].sort().join('-')];
  const route = planes.createScheduledRoute('R1', ['AAA', 'BBB', 'CCC'], km);

  check('minimum ground service and exact directed flight duration', () => {
    const fleet = planes.createPlaneFleet({ turboprop: 1 });
    planes.assignPlane(fleet, route, 'turboprop');
    const plane = fleet.planes[0];
    for (let i = 0; i < 24; i++) schedule.tickPlaneSchedule(fleet, [route]);
    assert.equal(plane.phase, 'ground');
    assert.equal(plane.remainingServiceTicks, 1);
    schedule.tickPlaneSchedule(fleet, [route]);
    assert.equal(plane.phase, 'flight');
    assert.equal(plane.segment, 0);
    assert.equal(plane.progress01, 0);
    const duration = route.segments[0].durationTicks.turboprop;
    for (let i = 1; i < duration; i++) {
      schedule.tickPlaneSchedule(fleet, [route]);
      assert.equal(plane.phase, 'flight');
      assert.equal(plane.progress01, Math.floor(i * 10000 / duration));
    }
    schedule.tickPlaneSchedule(fleet, [route]);
    assert.equal(plane.phase, 'ground');
    assert.equal(plane.cityIndex, 1);
    assert.equal(plane.remainingServiceTicks, 25);
  });

  check('bidirectional journey reverses at endpoints, never jumps over stops', () => {
    const fleet = planes.createPlaneFleet({ turboprop: 1 });
    planes.assignPlane(fleet, route, 'turboprop');
    const plane = fleet.planes[0];
    const arrivals = [];
    const passengerPort = {
      boardAt: () => 0,
      alightAt: (city) => { arrivals.push(city); return 0; },
    };
    for (let i = 0; i < 500; i++) schedule.tickPlaneSchedule(fleet, [route], passengerPort);
    assert.deepEqual(arrivals.slice(0, 4), ['BBB', 'CCC', 'BBB', 'AAA']);
    assert.equal(plane.load, 0);
    assert.equal(plane.progress01 >= 0 && plane.progress01 <= 10000, true);
  });

  check('capacity and passenger conservation over an entire 7-day simulation', () => {
    const routeAB = planes.createScheduledRoute('AB', ['AAA', 'BBB'], km);
    const fleet = planes.createPlaneFleet({ turboprop: 2, widebody: 1 });
    const a = planes.assignPlane(fleet, routeAB, 'turboprop');
    const b = planes.assignPlane(fleet, routeAB, 'widebody');
    assert.equal(a.ok && b.ok, true);
    const queues = { AAA: 1000, BBB: 0 };
    let delivered = 0;
    let boarded = 0;
    const port = {
      boardAt(city, _routeId, freeSeats) {
        const taken = Math.min(queues[city], freeSeats);
        queues[city] -= taken;
        boarded += taken;
        return taken;
      },
      alightAt(city, _routeId, load) {
        if (city === 'BBB') { delivered += load; return load; }
        return 0;
      },
    };
    for (let tick = 0; tick < WEEK_TICKS; tick++) {
      schedule.tickPlaneSchedule(fleet, [routeAB], port);
      const inPlanes = fleet.planes.reduce((n, plane) => n + plane.load, 0);
      assert.equal(queues.AAA + queues.BBB + delivered + inPlanes, 1000);
      for (const plane of fleet.planes) {
        assert.equal(Number.isInteger(plane.load), true);
        assert.equal(plane.load >= 0 && plane.load <= params.PLANE_TYPES[plane.type].seats, true);
      }
    }
    assert.equal(boarded, 1000);
    assert.equal(delivered, 1000);
    assert.equal(fleet.planes.length, 2);
  });

  check('MCT-eligible passengers can board after minimum service', () => {
    const fleet = planes.createPlaneFleet({ turboprop: 1 });
    planes.assignPlane(fleet, route, 'turboprop');
    const times = [];
    let clock = 0;
    const passengerPort = {
      alightAt: () => 0,
      boardAt: () => { times.push(clock); return 1; },
    };
    for (clock = 1; clock <= 25; clock++) {
      schedule.tickPlaneSchedule(fleet, [route], passengerPort);
    }
    assert.deepEqual(times, [25]);
    assert.equal(fleet.planes[0].load, 1);
  });

  check('invalid adapter counts cannot exceed capacity or duplicate passengers', () => {
    const routeAB = planes.createScheduledRoute('AB', ['AAA', 'BBB'], km);
    const fleet = planes.createPlaneFleet({ turboprop: 1 });
    planes.assignPlane(fleet, routeAB, 'turboprop');
    const badPort = { boardAt: (_c, _r, seats) => seats + 1, alightAt: () => 0 };
    for (let i = 0; i < 24; i++) schedule.tickPlaneSchedule(fleet, [routeAB], badPort);
    assert.throws(() => schedule.tickPlaneSchedule(fleet, [routeAB], badPort), RangeError);
    assert.equal(fleet.planes[0].load, 0);
    assert.equal(fleet.planes[0].phase, 'ground');
  });

  check('seven-day deterministic replay and JSON checkpoint restore', () => {
    const run = (checkpointAt = -1) => {
      let fleet = planes.createPlaneFleet({ turboprop: 2, widebody: 1 });
      planes.assignPlane(fleet, route, 'turboprop');
      planes.assignPlane(fleet, route, 'widebody');
      let boarded = 0;
      const passengerPort = {
        boardAt: (_c, _r, seats) => { const n = Math.min(seats, 7); boarded += n; return n; },
        alightAt: (_c, _r, load) => load,
      };
      for (let i = 0; i < WEEK_TICKS; i++) {
        if (i === checkpointAt) fleet = JSON.parse(JSON.stringify(fleet));
        schedule.tickPlaneSchedule(fleet, [route], passengerPort);
      }
      return { fleet, boarded };
    };
    const first = run();
    assert.deepEqual(first, run());
    assert.deepEqual(first, run(1440 * 3));
    assert.equal(first.fleet.planes.length, 2);
  });

  check('route removal is surfaced instead of corrupting simulation', () => {
    const fleet = planes.createPlaneFleet({ widebody: 1 });
    planes.assignPlane(fleet, route, 'widebody');
    assert.throws(() => schedule.tickPlaneSchedule(fleet, []), /lost route/);
  });
});
