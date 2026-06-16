import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as tar from "tar";

import { packageClaudePlugin } from "../../scripts/package-claude-plugin.mjs";

const require = createRequire(import.meta.url);
const commandsModulePath = require.resolve("../../packages/claude/hooks/commands.js");
const configModulePath = require.resolve("../../packages/claude/hooks/config.js");
const runCommandScriptPath = require.resolve("../../packages/claude/hooks/run-command.js");
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

async function withEnvAsync<T>(
  env: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
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
    return await run();
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
      delete require.cache[commandsModulePath];
      delete require.cache[configModulePath];
      delete require.cache[stateModulePath];

      return {
        commands: require(commandsModulePath),
        config: require(configModulePath),
        state: require(stateModulePath),
      } as {
        commands: typeof import("../../packages/claude/hooks/commands.js");
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

async function readTarEntries(archivePath: string): Promise<string[]> {
  const entries: string[] = [];

  await tar.list({
    file: archivePath,
    gzip: true,
    onentry: (entry) => {
      entries.push(entry.path);
    },
  });

  return entries;
}

function readZipEntries(archivePath: string): string[] {
  const archive = readFileSync(archivePath);
  const entries: string[] = [];
  let offset = archive.length - 22;

  while (offset >= 0) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      break;
    }

    offset -= 1;
  }

  assert.notEqual(offset, -1, "ZIP archive is missing an end-of-central-directory record");

  const centralDirectoryOffset = archive.readUInt32LE(offset + 16);
  const totalEntries = archive.readUInt16LE(offset + 10);
  let centralOffset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    const signature = archive.readUInt32LE(centralOffset);

    assert.equal(signature, 0x02014b50, "ZIP archive is missing a central directory header");

    const nameLength = archive.readUInt16LE(centralOffset + 28);
    const extraLength = archive.readUInt16LE(centralOffset + 30);
    const commentLength = archive.readUInt16LE(centralOffset + 32);
    const name = archive
      .subarray(centralOffset + 46, centralOffset + 46 + nameLength)
      .toString("utf8");

    entries.push(name);
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function listStageEntries(baseDir: string, relativePath: string): string[] {
  const fullPath = join(baseDir, relativePath);
  const stats = statSync(fullPath);

  if (!stats.isDirectory()) {
    return [relativePath];
  }

  const entries = [relativePath];

  for (const name of readdirSync(fullPath).sort()) {
    entries.push(...listStageEntries(baseDir, join(relativePath, name)));
  }

  return entries;
}

function normalizeArchiveEntries(entries: string[]): string[] {
  return entries.map((entry) => entry.replace(/\/$/, "")).sort();
}

function createClaudePluginFixture(rootDir: string): void {
  const claudeRoot = join(rootDir, "packages", "claude");

  mkdirSync(join(claudeRoot, "hooks", "nested"), { recursive: true });
  mkdirSync(join(claudeRoot, "skills", "zeta"), { recursive: true });
  mkdirSync(join(claudeRoot, "skills", "alpha"), { recursive: true });
  writeJSON(join(claudeRoot, "package.json"), {
    name: "@model-router/claude",
    version: "1.2.3",
  });
  writeFileSync(join(claudeRoot, ".claude-plugin"), "plugin\n", "utf8");
  writeFileSync(join(claudeRoot, "README.md"), "# Claude plugin\n", "utf8");
  writeFileSync(join(claudeRoot, "install-local.mjs"), "export {};\n", "utf8");
  writeJSON(join(claudeRoot, "tiers.json"), createClaudeConfig());
  writeFileSync(join(claudeRoot, "hooks", "b.js"), "b\n", "utf8");
  writeFileSync(join(claudeRoot, "hooks", "a.js"), "a\n", "utf8");
  writeFileSync(join(claudeRoot, "hooks", "nested", "c.txt"), "c\n", "utf8");
  writeFileSync(join(claudeRoot, "skills", "zeta", "SKILL.md"), "zeta\n", "utf8");
  writeFileSync(join(claudeRoot, "skills", "alpha", "SKILL.md"), "alpha\n", "utf8");
}

test("Claude hook config omits listModeNames and rejects non-object tiers files", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-hooks-config-"));
  const configPath = join(tempRoot, "tiers.json");
  const statePath = join(tempRoot, "state.json");

  try {
    writeJSON(configPath, createClaudeConfig());

    const hooks = loadClaudeHooks(configPath, statePath);
    const config = hooks.config.loadConfig();

    assert.equal("listModeNames" in hooks.config, false);
    assert.equal(hooks.config.defaultModeForPreset(config), "normal");
    assert.deepEqual(hooks.config.listGlobalModeNames(config), ["normal"]);

    writeFileSync(configPath, "null\n", "utf8");
    assert.throws(() => hooks.config.loadConfig(), /valid JSON object/i);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude annotate-plan uses handleCommand with whole-word and line rules", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-hooks-commands-"));
  const configPath = join(tempRoot, "tiers.json");
  const statePath = join(tempRoot, "state.json");

  try {
    writeJSON(configPath, createClaudeConfig());

    const hooks = loadClaudeHooks(configPath, statePath);
    const config = hooks.config.loadConfig();

    assert.equal(
      hooks.commands.handleCommand(config, {}, "/annotate-plan review thread history"),
      "review thread history [tier:medium]",
    );
    assert.equal(
      hooks.commands.handleCommand(config, {}, "/annotate-plan review checkout flow"),
      "review checkout flow [tier:medium]",
    );
    assert.equal(
      hooks.commands.handleCommand(config, {}, "/annotate-plan run root cause analysis"),
      "run root cause analysis [tier:heavy]",
    );
    assert.equal(
      hooks.commands.handleCommand(config, {}, "/annotate-plan inspect docs, summarize findings"),
      "inspect docs, summarize findings [tier:fast]",
    );
    assert.equal(
      hooks.commands.handleCommand(config, {}, "/annotate-plan inspect docs; implement fix"),
      ["inspect docs [tier:fast]", "implement fix [tier:medium]"].join("\n"),
    );
    assert.equal(
      hooks.commands.handleCommand(
        config,
        {},
        "/annotate-plan inspect docs\nimplement fix, with tests",
      ),
      ["inspect docs [tier:fast]", "implement fix, with tests [tier:medium]"].join("\n"),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude shared command runner supports slash, namespaced, and CLI command execution", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-hooks-run-command-"));
  const configPath = join(tempRoot, "tiers.json");
  const statePath = join(tempRoot, "state.json");

  try {
    writeJSON(configPath, createClaudeConfig());

    const hooks = loadClaudeHooks(configPath, statePath);
    const config = hooks.config.loadConfig();
    const state = hooks.state.loadState(config);
    const commands = [
      ["tiers", "", "/tiers"],
      ["preset", "anthropic", "/preset anthropic"],
      ["mode", "normal", "/mode normal"],
      ["bypass", "on", "/bypass on"],
      ["annotate-plan", "inspect docs; implement fix", "/annotate-plan inspect docs; implement fix"],
      ["ponytail-review", "add dependency and helper file", "/ponytail-review add dependency and helper file"],
    ] as const;

    for (const [commandName, argText, slashCommand] of commands) {
      assert.equal(
        hooks.commands.runCommand(config, state, commandName, argText),
        hooks.commands.handleCommand(config, state, slashCommand),
      );
      assert.equal(
        hooks.commands.runCommand(config, state, `model-router:${commandName}`, argText),
        hooks.commands.handleCommand(config, state, slashCommand),
      );
    }

    const env = {
      ...process.env,
      CLAUDE_MODEL_ROUTER_CONFIG_PATH: configPath,
      CLAUDE_MODEL_ROUTER_STATE_PATH: statePath,
    };

    assert.equal(
      execFileSync(
        process.execPath,
        [runCommandScriptPath, "annotate-plan", "inspect docs; implement fix"],
        { encoding: "utf8", env },
      ).trim(),
      "inspect docs [tier:fast]\nimplement fix [tier:medium]",
    );
    assert.match(
      execFileSync(process.execPath, [runCommandScriptPath, "tiers"], {
        encoding: "utf8",
        env,
      }),
      /anthropic\/claude-sonnet-4-6/,
    );
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

test("Claude plugin skills are discoverable and point at the shared runner", () => {
  const skillsRoot = join(process.cwd(), "packages", "claude", "skills");
  const overview = readFileSync(join(skillsRoot, "model-router", "SKILL.md"), "utf8");
  const commandSkills = [
    ["tiers", false],
    ["preset", true],
    ["mode", true],
    ["bypass", true],
    ["annotate-plan", true],
    ["ponytail-review", true],
  ] as const;

  assert.match(overview, /\/model-router:tiers/);
  assert.match(overview, /\/model-router:preset <preset-name>/);
  assert.match(overview, /namespaced plugin skills above are the discoverable installed command surface/i);

  for (const [skillName, expectsArgumentHint] of commandSkills) {
    const content = readFileSync(join(skillsRoot, skillName, "SKILL.md"), "utf8");

    assert.match(content, /^---\n(?:.|\n)*description:/);
    assert.match(content, /disable-model-invocation: true/);
    assert.match(
      content,
      new RegExp(`node \\\"\\$\\{CLAUDE_PLUGIN_ROOT\\}\/hooks\/run-command\\.js\\\" ${skillName}`),
    );

    if (expectsArgumentHint) {
      assert.match(content, /argument-hint:/);
    }
  }
});

test("Claude plugin packaging preserves staged contents without a tar binary", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-plugin-package-"));

  try {
    createClaudePluginFixture(tempRoot);

    const result = await withEnvAsync<Awaited<ReturnType<typeof packageClaudePlugin>>>(
      { PATH: "" },
      () => packageClaudePlugin(tempRoot),
    );
    const tarGzPath = result.tarGzPath;
    const zipPath = result.zipPath;

    assert.equal(result.folderName, "model-router-claude-1.2.3");
    assert.equal(result.archivePath, tarGzPath);
    assert.ok(tarGzPath);
    assert.ok(zipPath);
    assert.equal(existsSync(tarGzPath), true);
    assert.equal(existsSync(zipPath), true);

    const expectedEntries = normalizeArchiveEntries(
      listStageEntries(join(tempRoot, "tmp", "claude-plugin-package"), result.folderName),
    );

    assert.deepEqual(normalizeArchiveEntries(await readTarEntries(tarGzPath)), expectedEntries);
    assert.deepEqual(normalizeArchiveEntries(readZipEntries(zipPath)), expectedEntries);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude plugin packaging supports zip-only output", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-plugin-zip-only-"));

  try {
    createClaudePluginFixture(tempRoot);

    const result = await packageClaudePlugin(tempRoot, { formats: ["zip"] });
    const zipPath = result.zipPath;

    assert.equal(result.folderName, "model-router-claude-1.2.3");
    assert.equal(result.archivePath, zipPath);
    assert.equal(result.tarGzPath, null);
    assert.ok(zipPath);
    assert.deepEqual(result.archivePaths, {
      zip: join(tempRoot, "tmp", `${result.folderName}.zip`),
    });
    assert.equal(existsSync(zipPath), true);
    assert.equal(existsSync(join(tempRoot, "tmp", `${result.folderName}.tar.gz`)), false);

    const expectedEntries = normalizeArchiveEntries(
      listStageEntries(join(tempRoot, "tmp", "claude-plugin-package"), result.folderName),
    );

    assert.deepEqual(normalizeArchiveEntries(readZipEntries(zipPath)), expectedEntries);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
