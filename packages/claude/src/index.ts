import { createAdapterPaths, packageRootFrom } from "../../core/src/index.js";

export const adapterName = "claude";
export const adapterPaths = createAdapterPaths({
  host: adapterName,
  packageRoot: packageRootFrom(import.meta.url),
  configEnvVar: "CLAUDE_MODEL_ROUTER_CONFIG_PATH",
  stateEnvVar: "CLAUDE_MODEL_ROUTER_STATE_PATH",
  stateDirectorySegments: [".config", "claude"],
  stateFileName: "model-router.state.json",
});

export function createClaudeAdapter() {
  return {
    name: adapterName,
    integration: "claude-plugin-hooks",
    pluginManifest: ".claude-plugin/plugin.json",
  };
}
