import type { TierConfig } from "../types.js";
import type { ProviderAdapter } from "./adapter.js";
import {
  buildClaudeOrchestratorPromptPrefix,
  buildClaudeTierPromptPrefix,
} from "./claude.js";

export const unknownProviderAdapter: ProviderAdapter = {
  name: "unknown",
  buildOptions(_tier: TierConfig): Record<string, unknown> {
    return {};
  },
  buildTierPromptPrefix(tierName: string, model: string): string | undefined {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model: string): string | undefined {
    return buildClaudeOrchestratorPromptPrefix(model);
  },
};
