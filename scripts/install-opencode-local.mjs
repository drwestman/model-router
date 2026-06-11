import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pluginSourcePath = join(rootDir, "packages", "opencode", "src", "index.js");
const globalConfigDir = join(homedir(), ".config", "opencode");
const globalPluginDir = join(globalConfigDir, "plugins");
const globalPluginPath = join(globalPluginDir, "model-router.js");
const pluginSourceUrl = pathToFileURL(pluginSourcePath).href;

mkdirSync(globalPluginDir, { recursive: true });
writeFileSync(
  globalPluginPath,
  [
    '"use strict";',
    "",
    `const pluginSourceUrl = ${JSON.stringify(pluginSourceUrl)};`,
    "",
    "async function ModelRouterPlugin(ctx) {",
    "  const pluginModule = await import(pluginSourceUrl);",
    "  return pluginModule.default(ctx);",
    "}",
    "",
    "module.exports = {",
    "  ModelRouterPlugin,",
    "};",
    "",
  ].join("\n"),
  "utf8",
);

const globalConfigPath = join(globalConfigDir, "opencode.json");
const stalePluginWarnings = [];

try {
  const raw = JSON.parse(readFileSync(globalConfigPath, "utf8"));
  if (Array.isArray(raw?.plugin) && raw.plugin.includes("model-router")) {
    stalePluginWarnings.push(
      `${globalConfigPath} still lists "model-router" in the plugin array; remove it to avoid duplicate loading.`,
    );
  }
} catch {}

const projectConfigPath = join(rootDir, ".opencode", "opencode.json");
try {
  const raw = JSON.parse(readFileSync(projectConfigPath, "utf8"));
  if (Array.isArray(raw?.plugin) && raw.plugin.includes("model-router")) {
    stalePluginWarnings.push(
      `${projectConfigPath} still lists "model-router" in the plugin array; remove it to avoid duplicate loading.`,
    );
  }
} catch {}

console.log(`Installed OpenCode plugin loader at ${globalPluginPath}`);
console.log(`Loader target: ${pluginSourcePath}`);

for (const warning of stalePluginWarnings) {
  console.warn(`Warning: ${warning}`);
}
