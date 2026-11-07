// Render the 2026-11b art-direction mockups to PNG (1080x1920, deviceScaleFactor 1) and the contact sheet.
// Usage: node docs/styles/kierunki-2026-11b/src/shoot.mjs [a|b|c|sheet] [game|menu]
// Needs `npm ci` (d3-geo, topojson-client, world-atlas) and Playwright 1.63 + Chromium from the environment.
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/')('playwright')); }
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const out = join(here, '..', 'png');
const rel = '/docs/styles/kierunki-2026-11b/src';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  try {
    const f = join(repo, decodeURIComponent(req.url.split('?')[0]));
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const [only, onlyFrame] = process.argv.slice(2);

async function shoot(url, file, w = 1080, h = 1920) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('  page error', url, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('  console', m.text()); });
  await page.goto(`http://localhost:${port}${url}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(out, file) });
  await page.close();
  console.log('shot', file);
}

for (const d of ['a', 'b', 'c']) {
  if (only && only !== d) continue;
  for (const f of ['game', 'menu']) {
    if (onlyFrame && onlyFrame !== f) continue;
    await shoot(`${rel}/frame.html?d=${d}&f=${f}`, `${d}-${f}.png`);
  }
}
if (!only || only === 'sheet') await shoot(`${rel}/sheet.html`, 'zestawienie.png', 2400, 2060);
await browser.close(); server.close();
