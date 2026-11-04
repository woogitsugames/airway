// [night-11ai] R4g: keyboard and mouse basics without a browser. The key map (Space pause, 1/2/3 speed, +/- zoom),
// keys left alone in text fields, dialogs and with modifiers, the screens each action works on, the listener (Space
// consumed on press and release, held keys repeat zoom only), the help rows' PL/EN text, the globe canvas refusing the
// browser context menu, and the hover rules limited to `(hover: hover)`. Fails on the code before R4g:
// src/input/keyboard.ts did not exist and the canvas let the context menu through.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}

const keyboard = await import('../src/input/keyboard.ts').catch((error) => { console.error('FAIL load src/input/keyboard.ts:', error.message); return null; });
if (!keyboard) {
  console.log('SUMMARY test:keyboard seed=0xA1A1 cases=1 passed=0 failed=1');
  process.exit(1);
}
const { shortcutFor, shortcutAllowed, isTypingTarget, isInDialog, attachKeyboardShortcuts, KEY_ZOOM_STEP, SHORTCUT_HELP,
  ARIA_KEYSHORTCUTS } = keyboard;

const key = (k, extra = {}) => ({ key: k, code: '', ...extra });
const element = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra });

await check('map: Space pauses, 1/2/3 are 1×/2×/4×, +/=/NumpadAdd zoom in, -/_/NumpadSubtract zoom out', () => {
  assert.deepEqual(shortcutFor(key(' ', { code: 'Space' })), { type: 'toggle-pause' });
  assert.deepEqual(shortcutFor(key('Spacebar')), { type: 'toggle-pause' }); // old Edge/IE name
  assert.deepEqual(shortcutFor(key('1', { code: 'Digit1' })), { type: 'speed', speed: 1 });
  assert.deepEqual(shortcutFor(key('2', { code: 'Digit2' })), { type: 'speed', speed: 2 });
  assert.deepEqual(shortcutFor(key('3', { code: 'Digit3' })), { type: 'speed', speed: 4 });
  assert.deepEqual(shortcutFor(key('3', { code: 'Numpad3' })), { type: 'speed', speed: 4 });
  // AZERTY: the digit row gives '&', 'é', '"' without Shift; the physical code still says Digit1..3.
  assert.deepEqual(shortcutFor(key('&', { code: 'Digit1' })), { type: 'speed', speed: 1 });
  assert.deepEqual(shortcutFor(key('"', { code: 'Digit3' })), { type: 'speed', speed: 4 });
  for (const k of ['+', '=']) assert.deepEqual(shortcutFor(key(k, { code: 'Equal' })), { type: 'zoom', direction: 1 });
  assert.deepEqual(shortcutFor(key('+', { code: 'NumpadAdd' })), { type: 'zoom', direction: 1 });
  for (const k of ['-', '_']) assert.deepEqual(shortcutFor(key(k, { code: 'Minus' })), { type: 'zoom', direction: -1 });
  assert.deepEqual(shortcutFor(key('-', { code: 'NumpadSubtract' })), { type: 'zoom', direction: -1 });
});

await check('map: other keys, 0 and 4–9 are not shortcuts', () => {
  for (const [k, code] of [['0', 'Digit0'], ['4', 'Digit4'], ['9', 'Numpad9'], ['a', 'KeyA'], ['Enter', 'Enter'],
    ['Tab', 'Tab'], ['Escape', 'Escape'], ['ArrowUp', 'ArrowUp']]) {
    assert.equal(shortcutFor(key(k, { code })), null, k);
  }
});

await check('modifiers: Ctrl/Cmd/Alt with a key stay with the browser and the OS (Ctrl + is page zoom)', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(shortcutFor(key('+', { code: 'Equal', [mod]: true })), null, mod);
    assert.equal(shortcutFor(key(' ', { code: 'Space', [mod]: true })), null, mod);
    assert.equal(shortcutFor(key('1', { code: 'Digit1', [mod]: true })), null, mod);
  }
});

