import { buildClaudeOrchestratorPromptPrefix, buildClaudeTierPromptPrefix, } from "./claude.js";
export const openaiAdapter = {
    name: "openai",
    buildOptions(tier) {
        const opts = {};
        if (tier.reasoning?.effort) {
            opts.reasoning_effort = tier.reasoning.effort;
        }
        if (tier.reasoning?.summary) {
            opts.reasoning_summary = tier.reasoning.summary;
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
