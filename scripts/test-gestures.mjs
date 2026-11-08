// [task-04] Seeded pointer-state-machine regression suite (no browser required).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const seed = '0xA1A1';
async function load(path) {
  const raw = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const js = ts.transpileModule(raw, { fileName: path, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const { GestureRecognizer } = await load('src/input/gestures.ts');
const { GlobeOrbitCamera, clampCameraDpr } = await load('src/render/camera.ts');
let passed = 0, failed = 0;
function test(name, f) { try { f(); passed++; } catch (e) { failed++; console.error('FAIL', name, e); } }
function seq(hit = 'empty', extras = {}) {
  const ev = [];
  const cb = {
    hitTest: (x,y,r) => { ev.push(['hit',r]); return {kind:hit,id:'LON'}; },
    onRotate: (...p) => ev.push(['rotate',...p]),
    onZoom: f => ev.push(['zoom',f]),
    onRouteStart: () => ev.push(['start']),
    onRouteMove: () => ev.push(['move']),
    onRouteEnd: () => ev.push(['end']),
    onRouteCancel: reason => ev.push(['cancel',reason]),
    onContextMenu: h => ev.push(['menu',h.kind]),
    onInteractionChange: (a,i) => ev.push(['active',a,i]),
    onDoubleTap: () => ev.push(['double']),
    ...extras,
  };
  const g = new GestureRecognizer(cb);
  const send = (type,x=100,y=100,timeMs=0,pointerId=1,pointerType='touch',button=0) => g.handle({type,x,y,timeMs,pointerId,pointerType,button});
  const events = name => ev.filter(e=>e[0]===name);
  return {ev,g,send,events};
}
function fakeCamera() {
  return { fov:30,aspect:1, position:{set(){}},up:{set(){}},lookAt(){},setViewOffset(...a){this.offset=a;},updateProjectionMatrix(){} };
}
for (const hit of ['city','route-handle']) test('edit '+hit,()=>{
  const s=seq(hit);s.send('down');s.send('move',108,100,10);assert.equal(s.events('start').length,0);
  s.send('move',111,100,20);s.send('up',111,100,35);
  assert.equal(s.events('start').length,1);assert.equal(s.events('end').length,1);assert.equal(s.events('rotate').length,0);
});
for(const hit of ['empty','route-body']) test('orbit '+hit,()=>{
  const s=seq(hit);s.send('down');s.send('move',120,112,20);s.send('up',120,112,30);
  assert.equal(s.events('rotate').length,1);assert.equal(s.events('start').length,0);
});
test('350 ms long press',()=>{const s=seq('route-body');s.send('down');s.g.advanceTime(349);assert.equal(s.events('menu').length,0);s.g.advanceTime(350);assert.equal(s.events('menu').length,1);});
// [night-08d] A down handled late (it waited behind a long frame) or a late frame never turns a quick drag
// into a long press; a steadily slow device still gets the menu.
test('long press counts from the handled down',()=>{const s=seq('city');s.g.handle({type:'down',x:100,y:100,timeMs:0,handledMs:400,pointerId:1,pointerType:'touch',button:0});s.g.advanceTime(405);assert.equal(s.events('menu').length,0);s.send('move',130,100,420);assert.equal(s.events('start').length,1);assert.equal(s.events('menu').length,0);});
test('handled-late press still opens after 350 ms',()=>{const s=seq('route-body');s.g.handle({type:'down',x:100,y:100,timeMs:0,handledMs:400,pointerId:1,pointerType:'touch',button:0});s.g.advanceTime(405);s.g.advanceTime(740);assert.equal(s.events('menu').length,0);s.g.advanceTime(751);assert.equal(s.events('menu').length,1);});
test('late frame defers the long press one frame',()=>{const s=seq('city');s.send('down');s.g.advanceTime(16);s.g.advanceTime(480);assert.equal(s.events('menu').length,0);s.send('move',130,100,470);assert.equal(s.events('start').length,1);s.g.advanceTime(496);assert.equal(s.events('menu').length,0);});
// [night-55a] D-313: the release after a stalled frame (the e2e hub-board map case: rAF 1020 → 1454 ms, up at 1414) is
// judged at its own time; a short press lifted during a stall stays a tap.
test('release after a stalled frame keeps the long press',()=>{const s=seq('city');s.send('down');s.g.advanceTime(16);s.send('up',100,100,453);assert.equal(s.events('menu').length,1);assert.equal(s.events('start').length,0);});
test('short press during a stalled frame stays a tap',()=>{const taps=[];const s=seq('city',{onTap:()=>taps.push(1)});s.send('down');s.g.advanceTime(16);s.send('up',100,100,300);assert.equal(s.events('menu').length,0);assert.equal(taps.length,1);});
test('slow frames still open the long press',()=>{const s=seq('route-body');s.send('down');for(const t of [150,300,450])s.g.advanceTime(t);assert.equal(s.events('menu').length,0);s.g.advanceTime(600);assert.equal(s.events('menu').length,1);});
test('city tap does not draw',()=>{const s=seq('city');s.send('down');s.send('up',100,100,10);assert.equal(s.events('start').length,0);});
test('pinch cancels a route',()=>{const s=seq('city');s.send('down');s.send('move',140,100,20);s.send('down',230,100,70,2);s.send('move',280,100,90,2);assert.equal(s.events('cancel')[0][1],'pinch');assert.ok(s.events('zoom').length);});
test('pinch before route starts',()=>{const s=seq('city');s.send('down');s.send('down',130,100,60,2);assert.equal(s.events('start').length,0);});
test('double tap hold zooms',()=>{const s=seq();s.send('down');s.send('up',100,100,20);s.send('down',100,100,100);s.send('move',100,65,140);assert.ok(s.events('zoom')[0][1]>1);assert.equal(s.events('rotate').length,0);});
test('double tap zooms',()=>{const s=seq();s.send('down');s.send('up',100,100,20);s.send('down',100,100,100);s.send('up',100,100,120);assert.equal(s.events('double').length,1);});
test('one hand zoom out',()=>{const s=seq();s.send('down');s.send('up',100,100,20);s.send('down',100,100,100);s.send('move',100,140,140);assert.ok(s.events('zoom')[0][1]<1);});
test('mouse right button ignored',()=>{const s=seq();s.send('down',100,100,0,1,'mouse',2);assert.equal(s.g.activePointers,0);});
test('pointer cancel clears edit',()=>{const s=seq('city');s.send('down');s.send('move',130,100,20);s.send('cancel',130,100,30);assert.equal(s.events('cancel')[0][1],'cancel');assert.equal(s.g.activePointers,0);});
test('edge dwell & capped turn',()=>{const ev=[];const s=seq('city',{getLimbEdgeFactor:()=>1,onEdgeRotate:d=>ev.push(d)});s.send('down');s.send('move',130,100,20);s.g.advanceTime(100);s.g.advanceTime(230);assert.equal(ev.length,1);assert.ok(ev[0]<=3.6);});
test('stationary orbit release no inertia',()=>{const s=seq();s.send('down');s.send('move',140,100,20);s.send('up',140,100,300);assert.deepEqual(s.events('active').at(-1),['active',false,false]);});
for (const [w,h] of [[412,915],[915,412],[673,841],[904,1000]]) test('viewport '+w+'x'+h,()=>{
  const c=fakeCamera(),g=new GlobeOrbitCamera(c);g.setViewport(w,h,{top:45,bottom:85});assert.equal(c.aspect,w/h);assert.equal(c.offset.length,6);
});
for(const zoom of [1,1.5,2,3,4]) test('zoom '+zoom,()=>{const c=fakeCamera(),g=new GlobeOrbitCamera(c);g.setZoom(zoom);assert.equal(g.getState().zoom,zoom);});
test('zoom clamps',()=>{const g=new GlobeOrbitCamera(fakeCamera());g.setZoom(99);assert.equal(g.getState().zoom,4);g.setZoom(-1);assert.equal(g.getState().zoom,1);});
test('tilt increases',()=>{const g=new GlobeOrbitCamera(fakeCamera());const t=g.getState().tiltDegrees;g.setZoom(4);assert.ok(g.getState().tiltDegrees>t);});
test('DPR clamps',()=>{assert.equal(clampCameraDpr(9),2);assert.equal(clampCameraDpr(0),1);assert.equal(clampCameraDpr(NaN),1);});
test('interaction stops camera drifting',()=>{const g=new GlobeOrbitCamera(fakeCamera());g.beginInteraction();g.rotatePixels(80,0,16);const p=g.getState().longitude;g.update(1);assert.equal(g.getState().longitude,p);g.endInteraction(true);g.update(0.05);assert.notEqual(g.getState().longitude,p);});
test('fit resets zoom',()=>{const g=new GlobeOrbitCamera(fakeCamera());g.setZoom(3);g.fitNetwork([{lon:0,lat:0},{lon:20,lat:30}]);assert.equal(g.getState().zoom,1);});
test('edge no inertia',()=>{const g=new GlobeOrbitCamera(fakeCamera());g.rotateAtLimb(3);const p=g.getState().longitude;g.update(0.1);assert.equal(g.getState().longitude,p);});
test('duplicate down ignored',()=>{const s=seq();s.send('down');s.send('down',100,100,1);assert.equal(s.g.activePointers,1);});
console.log(`SUMMARY test:gestures seed=${seed} cases=${passed+failed} passed=${passed} failed=${failed}`);
if(failed)process.exitCode=1;
