// UI directions 2026-11 (night 11ah): render mockups/ui-2026-11/<direction>/*.html to
// docs/mockups/ui-2026-11/<direction>/<page>.png at DPR 2, then the contact sheets (sheet-*.html).
// Usage: node mockups/ui-2026-11/shoot.mjs [direction|sheet]
import { readdirSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/')('playwright')); }
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const outRoot = join(repo, 'docs/mockups/ui-2026-11');
const only = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  try { const f = join(repo, decodeURIComponent(req.url.split('?')[0]));
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
async function shoot(urlPath, out, html) {
  const m = html.match(/name="viewport-size" content="(\d+)x(\d+)"/);
  const [w, h] = m ? [Number(m[1]), Number(m[2])] : [412, 915];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DPR || 2) });
  page.on('pageerror', (e) => console.error('  page error', urlPath, e.message));
  page.on('requestfailed', (r) => console.error('  missing', r.url()));
  await page.goto(`http://localhost:${port}${urlPath}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__ready !== false, null, { timeout: 10000 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: out });
  await page.close();
  console.log('shot', out.replace(repo + '/', ''), `${w}x${h}`);
}
for (const dir of readdirSync(here)) {
  const full = join(here, dir);
  if (!statSync(full).isDirectory() || dir === 'common' || (only && only !== 'sheet' && dir !== only)) continue;
  if (only === 'sheet') continue;
  mkdirSync(join(outRoot, dir), { recursive: true });
  for (const file of readdirSync(full).filter((f) => f.endsWith('.html'))) {
    await shoot(`/mockups/ui-2026-11/${dir}/${file}`, join(outRoot, dir, basename(file, '.html') + '.png'), readFileSync(join(full, file), 'utf8'));
  }
}
if (!only || only === 'sheet') {
  for (const file of readdirSync(here).filter((f) => f.startsWith('sheet') && f.endsWith('.html'))) {
    await shoot(`/mockups/ui-2026-11/${file}`, join(outRoot, basename(file, '.html').replace('sheet', 'zestawienie') + '.png'), readFileSync(join(here, file), 'utf8'));
  }
}
await browser.close();
server.close();
