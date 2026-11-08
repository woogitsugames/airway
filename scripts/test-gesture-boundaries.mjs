import assert from 'node:assert/strict';
import { GestureRecognizer } from '../src/input/gestures.ts';
let passed = 0, failed = 0;
function test(name, f) { try { f(); passed++; } catch (e) { failed++; console.error('FAIL', name, e); } }
function setup(hit='city') {
  const events=[];
  const g=new GestureRecognizer({hitTest:()=>({kind:hit,id:'LON'}),onRouteStart:()=>events.push('route'),onTap:()=>events.push('tap'),onDoubleTap:()=>events.push('double'),onZoom:(factor)=>events.push(factor),onRotate:()=>events.push('rotate'),onContextMenu:()=>events.push('menu')});
  const send=(type,x,y,timeMs,pointerId=1,pointerType='touch')=>g.handle({type,x,y,timeMs,pointerId,pointerType});
  return {g,events,send};
}
test('drag threshold is radial and strict',()=>{const s=setup();s.send('down',0,0,0);s.send('move',4.8,6.4,20);assert.equal(s.g.currentMode,'press-route');s.send('move',4.81,6.4,21);assert.equal(s.g.currentMode,'route');assert.deepEqual(s.events,['route']);});
test('double tap time boundary',()=>{for(const [dt,expected] of [[260,true],[261,false]]){const s=setup('empty');s.send('down',0,0,0);s.send('up',0,0,10);s.send('down',0,0,10+dt);s.send('up',0,0,11+dt);assert.equal(s.events.includes('double'),expected);}});
test('double tap distance boundary',()=>{for(const [dx,expected] of [[28,true],[28.01,false]]){const s=setup('empty');s.send('down',0,0,0);s.send('up',0,0,10);s.send('down',dx,0,20);s.send('up',dx,0,30);assert.equal(s.events.includes('double'),expected);}});
test('different pointer types do not double tap',()=>{const s=setup('empty');s.send('down',0,0,0);s.send('up',0,0,10);s.send('down',0,0,20,1,'pen');s.send('up',0,0,30,1,'pen');assert.equal(s.events.includes('double'),false);assert.equal(s.events.filter(e=>e==='tap').length,2);});
test('pinch ratio is clamped and last release cannot tap',()=>{const s=setup('empty');s.send('down',0,0,0,1);s.send('down',100,0,1,2);s.send('move',400,0,2,2);assert.equal(s.events.at(-1),1.4);s.send('move',2,0,3,2);assert.equal(s.events.at(-1),0.7);s.send('up',2,0,4,2);s.send('up',0,0,5,1);assert.equal(s.events.includes('tap'),false);assert.equal(s.g.currentMode,'idle');});
test('invalid samples do not enter or corrupt a gesture',()=>{const s=setup();s.send('down',NaN,0,0);assert.equal(s.g.activePointers,0);s.send('down',0,0,0);s.send('move',Infinity,0,1);assert.equal(s.g.currentMode,'press-route');s.send('up',0,0,2);assert.deepEqual(s.events,['tap']);});
test('third pointer blocks until all are released',()=>{const s=setup('empty');s.send('down',0,0,0,1);s.send('down',10,0,1,2);s.send('down',20,0,2,3);assert.equal(s.g.currentMode,'blocked');s.send('up',20,0,3,3);s.send('up',10,0,4,2);s.send('up',0,0,5,1);assert.equal(s.g.currentMode,'idle');assert.equal(s.events.includes('tap'),false);});
console.log(`SUMMARY test:gesture-boundaries seed=0xA1A1 cases=${passed+failed} passed=${passed} failed=${failed}`);
if(failed) process.exitCode=1;

