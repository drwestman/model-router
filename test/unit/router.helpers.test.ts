import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import ModelRouterPlugin, {
  invalidateConfigCache,
  routerBuildInfo,
  routerVersion,
  tui,
} from "../../packages/opencode/src/index.ts";
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
} from "../../packages/opencode/src/index.ts";
import { isClaudeModel } from "../../packages/opencode/src/providers/claude.ts";
import { createRouterTestEnv, readJSONFile } from "../helpers/router-test-env.ts";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

function writeJSON(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

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

    assert.equal(resolved.configPath, join(repoRoot, "packages", "opencode", "tiers.json"));
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

test("isClaudeModel matches proxied Claude identifiers with dot separators", () => {
  assert.equal(isClaudeModel("anthropic/claude-sonnet-4-6"), true);
  assert.equal(isClaudeModel("github-copilot/claude-sonnet-4-6"), true);
  assert.equal(isClaudeModel("bedrock/us.anthropic.claude-3-5-sonnet-20241022-v2:0"), true);
  assert.equal(isClaudeModel("openai/gpt-5.4-fast"), false);
});

test("buildAgentDefinition applies Claude prefix for proxied Claude models regardless of provider", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });
    const agent = buildAgentDefinition(
      "medium",
      {
        model: "openai/claude-sonnet-4-6",
        variant: "high",
        description: "Custom proxied Claude tier",
        costRatio: 5,
        color: "blue",
        steps: 4,
        whenToUse: ["implement"],
        prompt: "Implement changes and verify them.",
      } as never,
      cfg,
    ) as Record<string, unknown>;

    const prompt = String(agent.prompt);
    assert.match(prompt, /ANTI-NARRATION/);
    assert.match(prompt, /Implement changes and verify them\./);
  } finally {
    env.cleanup();
  }
});

test("budget ponytail command persists the ponytail mode", async () => {
  const env = createRouterTestEnv();

  try {
    invalidateConfigCache();
    const plugin = (await ModelRouterPlugin({} as never)) as Record<string, any>;
    const output = { parts: [] as Array<{ type: "text"; text: string }> };

    await plugin["command.execute.before"](
      {
        command: "budget",
        arguments: "ponytail",
      },
      output,
    );

    const state = readJSONFile<{ activeMode?: string }>(env.statePath);
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    assert.equal(state.activeMode, "ponytail");
    assert.equal(cfg.activeMode, "ponytail");
    assert.match(output.parts.map((part) => part.text).join("\n\n"), /\*\*ponytail\*\*/i);
  } finally {
    env.cleanup();
    invalidateConfigCache();
  }
});

test("ponytail mode injects tier prompts into delegated fast medium and heavy agents only", async () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    writeJSON(env.configPath, {
      ...cfg,
      activeMode: "ponytail",
      modes: {
        ...cfg.modes,
        ponytail: {
          ...cfg.modes.ponytail,
          tierPrompts: {
            fast: "PONYTAIL FAST MARKER",
            medium: "PONYTAIL MEDIUM MARKER",
            heavy: "PONYTAIL HEAVY MARKER",
          },
        },
      },
    });

    invalidateConfigCache();
    const plugin = (await ModelRouterPlugin({} as never)) as Record<string, any>;

    for (const tier of ["fast", "medium", "heavy"] as const) {
      const sessionID = `ponytail-${tier}`;

      await plugin["chat.message"](
        {
          agent: tier,
          sessionID,
        },
        {
          parts: [{ text: `Inspect ${tier}.` }],
        },
      );

      const output = { system: [] as string[] };
      await plugin["experimental.chat.system.transform"](
        {
          sessionID,
          model: {
            providerID: "anthropic",
            modelID: "claude-sonnet-4-6",
          },
        },
        output,
      );

      assert.match(
        output.system.join("\n\n"),
        new RegExp(`PONYTAIL ${tier.toUpperCase()} MARKER`),
      );
    }
  } finally {
    env.cleanup();
    invalidateConfigCache();
  }
});

test("ponytail tier prompts are not injected for orchestrator sessions", async () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    writeJSON(env.configPath, {
      ...cfg,
      activeMode: "ponytail",
      modes: {
        ...cfg.modes,
        ponytail: {
          ...cfg.modes.ponytail,
          tierPrompts: {
            fast: "PONYTAIL ORCHESTRATOR MARKER",
            medium: "PONYTAIL ORCHESTRATOR MARKER",
            heavy: "PONYTAIL ORCHESTRATOR MARKER",
          },
        },
      },
    });

    invalidateConfigCache();
    const plugin = (await ModelRouterPlugin({} as never)) as Record<string, any>;
    const output = { system: [] as string[] };

    await plugin["experimental.chat.system.transform"](
      {
        model: {
          providerID: "anthropic",
          modelID: "claude-sonnet-4-6",
        },
      },
      output,
    );

    const systemPrompt = output.system.join("\n\n");
    assert.match(systemPrompt, /Model Delegation Protocol/);
    assert.doesNotMatch(systemPrompt, /PONYTAIL ORCHESTRATOR MARKER/);
  } finally {
    env.cleanup();
    invalidateConfigCache();
  }
});

