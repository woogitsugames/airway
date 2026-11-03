// [night-10f] Haptics vocabulary: which player actions vibrate, behind the switch, edge-triggered for jams.
// Fake native driver; fixed seed for the SUMMARY convention (no randomness is used).
import { configureHaptics, createJamHaptics, haptic, hapticCommand, hapticNetworkClosed, routeHaptics }
  from '../src/platform/haptics.ts';

const calls: string[] = [];
let on = true;
configureHaptics({
  isEnabled: () => on,
  driver: {
    selectionChanged: () => { calls.push('selection'); },
    impactLight: () => { calls.push('light'); },
    impactHeavy: () => { calls.push('heavy'); },
  },
});

const errors: string[] = [];
let passed = 0;
function check(name: string, fn: () => void): void {
  calls.length = 0;
  on = true;
  try { fn(); passed++; } catch (error) { errors.push(name + ': ' + String(error)); }
}
function same(actual: readonly string[], expected: readonly string[]): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(JSON.stringify(actual) + ' != ' + JSON.stringify(expected));
}

check('route tool: snap is a selection tick, commit a light impact', () => {
  routeHaptics.snap(); routeHaptics.confirm();
  same(calls, ['selection', 'light']);
});
check('accepted aircraft drop and weekly pick confirm; refused ones stay silent', () => {
  hapticCommand('AssignPlane', true); hapticCommand('ChooseUpgrade', true);
  hapticCommand('AssignPlane', false); hapticCommand('ChooseUpgrade', false);
  same(calls, ['light', 'light']);
});
check('network closed is one heavy impact', () => {
  hapticNetworkClosed();
  same(calls, ['heavy']);
});
check('jam haptics fire on the edge only, again after the hub cleared', () => {
  const jams = createJamHaptics();
  jams.setJammed('WAW', true); jams.setJammed('WAW', true); jams.setJammed('NYC', true);
  jams.setJammed('WAW', false); jams.setJammed('WAW', true);
  jams.reset(); jams.setJammed('NYC', true);
  same(calls, ['heavy', 'heavy', 'heavy', 'heavy']);
});
check('the "Haptic feedback" switch silences every kind', () => {
  on = false;
  routeHaptics.snap(); routeHaptics.confirm(); hapticCommand('AssignPlane', true); hapticNetworkClosed(); haptic('jam');
  createJamHaptics().setJammed('WAW', true);
  same(calls, []);
});
check('a throwing or rejecting driver never breaks the caller', () => {
  configureHaptics({ driver: {
    selectionChanged: () => { throw new Error('no vibrator'); },
    impactLight: () => Promise.reject(new Error('denied')),
    impactHeavy: () => undefined,
  } });
  routeHaptics.snap(); routeHaptics.confirm(); hapticNetworkClosed();
});

for (const error of errors) console.error('FAIL ' + error);
console.log(`SUMMARY test:haptics seed=0xA1A1 passed=${passed} failed=${errors.length}`);
if (errors.length) process.exitCode = 1;
