# Claude package

This package ships the Claude plugin variant of model-router.

## Installed command surface

After install, Claude exposes the plugin skills as namespaced commands:

- `/model-router:tiers`
- `/model-router:preset <preset-name>`
- `/model-router:mode <mode-name>`
- `/model-router:bypass on|off`
- `/model-router:annotate-plan <plan text>`
- `/model-router:ponytail-review <change summary>`

These commands are backed by plugin skills under `skills/` and a shared runner under `hooks/run-command.js`.

The existing prompt hook compatibility commands (`/tiers`, `/preset`, `/mode`, `/bypass`, `/annotate-plan`, `/ponytail-review`) remain available when typed directly in Claude.
