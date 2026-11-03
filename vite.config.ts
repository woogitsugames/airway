// Build relative assets so the same distribution runs inside Capacitor's WebView.
import { defineConfig } from 'vite';
// [m3] D-55: UI font sizes follow the text-size setting (--airway-text-scale), see the plugin header.
import { textScalePlugin } from './scripts/lib/postcss-text-scale.mjs';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  css: { postcss: { plugins: [textScalePlugin()] } },
});
