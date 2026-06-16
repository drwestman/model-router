import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";

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

function readArchiveEntries(archivePath: string): string[] {
  const archive = gunzipSync(readFileSync(archivePath));
  const entries: string[] = [];
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = header
      .subarray(0, 100)
      .toString("utf8")
      .replace(/\0.*$/, "");
    const prefix = header
      .subarray(345, 500)
      .toString("utf8")
      .replace(/\0.*$/, "");
    const sizeText = header
      .subarray(124, 136)
      .toString("utf8")
      .replace(/\0.*$/, "")
      .trim();
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;

    entries.push(entryPath);
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function readZipEntries(archivePath: string): string[] {
  const archive = readFileSync(archivePath);
  const entries: string[] = [];
  let offset = 0;

  while (offset + 30 <= archive.length) {
    const signature = archive.readUInt32LE(offset);

    if (signature !== 0x04034b50) {
      break;
    }

    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const size = archive.readUInt32LE(offset + 18);
    const name = archive
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString("utf8");

    entries.push(name);
    offset += 30 + nameLength + extraLength + size;
  }

  return entries;
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
    assert.equal(hooks.config.defaultModeForPreset(config, "anthropic"), "normal");
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
      assert.match(content, /\$ARGUMENTS/);
    }
  }
});

test("Claude plugin packager stages and archives expected files without tar on PATH", () => {
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

    const result = withEnv({ PATH: "" }, () => packageClaudePlugin(tempRoot));
    const tarEntries = readArchiveEntries(result.tarGzPath!);
    const zipEntries = readZipEntries(result.zipPath!);
    const expectedEntries = [
      "model-router-claude-9.9.9/.claude-plugin/plugin.json",
      "model-router-claude-9.9.9/README.md",
      "model-router-claude-9.9.9/hooks/config.js",
      "model-router-claude-9.9.9/install-local.mjs",
      "model-router-claude-9.9.9/skills/README.md",
    ];

    assert.equal(result.folderName, "model-router-claude-9.9.9");
    assert.equal(existsSync(result.tarGzPath!), true);
    assert.equal(existsSync(result.zipPath!), true);
    assert.equal(existsSync(join(result.stageRoot, "hooks", "config.js")), true);
    assert.equal(existsSync(join(result.stageRoot, ".claude-plugin", "plugin.json")), true);
    assert.deepEqual(
      tarEntries.filter((entry) => entry.endsWith("plugin.json") || entry.endsWith("config.js") || entry.endsWith("README.md") || entry.endsWith("install-local.mjs")).sort(),
      expectedEntries,
    );
    assert.deepEqual(
      zipEntries.filter((entry) => entry.endsWith("plugin.json") || entry.endsWith("config.js") || entry.endsWith("README.md") || entry.endsWith("install-local.mjs")).sort(),
      expectedEntries,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Claude plugin packager can write zip archives only", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "claude-plugin-package-zip-"));
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

    const result = packageClaudePlugin(tempRoot, { formats: ["zip"] });

    assert.equal(result.tarGzPath, null);
    assert.equal(existsSync(join(tempRoot, "tmp", "model-router-claude-9.9.9.tar.gz")), false);
    assert.equal(existsSync(result.zipPath!), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
