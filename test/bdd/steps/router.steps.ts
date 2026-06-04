import assert from "node:assert/strict";

import { After, Given, Then, When, setWorldConstructor } from "@cucumber/cucumber";

import ModelRouterPlugin, { invalidateConfigCache } from "../../../src/index.ts";
import {
  createRouterTestEnv,
  loadFixtureConfig,
  readJSONFile,
  type RouterTestEnvOptions,
  type TestRouterEnv,
} from "../../helpers/router-test-env.ts";

type PluginHooks = Awaited<ReturnType<typeof ModelRouterPlugin>> & Record<string, any>;

class RouterWorld {
  env?: TestRouterEnv;
  plugin?: PluginHooks;
  commandOutput = "";
  registeredConfig: Record<string, any> = {};
  systemPrompt = "";
  enforcementOutput = "";

  async load(options: RouterTestEnvOptions = {}): Promise<void> {
    this.env?.cleanup();
    this.env = createRouterTestEnv(options);
    invalidateConfigCache();
    this.plugin = (await ModelRouterPlugin({} as never)) as PluginHooks;
  }
}

setWorldConstructor(RouterWorld);

After(function (this: RouterWorld) {
  this.env?.cleanup();
  invalidateConfigCache();
});

Given("the router plugin is loaded from the fixture config", async function (this: RouterWorld) {
  await this.load();
});

Given(
  "the router plugin is loaded with malformed persisted state",
  async function (this: RouterWorld) {
    await this.load({ rawStateContent: "null" });
  },
);

When("I run the {string} command", async function (this: RouterWorld, commandText: string) {
  assert.ok(this.plugin, "plugin was not loaded");
  const match = commandText.match(/^\/(\S+)(?:\s+(.*))?$/);
  assert.ok(match, `invalid command: ${commandText}`);

  const output = { parts: [] as Array<{ type: "text"; text: string }> };
  await this.plugin["command.execute.before"](
    {
      command: match[1],
      arguments: match[2] ?? "",
    },
    output,
  );

  this.commandOutput = output.parts.map((part) => part.text).join("\n\n");
});

When("I register router agents", async function (this: RouterWorld) {
  assert.ok(this.plugin, "plugin was not loaded");
  this.registeredConfig = {
    provider: {
      anthropic: {},
      openai: {},
    },
    enabled_providers: ["anthropic", "openai"],
  };
  await this.plugin.config(this.registeredConfig);
});

When(
  "I register router agents without provider metadata",
  async function (this: RouterWorld) {
    assert.ok(this.plugin, "plugin was not loaded");
    this.registeredConfig = {};
    await this.plugin.config(this.registeredConfig);
  },
);

When(
  "I transform the system prompt for an anthropic orchestrator",
  async function (this: RouterWorld) {
    assert.ok(this.plugin, "plugin was not loaded");
    const output = { system: [] as string[] };
    await this.plugin["experimental.chat.system.transform"](
      {
        model: {
          providerID: "anthropic",
          modelID: "claude-sonnet-4-6",
        },
      },
      output,
    );

    this.systemPrompt = output.system.join("\n\n");
  },
);

When(
  "I dispatch a fast subagent with cap 2 and repeat the same read",
  async function (this: RouterWorld) {
    assert.ok(this.plugin, "plugin was not loaded");

    await this.plugin["chat.message"](
      {
        agent: "fast",
        sessionID: "fixture-session",
      },
      {
        parts: [{ text: "Investigate the fixture. CAP:2" }],
      },
    );

    const firstOutput = { output: "first read" };
    await this.plugin["tool.execute.after"](
      {
        sessionID: "fixture-session",
        tool: "read",
        args: { filePath: "src/index.ts" },
      },
      firstOutput,
    );

    const secondOutput = { output: "second read" };
    await this.plugin["tool.execute.after"](
      {
        sessionID: "fixture-session",
        tool: "read",
        args: { filePath: "src/index.ts" },
      },
      secondOutput,
    );

    this.enforcementOutput = `${firstOutput.output}\n\n${secondOutput.output}`;
  },
);

Then("the command output should mention preset switching", function (this: RouterWorld) {
  assert.match(this.commandOutput, /Preset switched to \*\*openai\*\*/);
  assert.match(this.commandOutput, /persisted/i);
});

Then("the persisted state should contain preset {string}", function (this: RouterWorld, preset: string) {
  assert.ok(this.env, "environment missing");
  const state = readJSONFile<{ activePreset?: string }>(this.env.statePath);
  assert.equal(state.activePreset, preset);
});

Then("the command output should mention budget mode switching", function (this: RouterWorld) {
  assert.match(this.commandOutput, /Routing mode switched to \*\*budget\*\*/);
  assert.match(this.commandOutput, /Default tier: @fast/);
  assert.match(this.commandOutput, /Active rules:/);
});

Then("the persisted state should contain mode {string}", function (this: RouterWorld, mode: string) {
  assert.ok(this.env, "environment missing");
  const state = readJSONFile<{ activeMode?: string }>(this.env.statePath);
  assert.equal(state.activeMode, mode);
});

Then("the registered agents should match the active fixture preset", function (this: RouterWorld) {
  const fixture = loadFixtureConfig() as {
    activePreset: string;
    presets: Record<
      string,
      Record<
        string,
        {
          model: string;
          description: string;
          steps: number;
          variant?: string;
          prompt?: string;
        }
      >
    >;
  };
  const agents = this.registeredConfig.agent as Record<
    string,
    {
      model: string;
      description: string;
      mode: string;
      maxSteps: number;
      variant?: string;
      prompt?: string;
    }
  >;
  const activePreset = fixture.presets[fixture.activePreset]!;

  assert.deepEqual(Object.keys(agents).sort(), Object.keys(activePreset).sort());

  for (const [name, tier] of Object.entries(activePreset)) {
    assert.equal(agents[name]?.model, tier.model);
    assert.equal(agents[name]?.description, tier.description);
    assert.equal(agents[name]?.mode, "subagent");
    assert.equal(agents[name]?.maxSteps, tier.steps);
    assert.equal(agents[name]?.variant, tier.variant);
    assert.match(String(agents[name]?.prompt), /ANTI-NARRATION/);
    assert.match(String(agents[name]?.prompt), new RegExp(tier.prompt!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

Then("the router commands should be registered", function (this: RouterWorld) {
  const commands = this.registeredConfig.command as Record<string, unknown>;
  assert.ok(commands, "commands missing");
  for (const name of ["tiers", "preset", "budget", "bypass", "annotate-plan"]) {
    assert.ok(commands[name], `missing command: ${name}`);
  }
});

Then("the system prompt should include the required routing sections", function (this: RouterWorld) {
  assert.match(this.systemPrompt, /AUTHORITY OVERRIDE/);
  assert.match(this.systemPrompt, /ANTI-NARRATION/);
  assert.match(this.systemPrompt, /Model Delegation Protocol/);
  assert.match(this.systemPrompt, /Preset: anthropic/);
  assert.match(this.systemPrompt, /Tiers:/);
  assert.match(this.systemPrompt, /R:/);
  assert.match(this.systemPrompt, /Compact rules/);
});

Then(
  "the enforcement output should include cap tracking and redundancy warnings",
  function (this: RouterWorld) {
    assert.match(this.enforcementOutput, /\[cap: 1\/2\]/);
    assert.match(this.enforcementOutput, /\[cap: 2\/2\]/);
    assert.match(this.enforcementOutput, /REDUNDANT/);
    assert.match(this.enforcementOutput, /CAP REACHED/);
  },
);
