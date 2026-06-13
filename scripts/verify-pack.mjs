import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cacheDir = mkdtempSync(join(tmpdir(), "opencode-model-router-npm-cache-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const allowedFiles = [
  "LICENSE",
  "README.md",
  "index.cjs",
  "package.json",
  "packages/opencode/README.md",
  "packages/opencode/package.json",
  "packages/opencode/src/generated/build-info.json",
  "packages/opencode/src/index.bundle.cjs",
  "packages/opencode/src/index.cjs",
  "packages/opencode/src/index.js",
  "packages/opencode/src/providers/adapter.js",
  "packages/opencode/src/providers/anthropic.js",
  "packages/opencode/src/providers/claude.js",
  "packages/opencode/src/providers/github-copilot.js",
  "packages/opencode/src/providers/google.js",
  "packages/opencode/src/providers/index.js",
  "packages/opencode/src/providers/openai.js",
  "packages/opencode/src/providers/unknown.js",
  "packages/opencode/src/templates/delegation-protocol.md",
  "packages/opencode/tiers.json",
];

const runNpm = (args, env = process.env) =>
  execFileSync(npmCommand, args, {
    cwd: rootDir,
    encoding: "utf8",
    env,
  });

try {
  const output = runNpm(["--cache", cacheDir, "pack", "--dry-run", "--json"]);
  const manifest = JSON.parse(output);
  assert.ok(Array.isArray(manifest) && manifest.length > 0, "npm pack returned no manifest");

  const entries = manifest[0]?.files;
  assert.ok(Array.isArray(entries), "npm pack manifest did not include files");

  const packagedFiles = entries
    .map((entry) => entry.path)
    .sort();

  assert.deepEqual(
    packagedFiles,
    allowedFiles.slice().sort(),
    `unexpected package contents:\n${JSON.stringify(packagedFiles, null, 2)}`,
  );

  const homeDir = mkdtempSync(join(tmpdir(), "opencode-model-router-home-"));

  try {
    runNpm(["run", "install-opencode:local"], {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
    });

    const pluginsDir = join(homeDir, ".config", "opencode", "plugins");
    const loaderPath = join(pluginsDir, "model-router.js");
    const pluginsPackageJsonPath = join(pluginsDir, "package.json");
    const pluginsPackageJson = JSON.parse(readFileSync(pluginsPackageJsonPath, "utf8"));

    assert.equal(pluginsPackageJson.type, "module", "plugins/package.json must set type=module");

    const pluginModule = await import(pathToFileURL(loaderPath).href);
    assert.equal(typeof pluginModule.default, "function", "plugin loader must default export a plugin");
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}
