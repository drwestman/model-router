import { buildClaudeOrchestratorPromptPrefix, buildClaudeTierPromptPrefix, } from "./claude.js";
export const anthropicAdapter = {
    name: "anthropic",
    buildOptions(tier) {
        const opts = {};
        if (tier.thinking?.budgetTokens) {
            opts.budget_tokens = tier.thinking.budgetTokens;
        }
        return opts;
    },
    buildTierPromptPrefix(tierName, model) {
        return buildClaudeTierPromptPrefix(tierName, model);
    },
    buildOrchestratorPromptPrefix(model) {
        return buildClaudeOrchestratorPromptPrefix(model);
    },
};
