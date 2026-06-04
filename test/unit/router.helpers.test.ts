import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import ModelRouterPlugin, {
  invalidateConfigCache,
  routerBuildInfo,
  routerVersion,
} from "../../src/index.ts";
import {
  applyPersistedState,
  buildAgentDefinition,
  buildCapBanner,
  buildDelegationProtocol,
  extractDispatchText,
  loadConfigFromPaths,
  normalizeRouterState,
  parseCapDirective,
  registerActiveTierAgents,
  resolveRouterPaths,
  writeStateFile,
} from "../../src/index.ts";
import { createRouterTestEnv, readJSONFile } from "../helpers/router-test-env.ts";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

test("loadConfigFromPaths applies persisted preset and mode", () => {
  const env = createRouterTestEnv({
    state: { activePreset: "OPENAI", activeMode: "budget" },
  });

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    assert.equal(cfg.activePreset, "openai");
    assert.equal(cfg.activeMode, "budget");
  } finally {
    env.cleanup();
  }
});

test("resolveRouterPaths normalizes file URL overrides", () => {
  const env = createRouterTestEnv();

  try {
    const resolved = resolveRouterPaths({
      OPENCODE_MODEL_ROUTER_CONFIG_PATH: pathToFileURL(env.configPath).href,
      OPENCODE_MODEL_ROUTER_STATE_PATH: pathToFileURL(env.statePath).href,
    } as NodeJS.ProcessEnv);

    assert.equal(resolved.configPath, env.configPath);
    assert.equal(resolved.statePath, env.statePath);
  } finally {
    env.cleanup();
  }
});

test("resolveRouterPaths defaults to bundled config even when cwd has tiers.json", () => {
  const env = createRouterTestEnv();
  const originalCwd = process.cwd();
  const cwdWithTiers = join(env.rootDir, "cwd-project");

  try {
    mkdirSync(cwdWithTiers, { recursive: true });
    writeFileSync(join(cwdWithTiers, "tiers.json"), "{\"activePreset\":\"cwd\"}\n", "utf8");
    delete process.env.OPENCODE_MODEL_ROUTER_CONFIG_PATH;
    delete process.env.OPENCODE_MODEL_ROUTER_STATE_PATH;
    process.chdir(cwdWithTiers);

    const resolved = resolveRouterPaths({} as NodeJS.ProcessEnv);

    assert.equal(resolved.configPath, join(repoRoot, "tiers.json"));
    assert.notEqual(resolved.configPath, join(cwdWithTiers, "tiers.json"));
  } finally {
    process.chdir(originalCwd);
    env.cleanup();
  }
});

test("writeStateFile merges existing state keys", () => {
  const env = createRouterTestEnv({ state: { activePreset: "anthropic" } });

  try {
    writeStateFile(env.statePath, { activeMode: "quality" });
    const state = readJSONFile<{ activePreset?: string; activeMode?: string }>(
      env.statePath,
    );

    assert.equal(state.activePreset, "anthropic");
    assert.equal(state.activeMode, "quality");
  } finally {
    env.cleanup();
  }
});

test("writeStateFile normalizes malformed existing state before merging", () => {
  const env = createRouterTestEnv({ rawStateContent: "null" });

  try {
    writeStateFile(env.statePath, { activeMode: "quality" });
    const state = readJSONFile<{ activePreset?: string; activeMode?: string }>(
      env.statePath,
    );

    assert.equal(state.activePreset, undefined);
    assert.equal(state.activeMode, "quality");
  } finally {
    env.cleanup();
  }
});

test("applyPersistedState ignores unknown preset and mode", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    applyPersistedState(cfg, { activePreset: "missing", activeMode: "missing" });

    assert.equal(cfg.activePreset, "anthropic");
    assert.equal(cfg.activeMode, "normal");
  } finally {
    env.cleanup();
  }
});

test("applyPersistedState returns updated state without mutating input", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    const updated = applyPersistedState(cfg, {
      activePreset: "openai",
      activeMode: "budget",
    });

    assert.equal(updated.activePreset, "openai");
    assert.equal(updated.activeMode, "budget");
    assert.equal(cfg.activePreset, "anthropic");
    assert.equal(cfg.activeMode, "normal");
    assert.notEqual(updated, cfg);
  } finally {
    env.cleanup();
  }
});

test("normalizeRouterState drops malformed state shapes", () => {
  assert.deepEqual(normalizeRouterState(null), {});
  assert.deepEqual(normalizeRouterState([]), {});
  assert.deepEqual(normalizeRouterState({ activePreset: 123, activeMode: true }), {});
  assert.deepEqual(
    normalizeRouterState({ activePreset: "openai", activeMode: "budget" }),
    { activePreset: "openai", activeMode: "budget" },
  );
});

test("loadConfigFromPaths ignores malformed persisted state content", () => {
  const env = createRouterTestEnv({ rawStateContent: "null" });

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    assert.equal(cfg.activePreset, "anthropic");
    assert.equal(cfg.activeMode, "normal");
  } finally {
    env.cleanup();
  }
});

