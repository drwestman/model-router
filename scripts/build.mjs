import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";

export function buildProject(rootDir = process.cwd(), env = process.env) {
  const sourcePath = join(rootDir, "src", "index.ts");
  const outputPath = join(rootDir, "src", "index.js");
  const buildInfoDir = join(rootDir, "src", "generated");
  const buildInfoPath = join(buildInfoDir, "build-info.json");
  const packageJsonPath = join(rootDir, "package.json");

  const source = readFileSync(sourcePath, "utf8");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const baseVersion = getBaseVersion(packageJson);
  const resolvedBuildNumber = resolveBuildNumber(env);
  const buildSource = resolvedBuildNumber.source;
  const buildNumber = resolvedBuildNumber.value;
  const fullVersion = `${baseVersion}+${buildNumber}`;

  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      sourceMap: false,
      removeComments: false,
    },
  });

  mkdirSync(buildInfoDir, { recursive: true });
  writeFileSync(
    buildInfoPath,
    JSON.stringify(
      {
        baseVersion,
        buildNumber,
        buildSource,
        fullVersion,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  writeFileSync(outputPath, result.outputText, "utf8");

  return {
    baseVersion,
    buildNumber,
    buildSource,
    fullVersion,
  };
}

export function getBaseVersion(packageJson) {
  const baseVersion = packageJson?.version;
  if (typeof baseVersion !== "string" || !baseVersion.trim()) {
    throw new Error("package.json version must be a non-empty string");
  }
  return baseVersion.trim();
}

export function resolveBuildNumber(env) {
  const override = normalizeBuildNumber(env.OPENCODE_MODEL_ROUTER_BUILD_NUMBER);
  if (override) {
    return { source: "override", value: override };
  }

  const ciCandidates = [
    env.GITHUB_RUN_NUMBER,
    env.GITHUB_RUN_ATTEMPT,
    env.BUILD_NUMBER,
    env.CI_PIPELINE_IID,
    env.CI_JOB_ID,
    env.RUN_NUMBER,
  ];

  for (const candidate of ciCandidates) {
    const normalized = normalizeBuildNumber(candidate);
    if (normalized) {
      return { source: "ci", value: normalized };
    }
  }

  return {
    source: "local",
    value: formatTimestamp(new Date()),
  };
}

export function normalizeBuildNumber(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/.test(trimmed)) {
    throw new Error(
      `Invalid build number '${trimmed}'. Use only SemVer build metadata characters [0-9A-Za-z-.].`,
    );
  }
  return trimmed;
}

export function formatTimestamp(date) {
  const parts = [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ];
  return parts.join("");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildProject();
}
