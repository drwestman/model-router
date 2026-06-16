import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

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

function writeString(buffer, offset, length, value) {
  Buffer.from(value).copy(buffer, offset, 0, length);
}

function writeOctal(buffer, offset, length, value) {
  const digits = Math.max(0, value).toString(8);
  writeString(buffer, offset, length, `${digits.padStart(length - 1, "0")}\0`);
}

function writeChecksum(buffer) {
  buffer.fill(32, 148, 156);

  const sum = buffer.reduce((total, byte) => total + byte, 0);
  const digits = sum.toString(8).padStart(6, "0");

  writeString(buffer, 148, 8, `${digits}\0 `);
}

function setPathFields(buffer, entryPath) {
  if (Buffer.byteLength(entryPath) <= 100) {
    writeString(buffer, 0, 100, entryPath);
    return;
  }

  const segments = entryPath.split("/");

  for (let index = segments.length - 1; index > 0; index -= 1) {
    const prefix = segments.slice(0, index).join("/");
    const name = segments.slice(index).join("/");

    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
      writeString(buffer, 0, 100, name);
      writeString(buffer, 345, 155, prefix);
      return;
    }
  }

  throw new Error(`Claude plugin archive path is too long: ${entryPath}`);
}

function createHeader(entryPath, stats, type) {
  const header = Buffer.alloc(512, 0);
  const normalizedPath = entryPath.split(path.sep).join("/");
  const size = type === "5" ? 0 : stats.size;

  setPathFields(header, normalizedPath);
  writeOctal(header, 100, 8, stats.mode & 0o777);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, Math.floor(stats.mtimeMs / 1000));
  writeString(header, 156, 1, type);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeChecksum(header);

  return header;
}

function appendTarEntry(chunks, baseDir, relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  const stats = statSync(fullPath);

  if (stats.isDirectory()) {
    const directoryPath = `${relativePath.split(path.sep).join("/")}/`;
    chunks.push(createHeader(directoryPath, stats, "5"));

    for (const name of readdirSync(fullPath).sort()) {
      appendTarEntry(chunks, baseDir, path.join(relativePath, name));
    }

    return;
  }

  const content = readFileSync(fullPath);
  const padding = (512 - (content.length % 512)) % 512;

  chunks.push(createHeader(relativePath, stats, "0"));
  chunks.push(content);

  if (padding > 0) {
    chunks.push(Buffer.alloc(padding, 0));
  }
}

function toZipTimestamp(stats) {
  const mtime = new Date(stats.mtimeMs);
  const year = Math.max(1980, mtime.getFullYear());
  const month = mtime.getMonth() + 1;
  const day = mtime.getDate();
  const hours = mtime.getHours();
  const minutes = mtime.getMinutes();
  const seconds = Math.floor(mtime.getSeconds() / 2);

  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function appendZipEntry(entries, baseDir, relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  const stats = statSync(fullPath);
  const normalizedPath = relativePath.split(path.sep).join("/");

  if (stats.isDirectory()) {
    entries.push({
      content: Buffer.alloc(0),
      crc: 0,
      isDirectory: true,
      name: `${normalizedPath}/`,
      stats,
    });

    for (const name of readdirSync(fullPath).sort()) {
      appendZipEntry(entries, baseDir, path.join(relativePath, name));
    }

    return;
  }

  const content = readFileSync(fullPath);

  entries.push({
    content,
    crc: crc32(content),
    isDirectory: false,
    name: normalizedPath,
    stats,
  });
}

function writeZipArchive(archivePath, baseDir, rootEntry) {
  const entries = [];

  appendZipEntry(entries, baseDir, rootEntry);

  const files = [];
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const { date, time } = toZipTimestamp(entry.stats);
    const contentLength = entry.content.length;
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(entry.crc, 14);
    localHeader.writeUInt32LE(contentLength, 18);
    localHeader.writeUInt32LE(contentLength, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    files.push(localHeader, name, entry.content);

    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(entry.crc, 16);
    centralHeader.writeUInt32LE(contentLength, 20);
    centralHeader.writeUInt32LE(contentLength, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((entry.stats.mode & 0o777) << 16, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectory.push(centralHeader, name);
    offset += localHeader.length + name.length + contentLength;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0);
  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  writeFileSync(
    archivePath,
    Buffer.concat([...files, ...centralDirectory, endOfCentralDirectory]),
  );
}

function writeTarGzArchive(archivePath, baseDir, rootEntry) {
  const chunks = [];

  appendTarEntry(chunks, baseDir, rootEntry);
  chunks.push(Buffer.alloc(1024, 0));

  writeFileSync(archivePath, gzipSync(Buffer.concat(chunks)));
}

export function packageClaudePlugin(
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
    writeTarGzArchive(tarGzPath, tmpRoot, folderName);
    archivePaths.tarGz = tarGzPath;
  }

  if (formats.includes("zip")) {
    rmSync(zipPath, { force: true });
    writeZipArchive(zipPath, tmpRoot, folderName);
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
  const { archivePaths } = packageClaudePlugin(repoRoot, {
    formats: zipOnly ? ["zip"] : ["tar.gz", "zip"],
  });

  for (const archivePath of Object.values(archivePaths)) {
    console.log(`Created ${path.relative(repoRoot, archivePath)}`);
  }
}
