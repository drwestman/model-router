import type { TierConfig } from "../types.js";
import type { ProviderAdapter } from "./adapter.js";
import {
  buildClaudeOrchestratorPromptPrefix,
  buildClaudeTierPromptPrefix,
} from "./claude.js";

export const anthropicAdapter: ProviderAdapter = {
  name: "anthropic",
  buildOptions(tier: TierConfig): Record<string, unknown> {
    const opts: Record<string, unknown> = {};

    if (tier.thinking?.budgetTokens) {
      opts.budget_tokens = tier.thinking.budgetTokens;
    }

    return opts;
  },
  buildTierPromptPrefix(tierName: string, model: string): string | undefined {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model: string): string | undefined {
    return buildClaudeOrchestratorPromptPrefix(model);
  },
};
