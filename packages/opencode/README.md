# @drwestman/model-router-opencode

OpenCode adapter for model-router.

- Runtime stays intentionally thin.
- Adapter-local config lives in `tiers.json`.
- State is isolated at `~/.config/opencode/opencode-model-router.state.json` unless overridden.
- This package is the reference implementation for the current workspace.
- For local OpenCode development, run `npm run install-opencode:local` from the monorepo root to register `~/.config/opencode/plugins/model-router.js`.
