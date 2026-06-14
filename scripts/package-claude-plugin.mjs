import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const claudeRoot = path.join(repoRoot, "packages", "claude");
const tmpRoot = path.join(repoRoot, "tmp", "claude-plugin-package");

const packageJson = await import(path.join(claudeRoot, "package.json"), {
  with: { type: "json" },
});

const version = packageJson.default.version;
const folderName = `model-router-claude-${version}`;
const stageRoot = path.join(tmpRoot, folderName);
const archivePath = path.join(repoRoot, "tmp", `${folderName}.tar.gz`);

const includePaths = [
  ".claude-plugin",
  "hooks",
  "tiers.json",
  "skills",
  "README.md",
  "install-local.mjs",
];

rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(stageRoot, { recursive: true });

for (const relativePath of includePaths) {
  const sourcePath = path.join(claudeRoot, relativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing Claude plugin packaging input: ${relativePath}`);
  }

  cpSync(sourcePath, path.join(stageRoot, relativePath), { recursive: true });
}

mkdirSync(path.dirname(archivePath), { recursive: true });
rmSync(archivePath, { force: true });

execFileSync("tar", ["-czf", archivePath, "-C", tmpRoot, folderName], {
  stdio: "inherit",
});

console.log(`Created ${path.relative(repoRoot, archivePath)}`);
