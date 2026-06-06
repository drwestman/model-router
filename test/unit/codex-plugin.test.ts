import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import codexPluginBundle, {
  codexPluginHooksPath,
  codexPluginManifestPath,
  codexPluginRoot,
  codexPluginSkillsPath,
  codexSessionStartHookScriptPath,
  packageDescription,
  packageName,
  packageVersion,
} from "../../packages/codex/src/index.ts";

const manifest = JSON.parse(readFileSync(codexPluginManifestPath, "utf8")) as Record<string, unknown>;
const hooks = JSON.parse(readFileSync(codexPluginHooksPath, "utf8")) as {
  hooks?: Record<string, unknown>;
};
const codexPackageJson = JSON.parse(
  readFileSync(path.join(codexPluginRoot, "package.json"), "utf8"),
) as {
  files?: unknown;
};
const skillPath = path.join(codexPluginSkillsPath, "model-router-routing", "SKILL.md");
const expectedPackageFileEntries = [
  ".codex-plugin/",
  "hooks/",
  "skills/",
  "src/index.ts",
  "README.md",
  "tiers.json",
];
const expectedPackedAssetPaths = [
  ".codex-plugin/plugin.json",
  "hooks/hooks.json",
  "hooks/session-start.mjs",
  "package.json",
  "README.md",
  "skills/model-router-routing/SKILL.md",
  "src/index.ts",
  "tiers.json",
];

function hasScaffoldOnlyWording(value: string): boolean {
  return /scaffold|not implemented yet/i.test(value);
}

function readDryRunPackedFilePaths(): string[] {
  const dryRunPackOutput = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: codexPluginRoot,
    encoding: "utf8",
  });
  const packResults = JSON.parse(dryRunPackOutput) as Array<{
    files?: Array<{
      path?: unknown;
    }>;
  }>;

  assert.equal(packResults.length, 1, "expected one npm pack result");
  assert.ok(Array.isArray(packResults[0]?.files), "npm pack result did not include files");

  return packResults[0].files.flatMap((file) => (typeof file.path === "string" ? [file.path] : []));
}

test("codex plugin bundle exports metadata and safe paths", () => {
  assert.equal(codexPluginBundle.packageName, packageName);
  assert.equal(codexPluginBundle.packageVersion, packageVersion);
  assert.equal(codexPluginBundle.packageDescription, packageDescription);
  assert.equal(codexPluginRoot, path.resolve("packages/codex"));
  assert.ok(codexPluginManifestPath.startsWith(codexPluginRoot));
  assert.ok(codexPluginHooksPath.startsWith(codexPluginRoot));
  assert.ok(codexPluginSkillsPath.startsWith(codexPluginRoot));
  assert.ok(codexSessionStartHookScriptPath.startsWith(codexPluginRoot));
});

test("codex plugin manifest contains only verified fields and safe relative paths", () => {
  assert.deepEqual(Object.keys(manifest).sort(), ["description", "name", "skills", "version"]);
  assert.equal(manifest.name, packageName);
  assert.equal(manifest.version, packageVersion);
  assert.equal(manifest.description, packageDescription);
  assert.equal(manifest.skills, "./skills/");
  assert.match(String(manifest.skills), /^\.\//);
  assert.doesNotMatch(String(manifest.skills), /(^|\/)\.\.(\/|$)/);
});

test("codex plugin skill and hooks exist with expected minimal shape", () => {
  assert.ok(existsSync(skillPath), "skill file missing");
  const skill = readFileSync(skillPath, "utf8");
  assert.match(skill, /^---\nname: model-router-routing\ndescription: .+\n---/);

  assert.ok(existsSync(codexPluginHooksPath), "hooks file missing");
  assert.ok(existsSync(codexSessionStartHookScriptPath), "hook script missing");
  assert.deepEqual(Object.keys(hooks), ["hooks"]);
  assert.ok(Array.isArray(hooks.hooks?.SessionStart), "SessionStart hook must be an array");
  assert.deepEqual(hooks.hooks?.SessionStart, [
    {
      hooks: [
        {
          type: "command",
          command: 'node "${PLUGIN_ROOT}/hooks/session-start.mjs"',
        },
      ],
    },
  ]);
});

test("codex package files avoid scaffold-only wording and entrypoint does not throw", async () => {
  for (const relativePath of ["package.json", "README.md", "tiers.json", "src/index.ts"]) {
    const content = readFileSync(path.join(codexPluginRoot, relativePath), "utf8");
    assert.equal(hasScaffoldOnlyWording(content), false, `${relativePath} contains scaffold-only wording`);
  }

  await assert.doesNotReject(import("../../packages/codex/src/index.ts"));
});

test("codex package packing includes required plugin bundle assets", () => {
  assert.ok(Array.isArray(codexPackageJson.files), "codex package.json must declare files");

  const packageFileEntries = new Set(codexPackageJson.files);
  for (const expectedEntry of expectedPackageFileEntries) {
    assert.ok(packageFileEntries.has(expectedEntry), `${expectedEntry} missing from package.json files`);
  }

  const packedFilePaths = readDryRunPackedFilePaths();
  for (const packedFilePath of packedFilePaths) {
    assert.doesNotMatch(packedFilePath, /(^|\/)\.\.(\/|$)/);
  }

  const packedFilePathSet = new Set(packedFilePaths);
  for (const expectedPackedAssetPath of expectedPackedAssetPaths) {
    assert.ok(
      packedFilePathSet.has(expectedPackedAssetPath),
      `${expectedPackedAssetPath} missing from npm pack --dry-run output`,
    );
  }
});
