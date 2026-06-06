# @drwestman/model-router-codex

Codex plugin bundle for the model-router monorepo.

This workspace package is intended to be consumed as a Codex plugin bundle from `packages/codex/`. It is not part of the root OpenCode install flow.

This package currently ships bundle assets for Codex plugin installation:

- `.codex-plugin/plugin.json`
- `skills/model-router-routing/SKILL.md`
- `hooks/hooks.json`
- `hooks/session-start.mjs`

Current scope:

- package and plugin metadata
- static routing guidance in `tiers.json`
- one informational session-start hook
- one focused routing skill

Codex app integration is intentionally deferred until the host manifest schema for `apps` is confirmed.
