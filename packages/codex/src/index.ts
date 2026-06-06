import { createAdapterPaths, packageRootFrom } from "../../core/src/index.js";

export const adapterName = "codex";
export const adapterPaths = createAdapterPaths({
  host: adapterName,
  packageRoot: packageRootFrom(import.meta.url),
  configEnvVar: "CODEX_MODEL_ROUTER_CONFIG_PATH",
  stateEnvVar: "CODEX_MODEL_ROUTER_STATE_PATH",
  stateDirectorySegments: [".config", "codex"],
  stateFileName: "codex-model-router.state.json",
});

export function createCodexAdapter(): never {
  throw new Error(
    "@drwestman/model-router-codex is a scaffold only; the Codex host API integration is not implemented yet.",
  );
}
