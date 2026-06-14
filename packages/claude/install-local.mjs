import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const claudeRoot = path.dirname(fileURLToPath(import.meta.url));
const pluginManifestPath = path.join(claudeRoot, ".claude-plugin", "plugin.json");

const pluginManifest = JSON.parse(readFileSync(pluginManifestPath, "utf8"));
const pluginName = pluginManifest.name;
const pluginVersion = pluginManifest.version;

const claudePluginsRoot = path.join(homedir(), ".claude", "plugins");
const cacheRoot = path.join(claudePluginsRoot, "cache", pluginName, pluginName);
const installPath = path.join(cacheRoot, pluginVersion);
const registryPath = path.join(claudePluginsRoot, "installed_plugins.json");

const includePaths = [
  ".claude-plugin",
  "hooks",
  "tiers.json",
  "skills",
  "README.md",
  "install-local.mjs",
];

function loadRegistry() {
  try {
    const parsed = JSON.parse(readFileSync(registryPath, "utf8"));

    if (parsed && typeof parsed === "object" && parsed.plugins && typeof parsed.plugins === "object") {
      return parsed;
    }
  } catch {}

  return {
    version: 2,
    plugins: {},
  };
}

function copyPluginFiles() {
  rmSync(installPath, { recursive: true, force: true });
  mkdirSync(installPath, { recursive: true });

  for (const relativePath of includePaths) {
    const sourcePath = path.join(claudeRoot, relativePath);

    if (!existsSync(sourcePath)) {
      throw new Error(`Missing Claude plugin install input: ${relativePath}`);
    }

    cpSync(sourcePath, path.join(installPath, relativePath), { recursive: true });
  }
}

function updateRegistry() {
  const registry = loadRegistry();
  const now = new Date().toISOString();
  const key = `${pluginName}@${pluginName}`;

  registry.version = 2;
  registry.plugins[key] = [
    {
      scope: "user",
      installPath,
      version: pluginVersion,
      installedAt: now,
      lastUpdated: now,
    },
  ];

  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

copyPluginFiles();
updateRegistry();

console.log(`Installed Claude plugin at ${installPath}`);
console.log(`Updated Claude plugin registry at ${registryPath}`);
console.log("Open Claude Code, then use /plugins to confirm the plugin is available.");
