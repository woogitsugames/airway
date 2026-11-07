# Free.AI MCP trial (2026-11-07 19:30 UTC → 2026-11-08 19:30 UTC)

Owner, 2026-11-07: the Free.AI MCP connector (self-hosted Qwen3-30B instruct/thinking, ~16K context) is available.
Delegate easier work to it to save Claude limit; test for ~24 h, then report and, if it works, add a usage rule to
CLAUDE.md.

## Tools
- `qwen_summarize` — digest of big inputs read server-side (`gh:woogitsugames/airway@dev/<path>`; branch names with
  `/` fail → use `dev`/`main` or upload a blob). Biggest saver.
- `qwen_review` — first-pass PR review (`github_pr: woogitsugames/airway#NNN`); findings are leads only.
- `qwen_code` — self-contained code/tests/scripts from a precise spec; always run tests on the result.
- `qwen_ask`, `qwen_batch` — text work (drafts, PL/EN strings, classification); `freeai_usage` — usage stats.
- Upload local files: `curl -sf --data-binary @path "<upload URL from the MCP instructions>?name=path"` → `blob:ID`.

## Where to use it (coordinator)
- Before merging an agent PR: `qwen_review` as a first pass, then verify leads myself (tests stay the gate).
- Orientation over long docs/logs (test output, DECISIONS, plans) instead of reading them in full.
- Small, well-specified tasks instead of a Claude agent: i18n string drafts, doc tables, small scripts/tests.
- Keep with Claude: architecture, debugging, UI judgement against the forbidden list, merges, owner questions.

## Log
| UTC | Tool | Task | Result | Saved |
|---|---|---|---|---|
| 11-07 19:25 | qwen_summarize | PLAN-LINORYT.md steps + risks | accurate, missed dependencies line | ~6.2k tokens |
| 11-07 19:24 | qwen_summarize | handover on branch `claude/...` | FAIL: slash in branch name → 404 | — |
| 11-07 19:40 | qwen_review | PR #299 via `github_pr` | FAIL: answered "Sure — what would you like me to create?" (14.7k tokens on their side) | — |
| 11-07 19:42 | qwen_review | PR #299 diff as blob (192 lines) | FAIL: empty answer | — |
| 11-07 19:43 | qwen_ask (thinking) | same diff, bug list | FAIL: empty, "TRUNCATED: raise max_tokens" at 1500 | — |

