import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  buildProject,
  formatTimestamp,
  normalizeBuildNumber,
  resolveBuildNumber,
} from "../../scripts/build.mjs";

test("normalizeBuildNumber accepts SemVer build metadata tokens", () => {
  assert.equal(normalizeBuildNumber("123"), "123");
  assert.equal(normalizeBuildNumber("20260604.1"), "20260604.1");
  assert.equal(normalizeBuildNumber("ci-build-7"), "ci-build-7");
  assert.throws(() => normalizeBuildNumber("bad/value"), /Invalid build number/);
});

test("resolveBuildNumber prefers explicit override", () => {
  const resolved = resolveBuildNumber({
    OPENCODE_MODEL_ROUTER_BUILD_NUMBER: "custom.42",
    GITHUB_RUN_NUMBER: "9001",
  });

  assert.deepEqual(resolved, {
    source: "override",
    value: "custom.42",
  });
});

test("resolveBuildNumber uses CI values before local fallback", () => {
  const resolved = resolveBuildNumber({
    GITHUB_RUN_NUMBER: "1234",
  });

  assert.deepEqual(resolved, {
    source: "ci",
    value: "1234",
  });
});

test("formatTimestamp returns stable UTC build numbers", () => {
  const timestamp = formatTimestamp(new Date("2026-06-04T15:16:17.000Z"));
  assert.equal(timestamp, "20260604151617");
});

test("buildProject writes generated build metadata and transpiled output", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "opencode-model-router-build-"));
  const packageRoot = join(tempRoot, "packages", "opencode");
  const sourceRoot = join(packageRoot, "src");
  const providersRoot = join(sourceRoot, "providers");

  try {
    mkdirSync(join(tempRoot, "scripts"), { recursive: true });
    mkdirSync(providersRoot, { recursive: true });

    writeFileSync(
      join(packageRoot, "package.json"),
      JSON.stringify({ version: "1.1.16" }, null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(sourceRoot, "index.ts"),
      'export const answer = 42;\n',
      "utf8",
    );
    for (const fileName of [
      "adapter.ts",
      "anthropic.ts",
      "claude.ts",
      "github-copilot.ts",
      "google.ts",
      "index.ts",
      "openai.ts",
      "unknown.ts",
    ]) {
      writeFileSync(join(providersRoot, fileName), "export {};\n", "utf8");
    }

    const result = buildProject(tempRoot, {
      OPENCODE_MODEL_ROUTER_BUILD_NUMBER: "555",
    });

    assert.deepEqual(result, {
      baseVersion: "1.1.16",
      buildNumber: "555",
      buildSource: "override",
      fullVersion: "1.1.16+555",
    });

    const generatedModule = await import(
      `${pathToFileURL(join(sourceRoot, "generated", "build-info.json")).href}?t=${Date.now()}`
    );
    assert.deepEqual(generatedModule.default, result);

    const transpiled = readFileSync(join(sourceRoot, "index.js"), "utf8");
    assert.match(transpiled, /export const answer = 42;/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
