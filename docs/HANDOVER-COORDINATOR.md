# Coordinator handover (2026-11-03, end of weekly limit)

State at handover: `main` = `dev` = `b73aacf` (Merge PR #119). No running agents, no worktrees with unsaved work.

## Role
The coordinator session keeps **one** Opus agent continuously developing Airway from `docs/NIGHT-BACKLOG.md`
(owner: "pracuj autonomicznie, z jednym agentem który non stop rozwija") and regularly fast-forwards `main` to green `dev` (D-64).

## Loop
1. Launch one background Opus agent with the brief below; when it reports, launch the next one.
2. Every ~30 min (two hourly scheduled tasks at :15 and :45 in the old session, now **disabled**; re-create them in the new session):
   - if the agent finished/died → read its report, launch a new one;
   - if `origin/main` is an ancestor of `origin/dev` and every first-parent commit in `origin/main..origin/dev` is
     "Merge pull request #…", run `git push origin origin/dev:refs/heads/main` **without running tests**;
   - reply to the owner in ≤ 2 Polish lines only when something changed.

## Agent brief (essentials)
- Worktree `/workspace/night-NN` on branch `night/NN-slug` from `origin/dev`; `npm ci` there; never commit node_modules/symlinks.
- Implement, add a focused test that fails on the old code, register it in package.json + docs/TESTING.md (+ test:fast if fast headless).
- Tick the item and add a log line with real test counts in docs/NIGHT-BACKLOG.md; commit as `Claude <noreply@anthropic.com>`.
- PR to `dev` with a Polish description; self-merge with a merge commit after its gate; remove the worktree.
- **Minimal-CI rule (owner):** per PR run `test:fast` + `build` once on the final merged tree; e2e / ui:matrix / balance /
  store:shots only when the change touches that area; never repeat a green run; never `test:ci`; never GitHub Actions.
- Never push `main`; never touch PRs it did not open (#52, #88, #89 belong to another session); a single agent, no subagents.
- If the queue is empty, find new items by playing (`ui:long-play`) and reading screenshots; respect every hard rule in CLAUDE.md.

## Last work (N10t–N11c, PRs #110–#119)
Timeline from live command outcomes, overlay tag reuse, edge chips clear of airports/tags/dock on foldables, next-puzzle
button and board scroll, no globe render behind full-screen pages, game over at an unserved airport, map view after game over.

## Blocked / waiting
- N9d (airline colour on planes) waits for PR #52 (M1, another session's draft).
- Drafts #88 (M2 tutorial) and #89 (M3 accessibility) are unfinished work of another session — leave them unless the owner says otherwise.
- Ranking screen waits for a real Firebase test (Q-06).
- The DEV bot rarely connects new airports (long plays end in weeks 1–3); improving it shifts the balance median (D-79).
- Owner-only: Q-01 data controller, Q-07 Firebase project/budget, Q-34 trademark check, device APK test, Q-37/38/39/40.

## Notes
- The main checkout `/workspace/airway` was on another session's branch `docs/owner-decisions-4`; don't work there.
- Next free decision number: D-82. Owner questions: `docs/OWNER-QUESTIONS.md`. Branch cleanup list: `docs/BRANCH-AUDIT.md`.
