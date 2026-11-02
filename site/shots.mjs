// [task-29] Browser screenshots of the landing page; Playwright is environment-provided.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, '../docs/shots/29');
const require = createRequire(import.meta.url);
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const views = [{name:'site-p.png',width:412,height:915},{name:'site-l.png',width:915,height:412}];
let server, browser, count=0, failed=0;
try {
  const { chromium } = require('playwright');
  const webRoot = resolve(root,'dist');
  server=createServer(async(req,res)=>{
    try {
      const raw=new URL(req.url||'/', 'http://127.0.0.1');
      const requestPath=raw.pathname==='/'?'/index.html':raw.pathname;
      const absolute=resolve(webRoot, '.'+decodeURIComponent(requestPath));
      if (!absolute.startsWith(webRoot+'/')) {res.writeHead(403);res.end();return;}
      const body=await readFile(absolute);
      res.writeHead(200,{'Content-Type':mime[extname(absolute)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const address=server.address();
  const url=`http://127.0.0.1:${address.port}/?lang=pl`;
  browser=await chromium.launch({headless:true,args:['--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  mkdirSync(output,{recursive:true});
  for (const view of views) {
    const page=await browser.newPage({viewport:{width:view.width,height:view.height},deviceScaleFactor:1,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(url,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      if (errors.length) throw new Error(errors.join('; '));
      const ready=await page.evaluate(()=>Boolean(document.querySelector('.hero-visual.globe-ready')));
      if (!ready) throw new Error('Globe was not mounted');
      await page.screenshot({path:join(output,view.name),animations:'disabled'});
      console.log(`shot docs/shots/29/${view.name} ${view.width}x${view.height}`);
      count++;
    } finally {await page.close();}
  }
} catch(error){failed++;console.error(error instanceof Error?error.message:String(error));}
finally {
  if(browser)await browser.close();
  if(server)await new Promise(done=>server.close(done));
  console.log(`SUMMARY shots:site seed=0xA1A1 captured=${count} failed=${failed}`);
  if(failed)process.exitCode=1;
}
