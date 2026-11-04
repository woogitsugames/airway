// [night-11ad] R7k, D-218: web-sized copies of the real store screenshots (docs/store/shots/, `npm run store:shots`)
// for the landing and press pages: the phone scenes of SITE_SHOTS (site/launch.js) per language, 540×960 JPEG (the 1080×1920 PNGs weigh up to
// 1 MB each). Downscaled in Chromium (Playwright comes from the environment, as for shots:site), so the repository
// needs no image library. Run after every `npm run store:shots`; `npm run test:site` checks size and freshness.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { SITE_SHOTS, PRESS_KIT } from './launch.js';

const root = dirname(fileURLToPath(import.meta.url));
const store = resolve(root, '../docs/store/shots');
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true });
const sources = {};
let written = 0;
try {
  const page = await browser.newPage();
  // [night-11ae] R2e, D-219: + landscape thumbnails for the press page (<scene>-landscape.jpg, 960×540).
  const jobs = SITE_SHOTS.languages.flatMap(language => SITE_SHOTS.scenes.flatMap(scene => [
    { language, scene, format: 'phone', out: `${scene}.jpg`, width: SITE_SHOTS.width, height: SITE_SHOTS.height },
    { language, scene, format: 'landscape', out: `${scene}-landscape.jpg`, ...PRESS_KIT.landscape },
  ]));
  for (const { language, scene, format, out: name, width, height } of jobs) {
    const source = join(store, language, `${scene}-${format}.png`);
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
    }, { png: bytes.toString('base64'), width, height });
    const out = join(root, 'assets/shots', language, name);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(data, 'base64'));
    sources[`${language}/${name}`] = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    written++;
  }
  // [night-11ae] R2e, D-219: PNG renders of the logo SVGs for the press kit; the wordmark's <text> needs Overpass 800,
  // so it is drawn here with the site's OFL font instead of trusting a journalist's installed fonts.
  const font = readFileSync(join(root, 'fonts/Overpass-800.ttf')).toString('base64');
  for (const logo of PRESS_KIT.logos.filter(item => item.source.endsWith('.png'))) {
    const svgSource = PRESS_KIT.logos.find(item => item.name === logo.name.replace(/\.png$/, '.svg')).source;
    const svg = readFileSync(join(root, svgSource), 'utf8');
    const logoPage = await browser.newPage({ viewport: { width: logo.width, height: logo.height }, deviceScaleFactor: 1 });
    await logoPage.setContent(`<style>@font-face{font-family:Overpass;font-weight:800;src:url(data:font/ttf;base64,${font})}
      html,body{margin:0}svg{display:block;width:${logo.width}px;height:${logo.height}px}</style>${svg}`);
    await logoPage.evaluate(() => document.fonts.load('800 100px Overpass'));
    const out = join(root, logo.source);
    mkdirSync(dirname(out), { recursive: true });
    await logoPage.screenshot({ path: out, clip: { x: 0, y: 0, width: logo.width, height: logo.height } });
    await logoPage.close();
    sources[logo.source.replace(/^assets\//, '')] = createHash('sha256').update(svg).digest('hex').slice(0, 16);
    written++;
  }
  // Which store PNG each copy was made from: test:site fails when a store shot changed and the copy did not follow.
  writeFileSync(join(root, 'assets/shots/sources.json'), JSON.stringify(sources, null, 2) + '\n');
} finally {
  await browser.close();
}
console.log(`SUMMARY site:assets files=${written} phone=${SITE_SHOTS.width}x${SITE_SHOTS.height} landscape=${PRESS_KIT.landscape.width}x${PRESS_KIT.landscape.height} failed=0`);
