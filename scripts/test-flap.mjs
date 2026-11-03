// [task-14] Reproducible Unicode split-flap regression tests, fixed seed 0xA1A1.
// [night-11g] flap.ts imports ./motion now, so it loads through the TS test loader instead of a data: URL.
const { splitFlapCells,planFlapChange,FLAP_DURATION_MS }=await import('../src/ui/flap.ts');
let passed=0,failed=0;
const check=(name,condition)=>{if(condition){passed++;}else{failed++;console.error('FAIL '+name);}};
try {
  check('duration',FLAP_DURATION_MS>=60&&FLAP_DURATION_MS<=90);
  check('Polish glyphs',splitFlapCells('ĄĆĘŁŃÓŚŹŻ').join('')==='ĄĆĘŁŃÓŚŹŻ');
  check('decomposed NFC',splitFlapCells('A\u0328').join('')==='Ą');
  check('surrogate pairs',splitFlapCells('A𐐀B').length===3);
  check('spaces',splitFlapCells('LOT BEZ KOŃCA').length===13);
  check('empty',splitFlapCells('').length===0);
  check('zero limit',splitFlapCells('abc',0).length===0);
  check('single limit',splitFlapCells('abc',1).join('')==='…');
  check('truncation',splitFlapCells('abcdef',4).join('')==='abc…');
  check('unchanged',planFlapChange('B4','B4').length===0);
  check('one letter',planFlapChange('B4','C4').length===1);
  check('stagger',planFlapChange('ABC','XYZ').map(s=>s.delay).join(',')==='0,24,48');
  check('Polish change',planFlapChange('ZÓŁĆ','ŻÓŁĆ')[0]?.to==='Ż');
  check('shortening',planFlapChange('ABC','A').length===2);
  let threw=false;try{splitFlapCells('A',-1);}catch(e){threw=e instanceof RangeError;}
  check('invalid limit throws',threw);
} catch(error){failed++;console.error(error);}
console.log(`SUMMARY test:flap seed=0xA1A1 passed=${passed} failed=${failed}`);
if(failed)process.exitCode=1;
