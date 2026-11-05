// Build relative assets so the same distribution runs inside Capacitor's WebView.
import { defineConfig } from 'vite';
// [night-12ap] R3j: package.json's version for the playtest record (src/core/version.ts).
import { version } from './package.json';
// [night-11ar] D-252: release CSS with the UI skin tokens written in place (scripts/vite-skin-inline.mjs).
import { skinInline } from './scripts/vite-skin-inline.mjs';

export default defineConfig({
  base: './',
  plugins: [skinInline()],
  define: { __AIRWAY_VERSION__: JSON.stringify(version) },
  // [night-12q] D-143 (limit D-252): the single main chunk is expected; `npm run test:bundle` enforces its budget instead.
  build: { target: 'es2022', chunkSizeWarningLimit: 1180 },
});
