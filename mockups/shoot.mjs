// Render every mockups/<style>/*.html to mockups/<style>/png/<file>.png with Playwright.
// Each page declares its viewport in <meta name="viewport-size" content="412x915">. DPR 2 by default.
import { readdirSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const dpr = Number(process.env.DPR || 2);

const browser = await chromium.launch();
for (const style of readdirSync(root)) {
  const dir = join(root, style);
  if (!statSync(dir).isDirectory() || style === 'lib' || style === 'fonts' || (only && style !== only)) continue;
  const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
  if (!pages.length) continue;
  mkdirSync(join(dir, 'png'), { recursive: true });
  for (const file of pages) {
    const html = readFileSync(join(dir, file), 'utf8');
    const m = html.match(/name="viewport-size" content="(\d+)x(\d+)"/);
    const [w, h] = m ? [Number(m[1]), Number(m[2])] : [412, 915];
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.goto(pathToFileURL(join(dir, file)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const out = join(dir, 'png', basename(file, '.html') + '.png');
    await page.screenshot({ path: out });
    await page.close();
    console.log('shot', out.replace(root + '/', ''), `${w}x${h}@${dpr}`);
  }
}
await browser.close();
