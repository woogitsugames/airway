// Render the UI-B "Karta lotnicza w świecie" mockups (2026-11c): 412x915 CSS px at deviceScaleFactor 2 (824x1830 PNG),
// plus the overview sheet. Usage: node docs/styles/kierunki-2026-11c/makiety/ui-b/src/shoot.mjs [night|day|menu|week|report|sheet]
// Needs `npm ci` (three, d3-geo, topojson-client, world-atlas), the NASA textures (../../src/fetch-textures.sh) and
// Playwright 1.63 + Chromium from the environment (WebGL through SwiftShader).
import { readFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/')('playwright')); }
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..', '..', '..');
const out = join(here, '..');
const rel = '/docs/styles/kierunki-2026-11c/makiety/ui-b/src';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer((req, res) => {
  try {
    const f = join(repo, decodeURIComponent(req.url.split('?')[0]));
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.argv.slice(2);

async function shoot(url, file, w, h, dpr) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => console.error('  page error', e.message));
  page.on('console', (m) => console.log('  console', m.type(), m.text()));
  await page.goto(`http://localhost:${port}${url}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, file) });
  await page.close();
  console.log('shot', file);
}

const FRAMES = { night: 'ui-b-gra-noc.png', day: 'ui-b-gra-dzien.png', menu: 'ui-b-menu.png', week: 'ui-b-tydzien.png', report: 'ui-b-raport.png' };
for (const [f, file] of Object.entries(FRAMES)) {
  if (only.length && !only.includes(f)) continue;
  await shoot(`${rel}/frame.html?f=${f}${process.env.DBG ? '&debug' : ''}`, file, 412, 915, 2);
}
if (!only.length || only.includes('sheet')) await shoot(`${rel}/sheet.html`, 'zestawienie-ui-b.png', 2300, 1180, 1.25);
await browser.close(); server.close();
