# Model Router

Use model-router session commands to inspect or change the active Claude routing state.

Commands:

- `/tiers` shows available presets and modes
- `/preset <name>` switches the active preset
- `/mode <name>` switches the active routing mode
- `/bypass on|off` disables or re-enables routing output
- `/annotate-plan <text>` tags plan steps with `[tier:fast]`, `[tier:medium]`, or `[tier:heavy]`
- `/ponytail-review [text]` returns a short simplicity review or checklist

State persists in `~/.config/claude/model-router.state.json`.
