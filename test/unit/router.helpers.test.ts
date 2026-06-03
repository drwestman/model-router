import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPersistedState,
  buildAgentDefinition,
  buildCapBanner,
  buildDelegationProtocol,
  extractDispatchText,
  loadConfigFromPaths,
  parseCapDirective,
  writeStateFile,
} from "../../src/index.ts";
import { isClaudeModel } from "../../src/providers/claude.ts";
import { createRouterTestEnv, readJSONFile } from "../helpers/router-test-env.ts";

test("loadConfigFromPaths applies persisted preset and mode", () => {
  const env = createRouterTestEnv({ activePreset: "OPENAI", activeMode: "budget" });

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

test("writeStateFile merges existing state keys", () => {
  const env = createRouterTestEnv({ activePreset: "anthropic" });

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
