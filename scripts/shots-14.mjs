// [task-14] Capture the actual running main menu at the two required viewport sizes.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const samples=[{name:'menu-p.png',width:412,height:915},{name:'menu-l.png',width:915,height:412}];
let server,browser,captured=0,failed=0;
async function choosePort(){
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const addr=probe.address();if(!addr||typeof addr==='string')throw new Error('Port unavailable');
  await new Promise(done=>probe.close(done));return addr.port;
}
async function waitForServer(port){
  for(let attempt=0;attempt<120;attempt++){
    if(server.exitCode!==null)throw new Error('Vite stopped unexpectedly');
    try {const result=await fetch(`http://127.0.0.1:${port}/`);if(result.ok)return;}
    catch { /* Startup retry. */ }
    await new Promise(done=>setTimeout(done,250));
  }
  throw new Error('Vite readiness timeout');
}
try {
  const {chromium}=require('playwright');
  const port=await choosePort();
  server=spawn(process.execPath,[resolve(ROOT,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:ROOT,stdio:'inherit'});
  await waitForServer(port);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  mkdirSync(resolve(ROOT,'docs/shots/14'),{recursive:true});
  for(const sample of samples){
    const page=await browser.newPage({viewport:{width:sample.width,height:sample.height},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.addInitScript(()=>localStorage.setItem('airway.settings',JSON.stringify({language:'pl'})));
    try{
      await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
      await page.waitForSelector('.airway-board .airway-flight');
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(1100);
      if(errors.length)throw new Error(errors.join('; '));
      await page.screenshot({path:resolve(ROOT,'docs/shots/14',sample.name),animations:'disabled'});
      console.log(`shot docs/shots/14/${sample.name} ${sample.width}x${sample.height}`);captured++;
    }finally{await page.close();}
  }
}catch(error){failed++;console.error(error instanceof Error?error.message:String(error));}
finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null)server.kill('SIGTERM');
  console.log(`SUMMARY shots:14 seed=0xA1A1 captured=${captured} failed=${failed}`);
  if(failed)process.exitCode=1;
}
