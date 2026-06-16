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
- `/model-router:annotate-plan <plan text>` — tag plan steps with fast/medium/heavy
- `/model-router:ponytail-review <change summary>` — cut scope to the smallest viable change

Legacy hook commands like `/tiers` and `/preset <name>` still work when typed directly, but the namespaced plugin skills above are the discoverable installed command surface.

If a namespaced command reports that skill shell execution is disabled, enable Claude Code skill shell execution for this plugin.
