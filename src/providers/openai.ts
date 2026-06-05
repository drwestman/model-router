import type { TierConfig } from "../types.js";
import type { ProviderAdapter } from "./adapter.js";
import {
  buildClaudeOrchestratorPromptPrefix,
  buildClaudeTierPromptPrefix,
} from "./claude.js";

export const openaiAdapter: ProviderAdapter = {
  name: "openai",
  buildOptions(tier: TierConfig): Record<string, unknown> {
    const opts: Record<string, unknown> = {};

    if (tier.reasoning?.effort) {
      opts.reasoning_effort = tier.reasoning.effort;
    }
    if (tier.reasoning?.summary) {
      opts.reasoning_summary = tier.reasoning.summary;
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
