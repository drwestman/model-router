import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

export const codexPluginName = "model-router-codex";
export const packageName = "@drwestman/model-router-codex";
export const packageVersion = "1.1.18";
export const packageDescription = "Private Codex plugin bundle for model-router";
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const codexPluginRoot = packageRoot;
export const codexPluginManifestPath = join(codexPluginRoot, ".codex-plugin", "plugin.json");
export const codexPluginSkillsPath = join(codexPluginRoot, "skills");
export const codexPluginHooksPath = join(codexPluginRoot, "hooks", "hooks.json");
export const codexSessionStartHookScriptPath = join(codexPluginRoot, "hooks", "session-start.mjs");

const codexPluginBundle = {
  codexPluginName,
  packageName,
  packageVersion,
  packageDescription,
  packageRoot,
  codexPluginRoot,
  codexPluginManifestPath,
  codexPluginSkillsPath,
  codexPluginHooksPath,
  codexSessionStartHookScriptPath,
} as const;

export default codexPluginBundle;
