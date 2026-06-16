---
description: Toggle model-router Claude bypass on or off.
disable-model-invocation: true
argument-hint: on|off
---

!`node "${CLAUDE_PLUGIN_ROOT}/hooks/run-command.js" bypass "$ARGUMENTS"`

Return exactly the command output above with no additional text.
