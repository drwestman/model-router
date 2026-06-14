# @drwestman/model-router-claude

Claude hook plugin for the monorepo.

## What ships in v1

- `.claude-plugin/plugin.json` with `SessionStart` and `UserPromptSubmit` hooks
- CommonJS hook scripts under `hooks/`
- static routing config in `tiers.json`
- mutable state in `~/.config/claude/model-router.state.json`

## Commands

- `/tiers`
- `/preset <name>`
- `/mode <name>`
- `/bypass on|off`
- `/annotate-plan <text>`
- `/ponytail-review [text]`

## Behavior

- On session start, the plugin emits a compact routing block for the active preset and active routing mode.
- If bypass is on, it emits a short disabled marker instead.
- On prompt submit, the plugin handles the commands above and leaves ordinary prompts untouched.
- `tiers.json` stays static; active preset, mode, and bypass live in the Claude state file.
- Presets choose the model matrix for `fast`, `medium`, and `heavy`.
- Modes choose the routing posture, such as `normal`, `budget`, `quality`, `ponytail`, and `deep`.

## Files

- `.claude-plugin/plugin.json` — Claude hook registration
- `hooks/` — hook runtime
- `skills/model-router/SKILL.md` — lightweight discoverability notes

## Packaging

- Run `npm run package:claude-plugin` from the repo root.
- The script writes `tmp/model-router-claude-<version>.tar.gz`.
- Copy that archive to another computer and unpack it before loading the plugin.

## Local Install

- Run `npm run install:claude-plugin:local` from the repo root to install the current plugin locally.
- On another computer, unpack the archive and run `node install-local.mjs` from the extracted plugin folder.
- The installer copies the plugin into `~/.claude/plugins/cache/model-router/model-router/<version>` and updates `~/.claude/plugins/installed_plugins.json`.
