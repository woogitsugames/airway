// [night-10f] Haptics vocabulary: which player actions vibrate, behind the switch, edge-triggered for jams.
// Fake native driver; fixed seed for the SUMMARY convention (no randomness is used).
import { configureHaptics, createJamHaptics, haptic, hapticCommand, hapticNetworkClosed, routeHaptics }
  from '../src/platform/haptics.ts';

const calls: string[] = [];
let on = true;
configureHaptics({
  isEnabled: () => on,
  driver: {
    selectionStart: () => { calls.push('start'); },
    selectionChanged: () => { calls.push('selection'); },
    selectionEnd: () => { calls.push('end'); },
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

check('route tool: a drag is one selection, snaps tick inside it, commit a light impact', () => {
  routeHaptics.start(); routeHaptics.snap(); routeHaptics.snap(); routeHaptics.confirm(); routeHaptics.end();
  same(calls, ['start', 'selection', 'selection', 'light', 'end']);
});
check('a snap outside a drag opens and closes its own selection', () => {
  haptic('snap');
  same(calls, ['start', 'selection', 'end']);
});
check('the switch turned off mid-drag silences the ticks but still closes the selection', () => {
  routeHaptics.start(); on = false; routeHaptics.snap(); routeHaptics.end(); routeHaptics.end();
  same(calls, ['start', 'end']);
});
// [night-12r] D-137 (R6d): model of @capacitor/haptics 8.0.2 — Android `Haptics.java` ignores selectionChanged
// unless selectionStarted, iOS `Haptics.swift` ticks only the generator selectionStart created.
check('every snap vibrates under the Capacitor 8 selection rules', () => {
  let started = false;
  let ticks = 0;
  configureHaptics({ driver: {
    selectionStart: () => { started = true; },
    selectionChanged: () => { if (started) ticks++; },
    selectionEnd: () => { started = false; },
    impactLight: () => undefined,
    impactHeavy: () => undefined,
  } });
  try {
    haptic('snap');
    routeHaptics.start(); routeHaptics.snap(); routeHaptics.snap(); routeHaptics.end();
    if (ticks !== 3) throw new Error('vibrated ' + ticks + ' of 3 snaps');
    if (started) throw new Error('selection left open');
  } finally {
    configureHaptics({ driver: {
      selectionStart: () => { calls.push('start'); },
      selectionChanged: () => { calls.push('selection'); },
      selectionEnd: () => { calls.push('end'); },
      impactLight: () => { calls.push('light'); },
      impactHeavy: () => { calls.push('heavy'); },
    } });
  }
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
    selectionStart: () => Promise.reject(new Error('denied')),
    selectionEnd: () => { throw new Error('no vibrator'); },
    selectionChanged: () => { throw new Error('no vibrator'); },
    impactLight: () => Promise.reject(new Error('denied')),
    impactHeavy: () => undefined,
  } });
  routeHaptics.start(); routeHaptics.snap(); routeHaptics.end(); haptic('snap'); routeHaptics.confirm(); hapticNetworkClosed();
});

for (const error of errors) console.error('FAIL ' + error);
console.log(`SUMMARY test:haptics seed=0xA1A1 passed=${passed} failed=${errors.length}`);
if (errors.length) process.exitCode = 1;
