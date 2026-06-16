import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as tar from "tar";
import * as yazl from "yazl";

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

function addZipEntries(zipFile, baseDir, relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  const stats = statSync(fullPath);
  const normalizedPath = relativePath.split(path.sep).join("/");
  const metadata = {
    mode: stats.mode,
    mtime: new Date(stats.mtimeMs),
  };

  if (stats.isDirectory()) {
    zipFile.addEmptyDirectory(normalizedPath, metadata);

    for (const name of readdirSync(fullPath).sort()) {
      addZipEntries(zipFile, baseDir, path.join(relativePath, name));
    }

    return;
  }

  zipFile.addFile(fullPath, normalizedPath, { ...metadata, compress: true });
}

function writeZipArchive(archivePath, baseDir, rootEntry) {
  const zipFile = new yazl.ZipFile();

  addZipEntries(zipFile, baseDir, rootEntry);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath);
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }

      settled = true;

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    output.on("close", () => finish());
    output.on("error", finish);
    zipFile.outputStream.on("error", finish);
    zipFile.outputStream.pipe(output);
    zipFile.end();
  });
}

async function writeTarGzArchive(archivePath, baseDir, rootEntry) {
  await tar.create(
    {
      cwd: baseDir,
      file: archivePath,
      gzip: true,
      noPax: true,
      portable: true,
      sort: true,
    },
    [rootEntry],
  );
}

export async function packageClaudePlugin(
  rootDir = repoRoot,
  options = { formats: ["tar.gz", "zip"] },
) {
  const claudeRoot = path.join(rootDir, "packages", "claude");
  const tmpRoot = path.join(rootDir, "tmp", "claude-plugin-package");
  const packageJson = JSON.parse(readFileSync(path.join(claudeRoot, "package.json"), "utf8"));
  const version = packageJson?.version;
  const formats = options.formats ?? ["tar.gz", "zip"];

  if (typeof version !== "string" || !version.trim()) {
    throw new Error("packages/claude/package.json must define a non-empty version.");
  }

  if (!Array.isArray(formats) || formats.length === 0) {
    throw new Error("Claude plugin packaging must request at least one archive format.");
  }

  const folderName = `model-router-claude-${version}`;
  const stageRoot = path.join(tmpRoot, folderName);
  const tarGzPath = path.join(rootDir, "tmp", `${folderName}.tar.gz`);
  const zipPath = path.join(rootDir, "tmp", `${folderName}.zip`);
  const archivePaths = {};

  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });

  for (const relativePath of includePaths) {
    const sourcePath = path.join(claudeRoot, relativePath);

    if (!existsSync(sourcePath)) {
      throw new Error(`Missing Claude plugin packaging input: ${relativePath}`);
    }

    cpSync(sourcePath, path.join(stageRoot, relativePath), { recursive: true });
  }

  mkdirSync(path.dirname(tarGzPath), { recursive: true });

  if (formats.includes("tar.gz")) {
    rmSync(tarGzPath, { force: true });
    await writeTarGzArchive(tarGzPath, tmpRoot, folderName);
    archivePaths.tarGz = tarGzPath;
  }

  if (formats.includes("zip")) {
    rmSync(zipPath, { force: true });
    await writeZipArchive(zipPath, tmpRoot, folderName);
    archivePaths.zip = zipPath;
  }

  return {
    archivePath: archivePaths.tarGz ?? archivePaths.zip,
    archivePaths,
    folderName,
    stageRoot,
    tarGzPath: archivePaths.tarGz ?? null,
    zipPath: archivePaths.zip ?? null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const zipOnly = process.argv.includes("--zip-only");
  const { archivePaths } = await packageClaudePlugin(repoRoot, {
    formats: zipOnly ? ["zip"] : ["tar.gz", "zip"],
  });

  for (const archivePath of Object.values(archivePaths)) {
    console.log(`Created ${path.relative(repoRoot, archivePath)}`);
  }
}