await check('focus: text fields, selects and editable text keep their keys; buttons and the canvas do not', () => {
  for (const type of ['text', 'search', 'number', '']) assert.equal(isTypingTarget(element('INPUT', { type })), true, type);
  assert.equal(isTypingTarget(element('textarea')), true);
  assert.equal(isTypingTarget(element('SELECT')), true);
  assert.equal(isTypingTarget(element('DIV', { isContentEditable: true })), true);
  for (const type of ['checkbox', 'radio', 'button', 'range']) assert.equal(isTypingTarget(element('INPUT', { type })), false, type);
  assert.equal(isTypingTarget(element('BUTTON')), false);
  assert.equal(isTypingTarget(element('CANVAS')), false);
  assert.equal(isTypingTarget(null), false);
  assert.equal(shortcutFor(key('2', { code: 'Digit2', target: element('INPUT', { type: 'text' }) })), null);
  assert.equal(shortcutFor(key(' ', { code: 'Space', target: element('SELECT') })), null);
  assert.deepEqual(shortcutFor(key(' ', { code: 'Space', target: element('BUTTON') })), { type: 'toggle-pause' });
});

await check('dialogs: inside the pause sheet, settings or a board the keys keep their own meaning', () => {
  const selectors = [];
  const inSheet = element('BUTTON', { closest: (selector) => { selectors.push(selector); return {}; } });
  assert.equal(isInDialog(inSheet), true);
  assert.match(selectors[0], /\[role="dialog"\]/);
  assert.match(selectors[0], /\[aria-modal="true"\]/);
  assert.equal(shortcutFor(key(' ', { code: 'Space', target: inSheet })), null); // Space clicks "Resume" natively
  assert.equal(shortcutFor(key('+', { code: 'Equal', target: inSheet })), null);
  assert.equal(isInDialog(element('BUTTON')), false);
});

await check('screens: pause and speed act only in a running game; zoom also on the airport pick and the game-over map', () => {
  const pause = { type: 'toggle-pause' };
  const speed = { type: 'speed', speed: 2 };
  const zoom = { type: 'zoom', direction: 1 };
  assert.deepEqual(['game', 'upgrade', 'gameover', 'menu'].map((s) => shortcutAllowed(pause, s)), [true, false, false, false]);
  assert.deepEqual(['game', 'upgrade', 'gameover', 'menu'].map((s) => shortcutAllowed(speed, s)), [true, false, false, false]);
  assert.deepEqual(['game', 'upgrade', 'gameover', 'menu'].map((s) => shortcutAllowed(zoom, s)), [true, true, true, false]);
  assert.equal(KEY_ZOOM_STEP, 1.25);
  // One key step is close to one wheel notch (deltaY 100: exp(-0.2) = 0.82 ≈ 1 / 1.25).
  assert.ok(Math.abs(1 / KEY_ZOOM_STEP - Math.exp(-0.2)) < 0.02);
});

function fakeTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
    fire(type, init) {
      const event = { ...key(init.key, init), prevented: false, preventDefault() { this.prevented = true; } };
      listeners.get(type)?.(event);
      return event;
    },
  };
}

await check('listener: handled keys are consumed, refused and unknown keys are not', () => {
  const target = fakeTarget();
  const seen = [];
  let accept = true;
  const detach = attachKeyboardShortcuts(target, (action) => { seen.push(action); return accept; });
  assert.equal(target.fire('keydown', { key: '2', code: 'Digit2' }).prevented, true);
  assert.equal(target.fire('keydown', { key: 'a', code: 'KeyA' }).prevented, false);
  accept = false;
  assert.equal(target.fire('keydown', { key: '+', code: 'Equal' }).prevented, false); // e.g. on the menu: page keeps it
  assert.deepEqual(seen, [{ type: 'speed', speed: 2 }, { type: 'zoom', direction: 1 }]);
  detach();
  assert.equal(target.listeners.size, 0);
});

await check('listener: Space toggles once per press, its release clicks no focused button, held zoom repeats', () => {
  const target = fakeTarget();
  const seen = [];
  attachKeyboardShortcuts(target, (action) => { seen.push(action.type); return true; });
  assert.equal(target.fire('keydown', { key: ' ', code: 'Space' }).prevented, true);
  assert.equal(target.fire('keydown', { key: ' ', code: 'Space', repeat: true }).prevented, true); // no page scroll
  assert.equal(target.fire('keyup', { key: ' ', code: 'Space' }).prevented, true);
  assert.equal(target.fire('keyup', { key: ' ', code: 'Space' }).prevented, false); // nothing pending
  target.fire('keydown', { key: '3', code: 'Digit3', repeat: true });
  target.fire('keydown', { key: '+', code: 'Equal' });
  target.fire('keydown', { key: '+', code: 'Equal', repeat: true });
  assert.deepEqual(seen, ['toggle-pause', 'zoom', 'zoom']);
});

