# Claude package

This package ships the Claude plugin variant of model-router.

## Installed command surface

After install, Claude exposes the plugin skills as namespaced commands:

- `/model-router:tiers`
- `/model-router:preset <preset-name>`
- `/model-router:mode <mode-name>`
- `/model-router:bypass on|off`
- `/model-router:delegate <fast|medium|heavy> <task>`
- `/model-router:annotate-plan <plan text>`
- `/model-router:ponytail-review <change summary>`

These commands are backed by plugin skills under `skills/`, which forward the same namespaced slash command text through the shared Claude bridge in `src/bridge.cjs`.

The existing prompt hook compatibility commands (`/tiers`, `/preset`, `/mode`, `/bypass`, `/delegate`, `/annotate-plan`, `/ponytail-review`) remain available when typed directly in Claude.

On regular prompts, the submit hook now scores the task against deterministic fast/medium/heavy patterns. Moderate confidence adds a short routing hint. Very high confidence injects the full delegation template. Ambiguous prompts inject nothing.

Delegation stays honest when native Claude subagents are unavailable: the injected template explicitly falls back to doing the same scoped work locally.
