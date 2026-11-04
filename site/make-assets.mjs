// [night-11ad] R7k, D-214: web-sized copies of the real store screenshots (docs/store/shots/, `npm run store:shots`)
// for the landing and press pages: the phone scenes of SITE_SHOTS (site/launch.js) per language, 540×960 JPEG (the 1080×1920 PNGs weigh up to
// 1 MB each). Downscaled in Chromium (Playwright comes from the environment, as for shots:site), so the repository
// needs no image library. Run after every `npm run store:shots`; `npm run test:site` checks size and freshness.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { SITE_SHOTS } from './launch.js';

const root = dirname(fileURLToPath(import.meta.url));
const store = resolve(root, '../docs/store/shots');
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true });
const sources = {};
let written = 0;
try {
  const page = await browser.newPage();
  for (const language of SITE_SHOTS.languages) for (const scene of SITE_SHOTS.scenes) {
    const source = join(store, language, `${scene}-phone.png`);
    const bytes = readFileSync(source);
    const data = await page.evaluate(async ({ png, width, height }) => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + png;
      await image.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.84).split(',')[1];
    }, { png: bytes.toString('base64'), width: SITE_SHOTS.width, height: SITE_SHOTS.height });
    const out = join(root, 'assets/shots', language, `${scene}.jpg`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(data, 'base64'));
    sources[`${language}/${scene}.jpg`] = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    written++;
  }
  // Which store PNG each copy was made from: test:site fails when a store shot changed and the copy did not follow.
  writeFileSync(join(root, 'assets/shots/sources.json'), JSON.stringify(sources, null, 2) + '\n');
} finally {
  await browser.close();
}
console.log(`SUMMARY site:assets shots=${written} size=${SITE_SHOTS.width}x${SITE_SHOTS.height} failed=0`);
