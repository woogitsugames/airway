// Build relative assets so the same distribution runs inside Capacitor's WebView.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // [night-12q] D-134: the single main chunk is expected; `npm run test:bundle` enforces its budget instead.
  build: { target: 'es2022', chunkSizeWarningLimit: 1150 },
});
