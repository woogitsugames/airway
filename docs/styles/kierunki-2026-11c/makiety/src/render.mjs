// Renders the K3 mockups with Chromium (SwiftShader WebGL). Not shipped; docs only.
// usage: K3_DEPS=<dir with node_modules (three) + data/ (day.jpg relief.png lights.png borders.json)> node render.mjs [out-dir] [shots...]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const deps = process.env.K3_DEPS; const out = process.argv[2] || path.join(here, '..');
const only = process.argv.slice(3);
const roots = [deps, here, path.join(here, '..')];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'k3.html';
  for (const r of roots) { const f = path.join(r, p); if (f.startsWith(r) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); return fs.createReadStream(f).pipe(res); } }
  res.statusCode = 404; res.end();
}).listen(0);
const port = srv.address().port;
const SHOTS = { 'k3-gra-dzien': 'scene=game', 'k3-menu': 'scene=menu', 'k3-gra-noc': 'scene=game&mode=night' };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, q] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); pg.on('console', m => console.log('[page]', m.text())); pg.on('pageerror', e => console.log('[err]', e.message));
  await pg.goto(`http://localhost:${port}/k3.html?${q}`); await pg.waitForFunction('window.__ready===true', null, { timeout: 120000 });
  await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(out, name + '.png') }); await ctx.close(); console.log('ok', name);
}
await b.close(); srv.close();
