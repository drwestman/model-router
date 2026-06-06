import { buildClaudeOrchestratorPromptPrefix, buildClaudeTierPromptPrefix, } from "./claude.js";
export const unknownProviderAdapter = {
    name: "unknown",
    buildOptions(_tier) {
        return {};
    },
    buildTierPromptPrefix(tierName, model) {
        return buildClaudeTierPromptPrefix(tierName, model);
    },
    buildOrchestratorPromptPrefix(model) {
        return buildClaudeOrchestratorPromptPrefix(model);
    },
};
