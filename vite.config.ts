// Build relative assets so the same distribution runs inside Capacitor's WebView.
import { defineConfig } from 'vite';
// [night-12ap] R3j: package.json's version for the playtest record (src/core/version.ts).
import { version } from './package.json';

export default defineConfig({
  base: './',
  define: { __AIRWAY_VERSION__: JSON.stringify(version) },
  // [night-12q] D-143: the single main chunk is expected; `npm run test:bundle` enforces its budget instead.
  build: { target: 'es2022', chunkSizeWarningLimit: 1150 },
});
