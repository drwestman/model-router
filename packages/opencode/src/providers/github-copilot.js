import { buildClaudeOrchestratorPromptPrefix, buildClaudeTierPromptPrefix, } from "./claude.js";
export const githubCopilotAdapter = {
    name: "github-copilot",
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
