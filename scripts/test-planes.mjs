import assert from 'node:assert/strict';
import { harness } from './test-plane-support.mjs';

const SEED = '0xA1A1';

harness('planes', SEED, ({ planes, params }, check) => {
  const distance = (a, b) => {
    const matrix = {
      'AAA-BBB': 2501,
      'AAA-CCC': 11001,
      'AAA-DDD': 2500,
      'BBB-CCC': 999,
      'BBB-DDD': 1400,
    };
    return matrix[[a, b].sort().join('-')];
  };
  const route = planes.createScheduledRoute('R1', ['AAA', 'BBB', 'CCC'], distance);
  const shortRoute = planes.createScheduledRoute('R2', ['AAA', 'DDD', 'BBB'], distance);
  const longRoute = planes.createScheduledRoute('R3', ['AAA', 'CCC'], distance);

  check('two types and correct integer tick durations', () => {
    assert.deepEqual(params.PLANE_TYPES.turboprop, { rangeKm: 2500, seats: 48, speedKmPerTick: 8 });
    assert.deepEqual(params.PLANE_TYPES.widebody, { rangeKm: 11000, seats: 300, speedKmPerTick: 14 });
    assert.equal(route.segments[0].durationTicks.turboprop, 313);
    assert.equal(route.segments[0].durationTicks.widebody, 179);
    assert.equal(shortRoute.segments[0].durationTicks.turboprop, 313);
    assert.equal(params.MIN_AIRPORT_SERVICE_TICKS, 25);
  });

  check('range rejection has original distance, endpoints and segment index', () => {
    assert.deepEqual(planes.validatePlaneRange(route, 'turboprop'), {
      ok: false, reason: 'RANGE_EXCEEDED', routeId: 'R1', segment: 0,
      fromCityId: 'AAA', toCityId: 'BBB', distanceKm: 2501,
      maxRangeKm: 2500, planeType: 'turboprop',
    });
    const stock = planes.createPlaneFleet({ turboprop: 2, widebody: 1 });
    assert.equal(planes.assignPlane(stock, route, 'turboprop').reason, 'RANGE_EXCEEDED');
    assert.equal(stock.available.turboprop, 2);
    assert.equal(stock.planes.length, 0);
    assert.equal(planes.assignPlane(stock, longRoute, 'widebody').reason, 'RANGE_EXCEEDED');
  });

  check('intermediate stop legalises turboprop, end range is inclusive', () => {
    const fleet = planes.createPlaneFleet({ turboprop: 1, widebody: 0 });
    assert.equal(planes.validatePlaneRange(shortRoute, 'turboprop').ok, true);
    assert.equal(planes.assignPlane(fleet, shortRoute, 'turboprop').ok, true);
    assert.equal(fleet.planes[0].segment, 0);
    assert.equal(planes.routeHasAssignedPlanes(fleet, 'R2'), true);
    assert.equal(planes.routeHasAssignedPlanes(fleet, 'none'), false);
    assert.equal(fleet.available.turboprop, 0);
  });

  check('command dispatcher validates stock, route, type and stable IDs', () => {
    const fleet = planes.createPlaneFleet({ turboprop: 2, widebody: 0 });
    assert.equal(planes.applyPlaneCommand(fleet, [shortRoute], {
      type: 'AssignPlane', routeId: 'missing', planeType: 'turboprop',
    }).reason, 'UNKNOWN_ROUTE');
    assert.equal(planes.applyPlaneCommand(fleet, [shortRoute], {
      type: 'AssignPlane', routeId: 'R2', planeType: 'bogus',
    }).reason, 'INVALID_PLANE_TYPE');
    const first = planes.applyPlaneCommand(fleet, [shortRoute], {
      type: 'AssignPlane', routeId: 'R2', planeType: 'turboprop',
    });
    assert.equal(first.ok, true);
    assert.equal(fleet.planes[0].id, 'plane-1');
    planes.applyPlaneCommand(fleet, [shortRoute], {
      type: 'AssignPlane', routeId: 'R2', planeType: 'turboprop',
    });
    assert.equal(fleet.planes[1].id, 'plane-2');
    assert.equal(planes.assignPlane(fleet, shortRoute, 'turboprop').reason, 'NO_SPARE_PLANE');
    assert.equal(planes.assignPlane(fleet, route, 'widebody').reason, 'NO_SPARE_PLANE');
  });

  check('unassign restores supply and never deletes occupied/airborne planes', () => {
    const fleet = planes.createPlaneFleet({ turboprop: 1 });
    const assigned = planes.assignPlane(fleet, shortRoute, 'turboprop');
    assert.equal(assigned.ok, true);
    const plane = fleet.planes[0];
    plane.load = 3;
    assert.equal(planes.unassignPlane(fleet, plane.id).reason, 'PLANE_OCCUPIED');
    plane.load = 0;
    plane.phase = 'flight';
    assert.equal(planes.unassignPlane(fleet, plane.id).reason, 'PLANE_IN_FLIGHT');
    plane.phase = 'ground';
    assert.equal(planes.applyPlaneCommand(fleet, [shortRoute], {
      type: 'UnassignPlane', planeId: plane.id,
    }).ok, true);
    assert.equal(fleet.available.turboprop, 1);
    assert.equal(fleet.planes.length, 0);
    assert.equal(planes.unassignPlane(fleet, plane.id).reason, 'UNKNOWN_PLANE');
  });

  check('upgrade reserve increments and input validation is atomic', () => {
    const fleet = planes.createPlaneFleet();
    assert.deepEqual(fleet.available, { turboprop: 2, widebody: 0 });
    planes.grantPlanes(fleet, 'widebody', 2);
    assert.equal(fleet.available.widebody, 2);
    assert.throws(() => planes.grantPlanes(fleet, 'widebody', -1), RangeError);
    assert.throws(() => planes.grantPlanes(fleet, 'widebody', 0.2), RangeError);
    assert.equal(fleet.available.widebody, 2);
    assert.throws(() => planes.createPlaneFleet({ turboprop: NaN }), RangeError);
  });

  check('malformed route/distances rejected; input cities are copied', () => {
    assert.throws(() => planes.createScheduledRoute('R', ['AAA'], distance), RangeError);
    assert.throws(() => planes.createScheduledRoute('R', ['AAA', 'AAA'], distance), RangeError);
    assert.throws(() => planes.createScheduledRoute('R', ['AAA', 'ZZZ'], distance), RangeError);
    assert.throws(() => planes.createScheduledRoute('R', ['AAA', 'BBB'], () => 1.4), RangeError);
    assert.throws(() => planes.createScheduledRoute('R', ['AAA', 'BBB'], () => Number.MAX_SAFE_INTEGER), RangeError);
    const cities = ['AAA', 'DDD'];
    const planned = planes.createScheduledRoute('COPY', cities, distance);
    cities[0] = 'CCC';
    assert.equal(planned.cityIds[0], 'AAA');
  });

  check('JSON state roundtrip retains assigned planes and integer fields', () => {
    const fleet = planes.createPlaneFleet({ widebody: 1 });
    planes.assignPlane(fleet, route, 'widebody');
    assert.deepEqual(JSON.parse(JSON.stringify(fleet)), fleet);
    assert.deepEqual(JSON.parse(JSON.stringify(route)), route);
  });
});
