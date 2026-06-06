import { anthropicAdapter } from "./anthropic.js";
import { githubCopilotAdapter } from "./github-copilot.js";
import { googleAdapter } from "./google.js";
import { openaiAdapter } from "./openai.js";
import { unknownProviderAdapter } from "./unknown.js";
const PROVIDER_ADAPTERS = {
    anthropic: anthropicAdapter,
    "github-copilot": githubCopilotAdapter,
    google: googleAdapter,
    openai: openaiAdapter,
};
function getProviderPrefix(model) {
    const [prefix = ""] = (model ?? "").split("/");
    return prefix.toLowerCase();
}
export function resolveProviderAdapter(model) {
    return PROVIDER_ADAPTERS[getProviderPrefix(model)] ?? unknownProviderAdapter;
}
