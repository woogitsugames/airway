// Build relative assets so the same distribution runs inside Capacitor's WebView.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
