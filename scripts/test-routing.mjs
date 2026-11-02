import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { RouteNetwork } = await import('../src/sim/network.ts');
const { RouteRouter } = await import('../src/sim/routing.ts');
import { city, distances } from './sim-fixtures.mjs';

const SEED = '0xA1A1';
let tests = 0;
function test(fn) { fn(); tests++; }
try {
  const cities = [city('A', 'EUS'), city('B', 'NAM'), city('C', 'AFR'), city('D', 'ME')];
  const km = distances({ 'A:B': 600, 'B:C': 500, 'A:C': 1_200, 'A:D': 40, 'D:C': 40, 'B:D': 500 });
  const net = new RouteNetwork(cities.map((c) => c.cityId));
  const router = new RouteRouter(cities, km);
  net.addRoute('direct', ['A', 'B', 'C']);
  net.addRoute('short1', ['A', 'D']);
  net.addRoute('short2', ['D', 'C']);
  router.rebuild(net.routes, net.revision);
  test(() => {
    const leg = router.nextLeg('A', 'AFR');
    assert.equal(leg.routeId, 'direct');
    assert.equal(leg.nextCityId, 'B');
    assert.equal(leg.transfers, 0);
    assert.equal(leg.distanceKm, 1_100);
  });
  test(() => {
    const before = router.searches;
    for (let i = 0; i < 100; i++) assert.equal(router.nextLeg('A', 'AFR').routeId, 'direct');
    assert.equal(router.searches, before, 'routing must be cached between network edits');
  });
  test(() => {
    assert.equal(router.nextLeg('A', 'AFR', 'short1').routeId, 'short1',
      'staying on the inbound route wins a transfer tie only if it is still shortest');
  });
  test(() => {
    net.removeRoute('direct');
    router.rebuild(net.routes, net.revision);
    assert.equal(router.nextLeg('A', 'AFR').routeId, 'short1');
    assert.equal(router.nextLeg('A', 'AFR').transfers, 1);
    assert.equal(router.nextLeg('A', 'AFR').distanceKm, 80);
  });
  test(() => {
    const s = net.snapshot();
    const restored = new RouteNetwork(cities.map((c) => c.cityId));
    restored.restore(s);
    assert.deepEqual(restored.snapshot(), s);
    restored.extendRoute('short1', 'B');
    assert.deepEqual(restored.getRoute('short1').cities, ['A', 'D', 'B']);
  });
  test(() => {
    const other = new RouteNetwork(['A', 'B', 'C']);
    const tie = new RouteRouter(cities, km);
    other.addRoute('direct', ['A', 'C']);
    other.addRoute('scenic', ['A', 'B', 'C']);
    tie.rebuild(other.routes, other.revision);
    assert.equal(tie.nextLeg('A', 'AFR').routeId, 'scenic', 'same transfers: shorter km wins');
  });
  test(() => {
    assert.throws(() => net.addRoute('loop', ['A', 'B', 'A']));
    assert.throws(() => net.extendRoute('short1', 'A'));
    assert.equal(router.nextLeg('C', 'nonexistent'), null);
  });
  console.log(`SUMMARY test:routing seed=${SEED} cases=${tests} passed=${tests} failed=0`);
} catch (e) {
  console.error(e);
  console.log(`SUMMARY test:routing seed=${SEED} cases=${tests} passed=${tests} failed=1`);
  process.exitCode = 1;
}
