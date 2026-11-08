import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGame, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { cityDistanceKm } from '../src/data/index.ts';
import { PLANE_TYPES } from '../src/sim/params.ts';
import { encodeSave, decodeSave, saveSourceFromSim, restoreSimFromSave } from '../src/game/save.ts';

const START = 0xA1A1, COUNT = 200, END = 90, MID = 45;
const counts = { routes:0, aircraft:0, undo:0, speed:0, upgrades:0 };
function rng(seed) { let state = seed >>> 0; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; }; }
function invariants(sim) {
  for (const c of sim.world.cities()) {
    assert.ok(Number.isSafeInteger(c.waiting) && c.waiting >= 0, `waiting ${c.id}`);
    assert.ok(Number.isSafeInteger(c.capacity) && c.capacity >= 0, `capacity ${c.id}`);
    for (const n of Object.values(c.waitingByRegion)) assert.ok(Number.isSafeInteger(n) && n >= 0);
  }
  for (const plane of sim.world.planes) assert.ok(Number.isSafeInteger(plane.load) && plane.load >= 0 && plane.load <= PLANE_TYPES[plane.type].seats, `plane load ${plane.id}`);
  for (const n of Object.values(sim.world.reserve)) assert.ok(Number.isSafeInteger(n) && n >= 0);
}
function selectRoute(sim, random) {
  const cities = sim.world.cities(), pairs = [];
  for (const a of cities) for (const b of cities) if (a.id !== b.id) {
    const cmd = {type:'AddRoute', cityIds:[a.id,b.id]}; if (sim.check(cmd).ok) pairs.push(cmd);
  }
  return pairs.length ? pairs[random() % pairs.length] : null;
}
function action(sim, random, index, tally) {
  let expectedEvent = null;
  if (index === 0) {
    const cmd = selectRoute(sim, random); if (cmd) { sim.apply(cmd); tally.routes++; expectedEvent='RouteAdded'; }
  } else if (index === 2 || index === 4) {
    const routes = sim.world.routes(), r = routes[random() % Math.max(routes.length,1)];
    if (r) for (const aircraft of ['turboprop','widebody']) {
      const cmd={type:'AssignPlane', routeId:r.id, aircraft};
      if (sim.check(cmd).ok) { sim.apply(cmd); tally.aircraft++; expectedEvent='PlaneAssigned'; break; }
    }
  } else if (index === 3) {
    if (sim.undo()) tally.undo++;
  } else if (index % 7 === 0) {
    const speed = [1,2,4][random() % 3]; sim.apply({type:'SetSpeed',speed}); tally.speed++;
  }
  sim.tick(); const events=sim.drainEvents();
  if (expectedEvent) assert.ok(events.some(e=>e.type===expectedEvent), `missing ${expectedEvent} for seed ${sim.seed}`);
  if (index % 10 === 0 || index === END-1) invariants(sim);
}
function run(seed, roundTrip, tally) {
  let sim=createGame(seed); const random=rng(seed ^ 0x9E3779B9);
  for(let i=0;i<END;i++) {
    action(sim,random,i,tally);
    if (i === MID-1 && roundTrip) {
      const old = sim.hash(), decoded = decodeSave(JSON.stringify(encodeSave(saveSourceFromSim(sim),0)));
      assert.equal(decoded.status,'ok'); sim=restoreSimFromSave(decoded.save); assert.ok(sim); assert.equal(sim.hash(),old);
    }
  }
  const hash=sim.hash(), log=sim.getCommandLog();
  assert.equal(Sim.replay(seed,log,sim.tickCount).hash(),hash,`journal seed ${seed}`);
  return hash;
}
function weekly(seed) {
  const sim=createGame(seed), random=rng(seed ^ 0xD15EA5E);
  while (sim.tickCount < TICKS_PER_WEEK + 2 && sim.world.status !== 'over') {
    const w=sim.world;
    if (w.status === 'upgrade' && w.offer && !sim.pendingCount) {
      const offers=w.offer.offers.filter(x=>x.id==='turboprop'||x.id==='widebody');
      assert.ok(offers.length,'weekly offer has an aircraft');
      const cmd={type:'ChooseUpgrade',week:w.offer.week,upgrade:offers[random()%offers.length].id};
      sim.apply(cmd); counts.upgrades++;
    } else if (sim.tickCount % 60 === 0 && w.status==='running') {
      const cities=w.cities(), linked=cities.filter(c=>c.routes>0);
      for (const city of cities.filter(c=>c.routes===0)) {
        const targets=(linked.length?linked:cities).filter(c=>c.id!==city.id).map(c=>({id:c.id,km:cityDistanceKm(city.id,c.id)})).sort((a,b)=>a.km-b.km);
        const target=targets[0]; if (!target) continue;
        const cmd={type:'AddRoute',cityIds:[city.id,target.id],aircraft:target.km<=2500?'turboprop':'widebody'};
        if(sim.check(cmd).ok) { sim.apply(cmd); break; }
      }
      if (!sim.pendingCount) for (const route of w.routes()) {
        for (const aircraft of ['turboprop','widebody']) {
          const cmd={type:'AssignPlane',routeId:route.id,aircraft};
          if(sim.check(cmd).ok) {sim.apply(cmd); break;}
        }
        if(sim.pendingCount) break;
      }
    }
    sim.tick(); sim.drainEvents();
    if (sim.tickCount % 120 === 0) invariants(sim);
  }
  assert.ok(counts.upgrades>0,`seed ${seed} did not reach weekly upgrade`);
  assert.ok(sim.world.upgrades.length>0,'upgrade was not accepted');
  assert.equal(Sim.replay(seed,sim.getCommandLog(),sim.tickCount).hash(),sim.hash());
  return sim.hash();
}
const began=performance.now(), hashes=[];
try {
  for(let i=0;i<COUNT;i++) {
    const seed=START+i, a=run(seed,false,counts), b=run(seed,true,{routes:0,aircraft:0,undo:0,speed:0});
    assert.equal(a,b,`seed ${seed}`); hashes.push(a);
  }
  const weeklyHash=weekly(0xA1A3);
  assert.ok(counts.routes>=COUNT && counts.aircraft>=COUNT && counts.undo>=COUNT && counts.speed>=COUNT);
  const digest=createHash('sha256').update(hashes.join('\n')+'\n'+weeklyHash).digest('hex');
  assert.equal(digest,'4dcadbfdc3bf28100ae29b642459420416e5ac81695ff2809ee83456cfecfa49','hashes changed from origin/dev 316d556');
  console.log(`INFO hashes=${digest} weekly=${weeklyHash} actions=${JSON.stringify(counts)} durationMs=${Math.round(performance.now()-began)}`);
  console.log(`SUMMARY test:sim-fuzz seed=0xA1A1 seeds=${COUNT} passed=1 failed=0`);
} catch (error) {
  console.error('FAIL sim fuzz',error);
  console.log(`SUMMARY test:sim-fuzz seed=0xA1A1 seeds=${COUNT} passed=0 failed=1`); process.exitCode=1;
}
