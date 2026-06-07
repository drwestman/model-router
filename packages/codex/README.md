# @drwestman/model-router-codex

Codex plugin bundle for the model-router monorepo.

This workspace package is intended to be consumed as a Codex plugin bundle from `packages/codex/`. It is not part of the root OpenCode install flow.

This package currently ships bundle assets for Codex plugin installation:

- `.app.json`
- `.codex-plugin/plugin.json`
- `skills/model-router-routing/SKILL.md`
- `hooks/hooks.json`
- `hooks/session-start.mjs`

This repo also defines project-scoped Codex subagents under `.codex/agents/`:

- `router_fast`
- `router_medium`
- `router_heavy`

Codex currently discovers these agents correctly, but explicit spawning may still fall back to a generic built-in agent depending on the current Codex release. For predictable day-to-day use, prefer built-in `explorer` and `worker`. Keep the custom `router_*` agents configured as an experimental path for testing repo-scoped agent behavior.

Current scope:

- package and plugin metadata
- static routing guidance in `tiers.json`
- one informational `SessionStart` hook that adds context after it is trusted
- one focused routing skill

Codex now ships a placeholder `apps` manifest at `.app.json` with `{ "apps": {} }`.

This is placeholder-only wiring until a real Codex app or connector id is available.

## Install in Codex

This repo includes a local marketplace entry at `.agents/plugins/marketplace.json` that points to `./packages/codex`.

To install the plugin in Codex:

1. Restart Codex.
2. Open the plugin directory.
3. Select the `Model Router Local Plugins` marketplace.
4. Install and enable `model-router-codex`.
5. Use the `model-router-routing` skill to verify the plugin skill bundle is available.
6. Open `/hooks` and trust the bundled `SessionStart` hook if you want the session-start reminder context.

If Codex does not show the plugin, verify that the marketplace file still points to `./packages/codex` relative to the repo root.

To use subagent routing reliably today, ask Codex to use the `model-router-routing` skill and spawn built-in `explorer` for read-only work and built-in `worker` for implementation work. Use `router_fast`, `router_medium`, or `router_heavy` only when you explicitly want to test repo-scoped custom-agent behavior.

## After Codex Agent Fix

When Codex reliably honors named custom-agent spawning again, finish this plugin by:

1. Updating the `model-router-routing` skill to prefer `router_fast`, `router_medium`, and `router_heavy` as the primary routing path instead of built-in `explorer` and `worker`.
2. Re-testing that spawned agents actually use the repo-scoped agent profiles from `.codex/agents/` rather than falling back to a generic built-in worker.
3. Verifying that model overrides are honored:
   - `router_fast` -> `gpt-5.4-mini`
   - `router_medium` -> `gpt-5.4`
   - `router_heavy` -> `gpt-5.5`
4. Confirming that the read-only and workspace-write sandbox defaults from the repo agent files are honored in child runs.
5. Updating this README and the root `README.md` to move `router_*` agents from experimental fallback status to the supported primary routing path.
