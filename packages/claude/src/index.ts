import { createAdapterPaths, packageRootFrom } from "../../core/src/index.js";

export const adapterName = "claude";
export const adapterPaths = createAdapterPaths({
  host: adapterName,
  packageRoot: packageRootFrom(import.meta.url),
  configEnvVar: "CLAUDE_MODEL_ROUTER_CONFIG_PATH",
  stateEnvVar: "CLAUDE_MODEL_ROUTER_STATE_PATH",
  stateDirectorySegments: [".config", "claude"],
  stateFileName: "claude-model-router.state.json",
});

export function createClaudeAdapter(): never {
  throw new Error(
    "@drwestman/model-router-claude is a scaffold only; the Claude host API integration is not implemented yet.",
  );
}
