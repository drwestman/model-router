import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { packageClaudePlugin } from "../../scripts/package-claude-plugin.mjs";

const require = createRequire(import.meta.url);
const configModulePath = require.resolve("../../packages/claude/hooks/config.js");
const stateModulePath = require.resolve("../../packages/claude/hooks/state.js");

function writeJSON(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function withEnv<T>(
  env: Record<string, string | undefined>,
  run: () => T,
): T {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function loadClaudeHooks(configPath: string, statePath: string) {
  return withEnv(
    {
      CLAUDE_MODEL_ROUTER_CONFIG_PATH: configPath,
      CLAUDE_MODEL_ROUTER_STATE_PATH: statePath,
    },
    () => {
      delete require.cache[configModulePath];
      delete require.cache[stateModulePath];

      return {
        config: require(configModulePath),
        state: require(stateModulePath),
      } as {
        config: typeof import("../../packages/claude/hooks/config.js");
        state: typeof import("../../packages/claude/hooks/state.js");
      };
    },
  );
}

function createClaudeConfig() {
  return {
    defaultPreset: "anthropic",
    defaultMode: "normal",
    modes: {
      normal: {
        description: "Default mode",
      },
    },
    presets: {
      anthropic: {
        tiers: {
          fast: { model: "anthropic/claude-haiku-4-5" },
          medium: { model: "anthropic/claude-sonnet-4-6" },
          heavy: { model: "anthropic/claude-opus-4-1" },
        },
      },
    },
  };
}

test("Claude hook config safely lists modes and rejects non-object tiers files", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-hooks-config-"));
  const configPath = join(tempRoot, "tiers.json");
  const statePath = join(tempRoot, "state.json");

  try {
    writeJSON(configPath, createClaudeConfig());

    const hooks = loadClaudeHooks(configPath, statePath);
    const config = hooks.config.loadConfig();

    assert.deepEqual(
      hooks.config.listModeNames(hooks.config.getPreset(config, "anthropic")),
      [],
    );

    writeFileSync(configPath, "null\n", "utf8");
    assert.throws(() => hooks.config.loadConfig(), /valid JSON object/i);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude hook config requires fast medium and heavy tier models", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-hooks-tiers-"));
  const configPath = join(tempRoot, "tiers.json");
  const statePath = join(tempRoot, "state.json");

  try {
    const invalidConfig = createClaudeConfig();
    delete invalidConfig.presets.anthropic.tiers.heavy.model;
    writeJSON(configPath, invalidConfig);

    const hooks = loadClaudeHooks(configPath, statePath);

    assert.throws(
      () => hooks.config.loadConfig(),
      /must define a model for tier 'heavy'/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude hook state removes the temp file when persisting fails", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-hooks-state-"));
  const configPath = join(tempRoot, "tiers.json");
  const statePath = join(tempRoot, "state.json");
  const fs = require("node:fs") as typeof import("node:fs");
  const originalRenameSync = fs.renameSync;

  try {
    writeJSON(configPath, createClaudeConfig());
    const hooks = loadClaudeHooks(configPath, statePath);
    const config = hooks.config.loadConfig();

    fs.renameSync = (() => {
      throw new Error("rename failed");
    }) as typeof fs.renameSync;

    assert.throws(() => hooks.state.saveState(config, {}), /rename failed/);
    assert.deepEqual(readdirSync(tempRoot).sort(), ["tiers.json"]);
  } finally {
    fs.renameSync = originalRenameSync;
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude plugin packager reads package.json and stages the expected archive", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-plugin-package-"));
  const claudeRoot = join(tempRoot, "packages", "claude");

  try {
    mkdirSync(join(claudeRoot, ".claude-plugin"), { recursive: true });
    mkdirSync(join(claudeRoot, "hooks"), { recursive: true });
    mkdirSync(join(claudeRoot, "skills"), { recursive: true });

    writeJSON(join(claudeRoot, "package.json"), { version: "9.9.9" });
    writeFileSync(join(claudeRoot, "tiers.json"), "{}\n", "utf8");
    writeFileSync(join(claudeRoot, "README.md"), "# Claude\n", "utf8");
    writeFileSync(join(claudeRoot, "install-local.mjs"), "export {};\n", "utf8");
    writeFileSync(join(claudeRoot, ".claude-plugin", "plugin.json"), "{}\n", "utf8");
    writeFileSync(join(claudeRoot, "hooks", "config.js"), "module.exports = {};\n", "utf8");
    writeFileSync(join(claudeRoot, "skills", "README.md"), "skill\n", "utf8");

    const result = packageClaudePlugin(tempRoot);

    assert.equal(result.folderName, "model-router-claude-9.9.9");
    assert.equal(existsSync(result.archivePath), true);
    assert.equal(existsSync(join(result.stageRoot, "hooks", "config.js")), true);
    assert.equal(existsSync(join(result.stageRoot, ".claude-plugin", "plugin.json")), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
