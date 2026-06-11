# Agent Notes

- Repo is a private npm workspace monorepo; root `package.json` is the workspace container and runtime code lives under `packages/*`.
- Workspace packages are `core`, `opencode`, `claude`, and `codex`; `claude` and `codex` are scaffolds, while `opencode` is the implemented/reference adapter.
- The OpenCode runtime entrypoint is `packages/opencode/src/index.ts`; it exports the default plugin function and validates/loads `packages/opencode/tiers.json`.
- The plugin persists user-selected preset/mode in `~/.config/opencode/opencode-model-router.state.json`; do not use `tiers.json` for session state.
- Setup is `npm install`.
- Main verification commands are `npm run build`, `npm run typecheck`, `npm run test:package`, and `npm test` (`pretest` runs build + typecheck first).
- `npm run install-opencode:local` performs the supported local OpenCode install flow: `prepack` first, then installs the loader into `~/.config/opencode/plugins/model-router.js`.
- `node_modules/` and `dist/` are ignored; do not commit generated output.
- Keep `packages/opencode/tiers.json` and `README.md` aligned with behavior in `packages/opencode/src/index.ts` when changing routing, commands, caps, presets, or modes.
- `docs/` is explanatory, not authoritative; prefer `packages/opencode/src/index.ts` and `packages/opencode/tiers.json` when docs conflict.
