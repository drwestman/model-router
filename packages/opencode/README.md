# @drwestman/model-router-opencode

OpenCode adapter for model-router.

- Runtime stays intentionally thin.
- Adapter-local config lives in `tiers.json`.
- State is isolated at `~/.config/opencode/opencode-model-router.state.json` unless overridden.
- `/budget ponytail` persists `activeMode=ponytail` in that existing OpenCode state; no Ponytail-specific config file is used.
- In Ponytail mode, `fast`, `medium`, and `heavy` get runtime simplification prompts for delegated subagent sessions, configured under `modes.ponytail.tierPrompts` in `tiers.json`.
- `/ponytail-review` is a transient prompt-only command for over-engineering review with `delete`, `stdlib`, `native`, `yagni`, and `shrink` tags.
- This package is the reference implementation for the current workspace.
- For local OpenCode development, run `npm run install-opencode:local` from the monorepo root to register `~/.config/opencode/plugins/model-router.js` as a CommonJS loader that dynamically imports the built adapter.
