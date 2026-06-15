import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const includePaths = [
  ".claude-plugin",
  "hooks",
  "tiers.json",
  "skills",
  "README.md",
  "install-local.mjs",
];

export function packageClaudePlugin(rootDir = repoRoot) {
  const claudeRoot = path.join(rootDir, "packages", "claude");
  const tmpRoot = path.join(rootDir, "tmp", "claude-plugin-package");
  const packageJson = JSON.parse(readFileSync(path.join(claudeRoot, "package.json"), "utf8"));
  const version = packageJson?.version;

  if (typeof version !== "string" || !version.trim()) {
    throw new Error("packages/claude/package.json must define a non-empty version.");
  }

  const folderName = `model-router-claude-${version}`;
  const stageRoot = path.join(tmpRoot, folderName);
  const archivePath = path.join(rootDir, "tmp", `${folderName}.tar.gz`);

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

  return { archivePath, folderName, stageRoot };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { archivePath } = packageClaudePlugin();

  console.log(`Created ${path.relative(repoRoot, archivePath)}`);
}
