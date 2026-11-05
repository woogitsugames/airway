// KARTA v2 (night 11ay): render mockups/ui-2026-11/v2/<a|b|c>/*.html to docs/mockups/ui-2026-11/v2/<variant>/<page>.png
// at DPR 2, then the contact sheet (sheet.html -> zestawienie.png).
// Usage: node mockups/ui-2026-11/v2/shoot.mjs [a|b|c|sheet]
import { readdirSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/')('playwright')); }
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const outRoot = join(repo, 'docs/mockups/ui-2026-11/v2');
const only = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
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
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out });
  await page.close();
  console.log('shot', out.replace(repo + '/', ''), `${w}x${h}`);
}
for (const dir of ['a', 'b', 'c']) {
  if (only && only !== dir) continue;
  mkdirSync(join(outRoot, dir), { recursive: true });
  for (const file of readdirSync(join(here, dir)).filter((f) => f.endsWith('.html'))) {
    await shoot(`/mockups/ui-2026-11/v2/${dir}/${file}`, join(outRoot, dir, basename(file, '.html') + '.png'), readFileSync(join(here, dir, file), 'utf8'));
  }
}
if (!only || only === 'sheet') {
  await shoot('/mockups/ui-2026-11/v2/sheet.html', join(outRoot, 'zestawienie.png'), readFileSync(join(here, 'sheet.html'), 'utf8'));
}
await browser.close();
server.close();
