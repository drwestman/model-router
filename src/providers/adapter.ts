import type { TierConfig } from "../types.js";

export interface ProviderAdapter {
  readonly name: string;
  buildOptions(tier: TierConfig): Record<string, unknown>;
  buildTierPromptPrefix(tierName: string, model: string): string | undefined;
  buildOrchestratorPromptPrefix(model: string): string | undefined;
}