await check('help rows: Space, 1 2 3, + −, Esc, wheel and drag, every text in PL and EN', async () => {
  const { en } = await import('../src/i18n/en.ts');
  const { pl } = await import('../src/i18n/pl.ts');
  assert.deepEqual(SHORTCUT_HELP.map((row) => row.label), ['settings.keys.pause', 'settings.keys.speed', 'settings.keys.zoom',
    'settings.keys.back', 'settings.keys.wheel', 'settings.keys.drag']);
  assert.deepEqual(SHORTCUT_HELP[1].keys, ['1', '2', '3']);
  const keys = ['settings.keys', ...SHORTCUT_HELP.flatMap((row) => [row.label, ...row.keys.filter((cap) => cap.startsWith('settings.keys.'))])];
  for (const id of keys) {
    assert.ok(typeof en[id] === 'string' && en[id].length > 0, `en ${id}`);
    assert.ok(typeof pl[id] === 'string' && pl[id].length > 0 && pl[id] !== en[id], `pl ${id}`);
  }
  assert.equal(en['settings.keys.space'], 'Space');
  assert.equal(pl['settings.keys.space'], 'Spacja');
  assert.deepEqual(ARIA_KEYSHORTCUTS, { pause: 'Space', speed: '1 2 3' });
  assert.match(read('src/ui/settings/settings.ts'), /shortcutList\(\)/);
});

await check('globe canvas: right click opens no browser menu (the game has its own long press)', async () => {
  const win = new EventTarget();
  globalThis.window = win;
  globalThis.requestAnimationFrame ??= () => 0;
  globalThis.cancelAnimationFrame ??= () => {};
  const { attachPointerGestures } = await import('../src/input/gestures.ts');
  const canvas = new EventTarget();
  canvas.style = { touchAction: '' };
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
  const attached = attachPointerGestures(canvas, { hitTest: () => ({ kind: 'empty' }) });
  const menu = new Event('contextmenu', { cancelable: true });
  canvas.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, true);
  attached.dispose();
  const after = new Event('contextmenu', { cancelable: true });
  canvas.dispatchEvent(after);
  assert.equal(after.defaultPrevented, false, 'dispose removes the listener');
  delete globalThis.window;
});

await check('session: shortcuts and hover are wired, and removed on dispose', () => {
  const session = read('src/game/session.ts');
  assert.match(session, /attachKeyboardShortcuts\(window, keyAction\)/);
  assert.match(session, /detachKeys\(\)/);
  assert.match(session, /world\.orbit\.zoomBy\(/);
  assert.match(session, /addEventListener\('pointermove', hoverMove\)/);
  assert.match(session, /removeEventListener\('pointermove', hoverMove\)/);
  assert.match(read('src/ui/hud/boarding-pass.ts'), /aria-keyshortcuts', ARIA_KEYSHORTCUTS\.pause/);
  assert.match(read('src/ui/hud/tag-dock.ts'), /aria-keyshortcuts', ARIA_KEYSHORTCUTS\.speed/);
});

await check('hover CSS: only under (hover: hover), on HUD buttons, airport tags and edge buttons; pointer cursor on the globe', () => {
  const hoverBlock = (css) => {
    const at = css.indexOf('@media (hover: hover)');
    assert.ok(at >= 0, 'no (hover: hover) block');
    return css.slice(at, css.indexOf('}\n}', at) + 3);
  };
  assert.match(hoverBlock(read('src/ui/hud.css')), /\.airway-hud button:not\(:disabled\):hover/);
  const overlay = hoverBlock(read('src/ui/overlay.css'));
  assert.match(overlay, /\.airport-bubble\.is-hover/);
  assert.match(overlay, /\.airport-edge:hover/);
  assert.match(read('src/ui/game.css'), /\.airway-world\[data-hover='city'\][^{]*\{ cursor: pointer; \}/);
  // Every other :hover in these files predates R4g and must not be added outside the media block.
  for (const file of ['src/ui/hud.css', 'src/ui/overlay.css']) {
    const css = read(file);
    const outside = css.replace(hoverBlock(css), '');
    assert.doesNotMatch(outside, /:hover|\.is-hover/, file);
  }
  assert.match(read('src/ui/menu/menu.css'), /@media \(any-hover: none\) \{ \.airway-keys \{ display:none; \} \}/);
});

console.log(`SUMMARY test:keyboard seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);
