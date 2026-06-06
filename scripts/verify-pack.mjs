import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cacheDir = mkdtempSync(join(tmpdir(), "opencode-model-router-npm-cache-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const allowedFiles = [
  "LICENSE",
  "README.md",
  "package.json",
  "packages/opencode/README.md",
  "packages/opencode/package.json",
  "packages/opencode/src/generated/build-info.json",
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

try {
  const output = execFileSync(
    npmCommand,
    ["--cache", cacheDir, "pack", "--dry-run", "--json"],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: process.env,
    },
  );
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
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}
