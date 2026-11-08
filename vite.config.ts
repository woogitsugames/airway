// Build relative assets so the same distribution runs inside Capacitor's WebView.
import { defineConfig } from 'vite';
// [night-12ap] R3j: package.json's version for the playtest record (src/core/version.ts).
import { version } from './package.json';
// [night-11ar] D-252: release CSS with the UI skin tokens written in place (scripts/vite-skin-inline.mjs).
import { skinInline } from './scripts/vite-skin-inline.mjs';
// [night-11ax] D-257: dist/ ships the WOFF2 fonts only (scripts/vite-font-files.mjs).
import { fontFiles } from './scripts/vite-font-files.mjs';
// [night-70a R1] D-323: dist/ leaves out the NASA globe preview textures until the flip (scripts/vite-globe-preview.mjs).
import { globePreview } from './scripts/vite-globe-preview.mjs';

export default defineConfig({
  base: './',
  plugins: [skinInline(), fontFiles(), globePreview()],
  define: { __AIRWAY_VERSION__: JSON.stringify(version) },
  // [night-12q] D-143 (limit D-252): the single main chunk is expected; `npm run test:bundle` enforces its budget instead.
  build: { target: 'es2022', chunkSizeWarningLimit: 1180 },
});
