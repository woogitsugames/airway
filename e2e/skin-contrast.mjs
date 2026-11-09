// [night-46a] D-301; [night-81a] D-336: the game-over flap and a jammed airport's edge chip reach 4.5:1 (D-47) in the shipped skin
// (formerly test:e2e:roza-contrast, which also measured Róża).
import { withBrowser, newGamePage, waitForScreen, assert } from './browser.mjs';
let passed=0,failed=0;
try { await withBrowser(async ({browser,url}) => {
 const skin='board'; /* [night-81a] D-336: UI-A is the shipped skin */ for (const language of ['en','pl']) {
  const {page,errors}=await newGamePage(browser,url,language,{width:412,height:915});
  try {
   await page.goto(url+'?preview=gameover',{waitUntil:'load'});
   await page.getByTestId('game-over').waitFor(); await page.evaluate(()=>document.fonts.ready);
   await page.waitForSelector('.bd-print .airway-go-flap'); /* [night-81a] D-336: the flap is printed on the report's paper roll */
   const result=await page.evaluate(async()=>{
    const {createAirportOverlay}=await import('/src/ui/overlay.ts'); const {PerspectiveCamera}=await import('/node_modules/three/build/three.module.js');
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:200;pointer-events:none'; document.body.append(host);
    const camera=new PerspectiveCamera(40,412/915,.1,100);camera.position.set(0,0,3.2);camera.lookAt(0,0,0);
    const overlay=createAirportOverlay(host,camera,{});overlay.addAirport({id:'SFO',code:'SFO',lon:180,lat:0,hub:true});overlay.setCapacity('SFO',24);overlay.setPassengers('SFO',['NAM']);overlay.setJamCountdown('SFO',30);overlay.update();
    const flap=document.querySelector('.airway-go-flap'); flap.scrollIntoView({block:'center'}); /* [night-81a] inside the scrolling roll */ const chip=host.querySelector('.airport-edge--jam');
    const ground=(el)=>{for(let n=el;n;n=n.parentElement){const bg=getComputedStyle(n).backgroundColor;if(!/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bg))return bg;}return 'rgb(255, 255, 255)';};
    const colour=(el)=>{const r=el.getBoundingClientRect();return {fg:getComputedStyle(el).color,bg:ground(el),display:getComputedStyle(el).display,hidden:el.hidden,opacity:getComputedStyle(el).opacity,text:el.textContent.trim(),label:el.getAttribute('aria-label'),bounds:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}};
    return {flap:colour(flap),chip:colour(chip),skin:document.documentElement.dataset.skin};
   });
   const rgb=(s)=>s.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
   const lum=(s)=>{const [r,g,b]=rgb(s);return .2126*r+.7152*g+.0722*b};const contrast=(a,b)=>{let [x,y]=[lum(a),lum(b)].sort((a,b)=>b-a);return (x+.05)/(y+.05)};
   assert(result.skin===skin, `skin ${result.skin}`); for(const [name,item] of Object.entries({flap:result.flap,chip:result.chip})) {assert(!item.hidden && item.display!=='none' && item.opacity==='1' && item.text && item.bounds.width>0 && item.bounds.height>0 && item.bounds.left>=0 && item.bounds.top>=0 && item.bounds.right<=412 && item.bounds.bottom<=915,`${name} not visible ${JSON.stringify(item)}`);if(name==='chip') assert(item.label, 'jammed airport chip needs an accessible label');let c=contrast(item.fg,item.bg);assert(c>=4.5,`${name} contrast ${c.toFixed(2)} ${JSON.stringify(item)}`);console.log(`PASS ${skin} ${language} ${name} contrast=${c.toFixed(2)} fg=${item.fg} bg=${item.bg}`);}
   assert(!errors.length,errors.join('; ')); passed++;
  } catch(e){failed++;console.error(`FAIL ${skin} ${language} ${e.message}`);} finally {await page.close();}
 }
},{softwareCompositing:true});} catch(e) { failed++;console.error('FAIL harness '+e.message); }
console.log(`SUMMARY test:e2e:skin-contrast seed=0xA1A1 passed=${passed} failed=${failed}`);if(failed||passed!==2)process.exitCode=1;