test("ponytail tier prompts are not injected outside ponytail mode", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    writeJSON(env.configPath, {
      ...cfg,
      activeMode: "normal",
      modes: {
        ...cfg.modes,
        ponytail: {
          ...cfg.modes.ponytail,
          tierPrompts: {
            fast: "PONYTAIL NORMAL MODE MARKER",
          },
        },
      },
    });

    invalidateConfigCache();
    const normalConfig = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });

    assert.doesNotMatch(
      String(
        buildAgentDefinition(
          "fast",
          normalConfig.presets[normalConfig.activePreset]!.fast as never,
          normalConfig,
        ).prompt,
      ),
      /PONYTAIL NORMAL MODE MARKER/,
    );
  } finally {
    env.cleanup();
    invalidateConfigCache();
  }
});

test("ponytail review slash command stays prompt-only and does not persist state", async () => {
  const env = createRouterTestEnv();
  const calls: Array<[string, string?]> = [];
  let commands: Array<Record<string, unknown>> = [];

  try {
    writeStateFile(env.statePath, {});

    await tui({
      command: {
        register: (cb: () => Array<Record<string, unknown>>) => {
          commands = cb();
          return () => {};
        },
      },
      client: {
        tui: {
          clearPrompt: async () => {
            calls.push(["clearPrompt"]);
          },
          appendPrompt: async ({ text }: { text?: string }) => {
            calls.push(["appendPrompt", text]);
          },
          submitPrompt: async () => {
            calls.push(["submitPrompt"]);
          },
        },
      },
    } as never);

    const ponytailReview = commands.find(
      (command) => command.value === "model-router.ponytail-review",
    ) as { onSelect?: () => Promise<void> } | undefined;

    assert.ok(ponytailReview?.onSelect, "missing ponytail-review slash command");
    const before = readJSONFile<Record<string, unknown>>(env.statePath);

    await ponytailReview.onSelect();

    const after = readJSONFile<Record<string, unknown>>(env.statePath);
    assert.deepEqual(after, before);
    assert.deepEqual(calls, [
      ["clearPrompt"],
      ["appendPrompt", "/ponytail-review"],
      ["submitPrompt"],
    ]);
  } finally {
    env.cleanup();
  }
});

test("loadConfigFromPaths rejects malformed ponytail tierPrompts", () => {
  const env = createRouterTestEnv();

  try {
    const cfg = loadConfigFromPaths({
      configPath: env.configPath,
      statePath: env.statePath,
    });
    const invalidConfig = JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>;
    const modes = invalidConfig.modes as Record<string, Record<string, unknown>>;

    modes.ponytail = {
      ...modes.ponytail,
      tierPrompts: "not-an-object",
    };
    writeJSON(env.configPath, invalidConfig);
    invalidateConfigCache();

    assert.throws(
      () =>
        loadConfigFromPaths({
          configPath: env.configPath,
          statePath: env.statePath,
        }),
      /tierPrompts/i,
    );
  } finally {
    env.cleanup();
    invalidateConfigCache();
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
    for (const command of [
      "tiers",
      "preset",
      "budget",
      "bypass",
      "ponytail-review",
      "annotate-plan",
    ]) {
      assert.ok(opencodeConfig.command?.[command], `missing command ${command}`);
    }
  } finally {
    env.cleanup();
    invalidateConfigCache();
  }
});

test("tui plugin registers slash commands and dispatches them through the prompt", async () => {
  const calls: Array<[string, string?]> = [];
  let commands: Array<Record<string, unknown>> = [];

  await tui({
    command: {
      register: (cb: () => Array<Record<string, unknown>>) => {
        commands = cb();
        return () => {};
      },
    },
    client: {
      tui: {
        clearPrompt: async () => {
          calls.push(["clearPrompt"]);
        },
        appendPrompt: async ({ text }: { text?: string }) => {
          calls.push(["appendPrompt", text]);
        },
        submitPrompt: async () => {
          calls.push(["submitPrompt"]);
        },
      },
    },
  });

  assert.deepEqual(
    commands.map((command) => command.slash).map((slash) => (slash as { name: string }).name),
    ["tiers", "preset", "budget", "bypass", "ponytail-review", "annotate-plan"],
  );

  const budgetCommand = commands.find((command) => command.value === "model-router.budget") as {
    onSelect: () => Promise<void>;
  };
  await budgetCommand.onSelect();

  assert.deepEqual(calls, [
    ["clearPrompt"],
    ["appendPrompt", "/budget"],
    ["submitPrompt"],
  ]);
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
