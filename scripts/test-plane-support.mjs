// Load the task-09 pure modules through the shared TypeScript test loader.
import './ts-test-loader.mjs';

async function planeModules() {
  return {
    params: await import('../src/sim/params.ts'),
    planes: await import('../src/sim/planes.ts'),
    schedule: await import('../src/sim/schedule.ts'),
  };
}

export async function harness(name, seed, testSuite) {
  let passed = 0;
  let failed = 0;
  const check = (label, run) => {
    try {
      run();
      passed++;
    } catch (error) {
      failed++;
      console.error(`FAIL ${label}:`, error);
    }
  };
  try {
    testSuite(await planeModules(), check);
  } catch (error) {
    failed++;
    console.error('FAIL load:', error);
  }
  console.log(`SUMMARY test:${name} seed=${seed} cases=${passed + failed} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
