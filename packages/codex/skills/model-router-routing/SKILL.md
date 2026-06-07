---
name: model-router-routing
description: Minimal guidance for choosing model-router tiers from Codex.
---

# Model router routing

When this skill is active, use Codex subagents explicitly instead of only restating routing advice.

Primary built-in Codex agents:

- `explorer` for read-heavy inspection, search, and evidence gathering.
- `worker` for implementation, refactors, and narrow verification.

Experimental project-scoped subagents:

- `router_fast` for search, read-only inspection, and quick evidence gathering.
- `router_medium` for implementation, refactors, and targeted verification.
- `router_heavy` for architecture, deep debugging, and multi-step analysis.

Routing rules:

- Spawn built-in `explorer` when the task starts with exploration, inspection, or file discovery.
- Spawn built-in `worker` when the task is ready for edits or focused test execution.
- Keep `router_fast`, `router_medium`, and `router_heavy` as experimental named custom agents that can be tried when you specifically want to test repo-scoped Codex agents.
- For mixed tasks, split the work: use `explorer` to map the problem, then `worker` for the next phase.
- Ask Codex to wait for spawned agents and then consolidate the result.

- If you try a `router_*` custom agent and Codex does not honor the named custom-agent spawn, fall back to built-in `explorer` for read-heavy work and built-in `worker` for implementation work.
- When you fall back, say so briefly and continue instead of blocking on the custom-agent limitation.

Keep dispatch requests explicit. If you need a read cap or other constraint, state it directly in the spawned agent request.

Primary phrasing: "Spawn built-in `explorer` to inspect `packages/codex` and summarize the current skill and hook behavior, then spawn built-in `worker` to apply the smallest doc fix and run the narrowest relevant tests. Wait for both and summarize the outcome."

Experimental phrasing: "Spawn the custom agent named `router_fast` to inspect `packages/codex` and summarize the current skill and hook behavior, then spawn the custom agent named `router_medium` to apply the smallest doc fix and run the narrowest relevant tests. If Codex does not honor those named custom agents, fall back to built-in `explorer` and built-in `worker`, then wait and summarize."

`tiers.json` in this package is guidance for humans and tooling alignment, not Codex host-enforced runtime configuration.

Do not spawn subagents for trivial one-step work where Codex can finish directly with less overhead.
