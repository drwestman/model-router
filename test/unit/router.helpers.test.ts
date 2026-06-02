import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPersistedState,
  buildCapBanner,
  buildDelegationProtocol,
  loadConfigFromPaths,
  parseCapDirective,
  writeStateFile,
} from "../../src/index.ts";
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
