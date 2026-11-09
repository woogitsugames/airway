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
const mime = {'.zip':'application/zip','.jpg':'image/jpeg','.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
// [night-11ad] + the 404 page and the screenshot/store section (full page, preview to footer) for review.
const views = [{name:'site-p.png',width:412,height:915},{name:'site-l.png',width:915,height:412},
  {name:'site-404-p.png',width:412,height:915,path:'missing/page',globe:false},{name:'site-404-l.png',width:1280,height:800,path:'missing/page',globe:false},
  {name:'site-preview-p.png',width:412,height:915,section:'#preview'},{name:'site-preview-l.png',width:1280,height:800,section:'#preview'},
  // [night-11ae] R2e: the press page, whole page (PL portrait, EN landscape).
  {name:'site-press-p.png',width:412,height:915,path:'press.html',globe:false,section:'body'},
  {name:'site-press-l.png',width:1280,height:800,path:'press.html',globe:false,section:'body',lang:'en'}];
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
    } catch {res.writeHead(404,{'Content-Type':'text/html'});res.end(await readFile(join(webRoot,'404.html')));}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const address=server.address();
  const base=`http://127.0.0.1:${address.port}/`;
  browser=await chromium.launch({headless:true,args:['--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  mkdirSync(output,{recursive:true});
  for (const view of views) {
    const page=await browser.newPage({viewport:{width:view.width,height:view.height},deviceScaleFactor:1,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(base+(view.path??'')+'?lang='+(view.lang??'pl'),{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      if (errors.length) throw new Error(errors.join('; '));
      // [night-84a] D-339: the hero is a real store shot (no drawn globe); wait until it is decoded.
      const ready=await page.evaluate(async()=>{const img=document.querySelector('.hero-shot');if(!img)return false;await img.decode().catch(()=>{});return img.naturalWidth>0;});
      if (!ready && view.globe!==false) throw new Error('Hero shot was not loaded');
      if (view.section) {
        // From the section to the end of the page; lazy images loaded first.
        await page.evaluate(async()=>{for(const img of document.images){img.loading='eager';await img.decode().catch(()=>{});}});
        const top=await page.evaluate(s=>document.querySelector(s).getBoundingClientRect().top+scrollY,view.section);
        const height=await page.evaluate(()=>document.documentElement.scrollHeight);
        if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('horizontal overflow');
        await page.screenshot({path:join(output,view.name),fullPage:true,clip:{x:0,y:top,width:view.width,height:height-top},animations:'disabled'});
      } else await page.screenshot({path:join(output,view.name),animations:'disabled'});
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
