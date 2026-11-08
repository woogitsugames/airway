// [night-52a] Wall-clock budgets in fast tests. Under V8 coverage (`npm run coverage:fast` sets NODE_V8_COVERAGE)
// every function is instrumented and runs several times slower, so a per-frame or per-week budget measures the
// instrumentation, not the code. There a budget is reported as an INFO line and not enforced; every other run
// (test:fast, test:ci, a single suite) still enforces it.

/** True when this process writes V8 coverage (NODE_V8_COVERAGE set and non-empty). */
export const coverageRun = (env = process.env) => Boolean(env.NODE_V8_COVERAGE);

/**
 * Checks `ms` against `budgetMs` (strictly below with `strict`, otherwise at most). Returns true when the budget holds
 * or when it is not enforced (coverage run); in that case it logs `INFO <label>: … not enforced under V8 coverage`.
 */
export function withinBudget(label, ms, budgetMs, { strict = false, env = process.env, log = console.log } = {}) {
  const ok = strict ? ms < budgetMs : ms <= budgetMs;
  if (ok || !coverageRun(env)) return ok;
  log(`INFO ${label}: ${ms.toFixed(3)} ms over the ${budgetMs} ms budget, not enforced under V8 coverage (NODE_V8_COVERAGE)`);
  return true;
}
