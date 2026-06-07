# model-router monorepo

This repository is now an npm workspace monorepo with lockstep versioning.

## Workspace packages

- `packages/core` → `@drwestman/model-router-core`
- `packages/opencode` → `@drwestman/model-router-opencode`
- `packages/claude` → `@drwestman/model-router-claude`
- `packages/codex` → `@drwestman/model-router-codex`

All packages are currently private.

## Current state

- `core` contains host-agnostic config validation, policy resolution, prompt rendering, model normalization, and generic state helpers.
- `opencode` is the active implemented adapter package with adapter-local config and host-isolated state defaults.
- `claude` is still an honest scaffold only.
- `codex` is a minimal Codex plugin bundle package with a manifest, one skill, and one informational hook.
- The root package is now only the private workspace container. Runtime code lives under `packages/`.

## Config and state

- OpenCode adapter config: `packages/opencode/tiers.json`
- Claude adapter config: `packages/claude/tiers.json`
- Codex adapter config: `packages/codex/tiers.json`

Default state locations are isolated per host:

- OpenCode: `~/.config/opencode/opencode-model-router.state.json`
- Claude: `~/.config/claude/claude-model-router.state.json`
- Codex: `~/.config/codex/codex-model-router.state.json`

## Install

```bash
npm install
```

## Verification

Practical repo checks:

```bash
npm run build
npm run typecheck
npm run test:package
```

## Codex Plugin

This repo includes a local Codex marketplace entry at `.agents/plugins/marketplace.json` that points to `./packages/codex`.

The repo also defines project-scoped Codex subagents in `.codex/agents/`:

- `router_fast`
- `router_medium`
- `router_heavy`

Depending on the current Codex release, explicit spawning of these named custom agents may still fall back to generic built-in agents. The intended fallback is built-in `explorer` for read-heavy work and built-in `worker` for implementation work.

To use the plugin in Codex:

1. Restart Codex.
2. Open the plugin directory.
3. Select `Model Router Local Plugins`.
4. Install and enable `model-router-codex`.
5. Open `/hooks` and trust the bundled hook.
6. Invoke the `model-router-routing` skill to verify the plugin is available.

When the skill is active, Codex should prefer built-in `explorer` for read-heavy work and built-in `worker` for implementation work. The repo's `router_fast`, `router_medium`, and `router_heavy` agents remain available as an experimental path for testing custom-agent behavior.

After the upstream Codex custom-agent spawning issue is resolved, the next cleanup step is to switch the skill back to preferring `router_fast`, `router_medium`, and `router_heavy`, verify that named custom-agent spawns honor the repo-scoped models and sandbox settings, and then update the docs to move `router_*` from experimental status to the supported primary routing path.
