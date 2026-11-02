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

// Serve the repo root over HTTP so pages can use ES modules (three.js, d3-geo) from node_modules.
import { createServer } from 'node:http';
const repo = join(root, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  try { const f = join(repo, decodeURIComponent(req.url.split('?')[0])); const ext = f.slice(f.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' }); res.end(readFileSync(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
let glBrowser = null; // WebGL pages (three.js) need SwiftShader; plain SVG pages render faster without it
const glb = async () => glBrowser ||= await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
    const page = await (html.includes('__ready') ? await glb() : browser).newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    page.on('pageerror', (e) => console.error('  page error', file, e.message));
    await page.goto(`http://localhost:${port}/mockups/${style}/${file}`);
    await page.evaluate(() => document.fonts.ready);
    if (html.includes('__ready')) await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    await page.waitForTimeout(150);
    const out = join(dir, 'png', basename(file, '.html') + '.png');
    await page.screenshot({ path: out });
    await page.close();
    console.log('shot', out.replace(root + '/', ''), `${w}x${h}@${dpr}`);
  }
}
await browser.close();
if (glBrowser) await glBrowser.close();
server.close();
