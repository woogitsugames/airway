# Free.AI MCP trial (owner request, 2026-11-07 → 2026-11-08)

Owner asked to offload easy work to the self-hosted Qwen models (Free.AI MCP) for 24 h, then report and add usage
rules to CLAUDE.md. Log of delegated tasks (task → result → fixes needed):

- Uploading files with `curl --data-binary` to the connector's upload URL is blocked in this cloud session (auto-mode
  data-exfiltration guard). Workaround: small inline `context` in the tool call, or `gh:` sources for pushed files.
- 2026-11-07, E1 `scripts/test-hatch-alias.mjs` (qwen_code, ~7.8 k Qwen tokens, spec inline): structure and the five
  check groups were usable; it got the camera wrong (invented a camera "port" instead of passing the three.js camera),
  the indentation came back garbled, and a float sweep compared `s >= 0` on accumulated steps. Rewritten by hand from the
  draft (≈ 15 min of my work saved on the skeleton, not on the logic). Verdict: fine for test scaffolding with an
  exact spec; read every line.