test("buildDelegationProtocol includes key routing sections", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });
    const protocol = buildDelegationProtocol(cfg);

    assert.match(protocol, /Model Delegation Protocol/);
    assert.match(protocol, /Preset: anthropic/);
    assert.match(protocol, /R:/);
    assert.match(protocol, /Multi-phase:/);
    assert.match(protocol, /Compact rules/);
    assert.match(protocol, /Err→retry-alt-tier→fail→direct/);
  } finally {
    env.cleanup();
  }
});

test("buildAgentDefinition includes variant, prompt prefix, and provider options", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });
    const claudeAgent = buildAgentDefinition(
      "medium",
      cfg.presets.anthropic.medium as never,
      cfg,
    ) as Record<string, unknown>;

    assert.equal(claudeAgent.mode, "subagent");
    assert.equal(claudeAgent.variant, "max");
    assert.equal(claudeAgent.maxSteps, 4);
    assert.equal(claudeAgent.model, "anthropic/claude-sonnet-4-6");

    const claudePrompt = String(claudeAgent.prompt);
    assert.match(claudePrompt, /ANTI-NARRATION/);
    assert.match(claudePrompt, /Implement changes and verify them\./);

    const agent = buildAgentDefinition(
      "medium",
      {
        model: "openai/gpt-5.4-fast",
        variant: "high",
        description: "Custom implementation tier",
        costRatio: 5,
        color: "blue",
        steps: 4,
        whenToUse: ["implement", "tests"],
        prompt: "Implement changes and verify them.",
        reasoning: {
          effort: "high",
          summary: "auto",
        },
      } as never,
      cfg,
    ) as Record<string, unknown>;

    assert.equal(agent.mode, "subagent");
    assert.equal(agent.variant, "high");
    assert.equal(agent.maxSteps, 4);
    assert.equal(agent.model, "openai/gpt-5.4-fast");
    assert.deepEqual(agent.options, {
      reasoning_effort: "high",
      reasoning_summary: "auto",
    });
  } finally {
    env.cleanup();
  }
});

test("buildAgentDefinition omits undefined prefix for custom Claude tier names", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });
    const agent = buildAgentDefinition(
      "custom-claude-tier",
      cfg.presets.anthropic.medium as never,
      cfg,
    ) as Record<string, unknown>;

    const prompt = String(agent.prompt);
    assert.match(prompt, /ANTI-NARRATION/);
    assert.doesNotMatch(prompt, /undefined/);
  } finally {
    env.cleanup();
  }
});

test("router exports the generated build version", () => {
  assert.equal(routerVersion, routerBuildInfo.fullVersion);
  assert.match(routerVersion, /^\d+\.\d+\.\d+\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/);
  assert.equal(
    (ModelRouterPlugin as typeof ModelRouterPlugin & { version?: string }).version,
    routerVersion,
  );
});

test("registerActiveTierAgents skips invalid tier entries without crashing", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });
    const opencodeConfig: Record<string, any> = {};

    registerActiveTierAgents(opencodeConfig, cfg, {
      fast: cfg.presets.anthropic.fast,
      medium: undefined,
      heavy: cfg.presets.anthropic.heavy,
    } as never);

    assert.equal(opencodeConfig.agent.fast.model, cfg.presets.anthropic.fast.model);
    assert.equal(opencodeConfig.agent.medium, undefined);
    assert.equal(opencodeConfig.agent.heavy.model, cfg.presets.anthropic.heavy.model);
  } finally {
    env.cleanup();
  }
});

test("plugin config registers agents and commands without provider metadata", async () => {
  const env = createRouterTestEnv();

  try {
    invalidateConfigCache();
    const plugin = (await ModelRouterPlugin({} as never)) as Record<string, any>;
    const opencodeConfig: Record<string, any> = {};

    plugin.config(opencodeConfig);

    assert.deepEqual(
      Object.keys(opencodeConfig.agent).sort(),
      ["fast", "heavy", "medium"],
    );
    for (const command of ["tiers", "preset", "budget", "bypass", "annotate-plan"]) {
      assert.ok(opencodeConfig.command?.[command], `missing command ${command}`);
    }
  } finally {
    env.cleanup();
    invalidateConfigCache();
  }
});

test("extractDispatchText tolerates non-array parts", () => {
  const output = { parts: "bad" };

  assert.doesNotThrow(() => extractDispatchText(output));
  assert.equal(extractDispatchText(output), "");
});

test("cap helpers parse directives and emit warnings", () => {
  assert.equal(parseCapDirective("Investigate this. CAP:2"), 2);
  assert.equal(parseCapDirective("Investigate this. CAP:none"), "none");

  const banner = buildCapBanner(
    {
      tierName: "fast",
      cap: 2,
      calls: 2,
      seen: new Map(),
    },
    true,
    1,
    "read",
  );

  assert.match(banner, /\[cap: 2\/2\]/);
  assert.match(banner, /REDUNDANT/);
  assert.match(banner, /CAP REACHED/);
});
