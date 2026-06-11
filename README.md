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
- `claude` and `codex` are honest scaffolds only. They include separate `tiers.json` files and package metadata, but they do not claim unsupported host integrations.
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

## OpenCode local install

Register the OpenCode plugin in the documented global plugin directory:

```bash
npm run install-opencode:local
```

This writes `~/.config/opencode/plugins/model-router.js` and `~/.config/opencode/plugins/package.json`, which make the global plugin directory load as ESM and point at the built adapter from this workspace. Do not also list `"model-router"` in an OpenCode `plugin` array; that uses npm-plugin loading instead of the local plugin directory.

## Verification

Practical repo checks:

```bash
npm run build
npm run typecheck
npm run test:package
```
