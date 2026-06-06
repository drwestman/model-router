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
  assert.deepEqual(Object.keys(this.manifest ?? {}).sort(), ["description", "name", "skills", "version"]);
  assert.equal(this.manifest?.skills, "./skills/");
  assert.match(String(this.manifest?.skills), /^\.\//);
  assert.doesNotMatch(String(this.manifest?.skills), /(^|\/)\.\.(\/|$)/);
});

Then("the routing skill should be present", function (this: CodexPluginWorld) {
  const skill = readFileSync(skillPath, "utf8");
  assert.match(skill, /^---\nname: model-router-routing\ndescription: .+\n---/);
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
