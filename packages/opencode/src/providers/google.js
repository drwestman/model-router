import { buildClaudeOrchestratorPromptPrefix, buildClaudeTierPromptPrefix, } from "./claude.js";
export const googleAdapter = {
    name: "google",
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
