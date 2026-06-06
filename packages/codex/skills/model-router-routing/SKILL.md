---
name: model-router-routing
description: Minimal guidance for choosing model-router tiers from Codex.
---

# Model router routing

Use the model-router tiers consistently:

- `@fast` for search, read-only inspection, and quick checks.
- `@medium` for implementation, refactors, and targeted tests.
- `@heavy` for architecture, deep debugging, and multi-step analysis.

Keep dispatch requests explicit. If you need a read cap or other constraint, state it directly in the task.

`tiers.json` in this package is guidance for humans and tooling alignment, not Codex host-enforced runtime configuration.
