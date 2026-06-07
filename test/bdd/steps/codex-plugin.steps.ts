import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { Given, Then, When } from "@cucumber/cucumber";

import {
  codexPluginHooksPath,
  codexPluginManifestPath,
  codexPluginRoot,
  codexPluginSkillsPath,
  codexSessionStartHookScriptPath,
} from "../../../packages/codex/src/index.ts";

const skillPath = path.join(codexPluginSkillsPath, "model-router-routing", "SKILL.md");
const appManifestPath = path.join(codexPluginRoot, ".app.json");
const codexAgentsRoot = path.resolve(".codex/agents");
const codexAgentPaths = [
  path.join(codexAgentsRoot, "router_fast.toml"),
  path.join(codexAgentsRoot, "router_medium.toml"),
  path.join(codexAgentsRoot, "router_heavy.toml"),
];

type CodexPluginWorld = {
  manifest?: Record<string, unknown>;
  hooks?: { hooks?: Record<string, unknown> };
  importError?: unknown;
};

Given("the Codex plugin bundle is available", function (this: CodexPluginWorld) {
  assert.ok(existsSync(codexPluginManifestPath), "manifest missing");
  assert.ok(existsSync(codexPluginHooksPath), "hooks file missing");
  assert.ok(existsSync(skillPath), "skill file missing");
});

When("I inspect the Codex plugin bundle assets", async function (this: CodexPluginWorld) {
  this.manifest = JSON.parse(readFileSync(codexPluginManifestPath, "utf8")) as Record<string, unknown>;
  this.hooks = JSON.parse(readFileSync(codexPluginHooksPath, "utf8")) as {
    hooks?: Record<string, unknown>;
  };

  try {
    await import("../../../packages/codex/src/index.ts");
  } catch (error) {
    this.importError = error;
  }
});

Then("the manifest should use safe relative plugin paths", function (this: CodexPluginWorld) {
  assert.deepEqual(Object.keys(this.manifest ?? {}).sort(), ["apps", "description", "name", "skills", "version"]);
  assert.equal(this.manifest?.apps, "./.app.json");
  assert.equal(this.manifest?.skills, "./skills/");
  assert.match(String(this.manifest?.apps), /^\.\//);
  assert.doesNotMatch(String(this.manifest?.apps), /(^|\/)\.\.(\/|$)/);
  assert.match(String(this.manifest?.skills), /^\.\//);
  assert.doesNotMatch(String(this.manifest?.skills), /(^|\/)\.\.(\/|$)/);

  assert.ok(existsSync(appManifestPath), ".app.json missing");
  assert.deepEqual(JSON.parse(readFileSync(appManifestPath, "utf8")) as Record<string, unknown>, {
    apps: {},
  });
});

Then("the routing skill should be present", function (this: CodexPluginWorld) {
  const skill = readFileSync(skillPath, "utf8");
  assert.match(skill, /^---\nname: model-router-routing\ndescription: .+\n---/);
  assert.match(skill, /spawn built-in `explorer`/i);
  assert.match(skill, /spawn built-in `worker`/i);
  assert.match(skill, /`router_fast`/i);
  assert.match(skill, /`router_medium`/i);
  assert.match(skill, /`router_heavy`/i);
  assert.match(skill, /built-in `explorer`/i);
  assert.match(skill, /built-in `worker`/i);
});

Then("the repo should define Codex router agents", function () {
  const expectedModels = new Map([
    ["router_fast.toml", 'model = "gpt-5.4-mini"'],
    ["router_medium.toml", 'model = "gpt-5.4"'],
    ["router_heavy.toml", 'model = "gpt-5.5"'],
  ]);

  for (const agentPath of codexAgentPaths) {
    assert.ok(existsSync(agentPath), `${path.basename(agentPath)} missing`);
    const agentConfig = readFileSync(agentPath, "utf8");
    assert.match(agentConfig, /^name = "/m);
    assert.match(agentConfig, /^description = "/m);
    assert.match(agentConfig, /^nickname_candidates = \[/m);
    assert.match(agentConfig, /^model = "/m);
    assert.match(agentConfig, /^developer_instructions = """/m);
    assert.match(agentConfig, new RegExp(expectedModels.get(path.basename(agentPath)) ?? "^$"));
  }
});

Then("the hooks file should define a SessionStart hook", function (this: CodexPluginWorld) {
  assert.ok(existsSync(codexSessionStartHookScriptPath), "hook script missing");
  assert.deepEqual(this.hooks, {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: 'node "${PLUGIN_ROOT}/hooks/session-start.mjs"',
            },
          ],
        },
      ],
    },
  });
});

Then("the Codex package files should avoid scaffold-only wording", function () {
  for (const relativePath of ["package.json", "README.md", "tiers.json", "src/index.ts"]) {
    const content = readFileSync(path.join(codexPluginRoot, relativePath), "utf8");
    assert.doesNotMatch(content, /scaffold|not implemented yet/i, `${relativePath} contains scaffold-only wording`);
  }
});

Then("importing the Codex package entrypoint should not throw", function (this: CodexPluginWorld) {
  assert.equal(this.importError, undefined);
});
