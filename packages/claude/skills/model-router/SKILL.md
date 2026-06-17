---
description: Show the installed model-router Claude plugin command surface and when to use each namespaced command.
disable-model-invocation: true
---

# model-router Claude commands

Use the plugin skills directly after install:

- `/model-router:tiers` — show current preset, mode, bypass, and tier models
- `/model-router:preset <preset-name>` — switch the active preset
- `/model-router:mode <mode-name>` — switch the active mode
- `/model-router:bypass on|off` — toggle routing bypass
- `/model-router:delegate <fast|medium|heavy> <task>` — emit the deterministic delegation template
- `/model-router:annotate-plan <plan text>` — tag plan steps with fast/medium/heavy
- `/model-router:ponytail-review <change summary>` — cut scope to the smallest viable change

Legacy hook commands like `/tiers` and `/preset <name>` still work when typed directly, but the namespaced plugin skills above are the discoverable installed command surface.

Each namespaced skill forwards the same slash command text through the plugin prompt-submit hook, so command execution stays inside the shared bridge without shell approval.
