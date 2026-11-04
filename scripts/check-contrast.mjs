// WCAG 2.x contrast for every declared text/background token pair.
import { readFileSync } from 'node:fs';

const SEED = '0xA1A1';
const THRESHOLD = 4.5;
const tokens = JSON.parse(readFileSync(new URL('../src/ui/theme/tokens.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../src/ui/theme/theme.css', import.meta.url), 'utf8');
const failures = [];
for (const [token, variable] of Object.entries({
  panel: 'panel', paper: 'paper', dim: 'dim', jam: 'jam', jamText: 'jam-text',
  ticket: 'ticket', ink: 'ink', kraftLabel: 'kraft-label',
  kraftEmpty: 'kraft-empty', kraftEmptyInk: 'kraft-empty-ink', // [night-11n] R5d
})) {
  const match = css.match(new RegExp('--airway-' + variable + '\\s*:\\s*(#[0-9a-fA-F]{6})', 'i'));
  if (!match || match[1].toLowerCase() !== tokens.colors[token].toLowerCase()) {
    failures.push('CSS variable --airway-' + variable + ' differs from token ' + token);
  }
}
function luminance(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Invalid hex colour: ' + hex);
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
if (!Array.isArray(tokens.textPairs) || tokens.textPairs.length < 1) {
  failures.push('No text/background pairs declared');
} else {
  const seen = new Set();
  for (const pair of tokens.textPairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      failures.push('Invalid text pair');
      continue;
    }
    const [fg, bg] = pair;
    if (seen.has(fg + '/' + bg)) failures.push('Duplicate pair ' + fg + '/' + bg);
    seen.add(fg + '/' + bg);
    try {
      const value = contrast(tokens.colors[fg], tokens.colors[bg]);
      if (value < THRESHOLD) failures.push(fg + ' on ' + bg + ': ' + value.toFixed(2));
    } catch (error) {
      failures.push(fg + '/' + bg + ': ' + String(error));
    }
  }
}
for (const message of failures) console.error('FAIL ' + message);
console.log('SUMMARY test:contrast seed=' + SEED + ' pairs=' + (tokens.textPairs?.length ?? 0) +
  ' threshold=' + THRESHOLD + ' passed=' + (failures.length ? 0 : 1) + ' failed=' + failures.length);
if (failures.length) process.exitCode = 1;
