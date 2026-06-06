# Agent Notes

- Repo is an OpenCode plugin; the runtime entrypoint is `packages/opencode/src/index.ts` and it exports the default plugin function.
- Configuration lives in `packages/opencode/tiers.json`; `packages/opencode/src/index.ts` validates and loads it at runtime.
- The plugin persists user-selected preset/mode in `~/.config/opencode/opencode-model-router.state.json`; do not edit `tiers.json` for session state.
- This repo uses npm: `package-lock.json` is present and `package.json` has no scripts.
- There is no repo-defined build/test/lint/typecheck command or `tsconfig*.json`; do not invent project scripts.
- `npm install` is the setup command.
- `node_modules/` and `dist/` are ignored; do not commit generated output.
- Keep `packages/opencode/tiers.json` and `README.md` aligned with behavior in `packages/opencode/src/index.ts` when changing routing, commands, caps, presets, or modes.
- The `docs/` folder is explanatory, not authoritative; prefer `packages/opencode/src/index.ts` and `packages/opencode/tiers.json` when docs conflict.
