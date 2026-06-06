import assert from "node:assert/strict";
import test from "node:test";
import { composePrompt } from "../../packages/opencode/src/index.ts";
import { isClaudeModel } from "../../packages/opencode/src/providers/claude.ts";

test("composePrompt returns undefined when both parts are absent after normalization", () => {
  assert.equal(composePrompt(undefined, "   \n\t  "), undefined);
  assert.equal(composePrompt("", undefined), undefined);
  assert.equal(composePrompt(" \n ", "\t"), undefined);
});

test("composePrompt returns the single normalized part when only one exists", () => {
  assert.equal(composePrompt("  prefix block  ", undefined), "prefix block");
  assert.equal(composePrompt(undefined, "\n  prompt block\n"), "prompt block");
  assert.equal(composePrompt("\n\t", "  prompt block  "), "prompt block");
});

test("composePrompt trims outer whitespace and preserves internal formatting when joining", () => {
  const result = composePrompt(
    "\n  Prefix line 1\n    Prefix line 2\n\n",
    "\n\nPrompt line 1\n  Prompt line 2\n",
  );

  assert.equal(
    result,
    "Prefix line 1\n    Prefix line 2\n\n---\n\nPrompt line 1\n  Prompt line 2",
  );
});

test("isClaudeModel matches direct and proxied Claude model identifiers", () => {
  assert.equal(isClaudeModel("anthropic/claude-3-5-sonnet"), true);
  assert.equal(isClaudeModel("openrouter/anthropic/claude-3.5-sonnet"), true);
  assert.equal(isClaudeModel("bedrock/us.anthropic.claude-3-5-sonnet-20241022-v2:0"), true);
  assert.equal(isClaudeModel("vertex/claude-3-5-haiku"), true);
});

test("isClaudeModel rejects undefined, empty, and non-Claude identifiers", () => {
  assert.equal(isClaudeModel(undefined), false);
  assert.equal(isClaudeModel(""), false);
  assert.equal(isClaudeModel("openai/gpt-5"), false);
  assert.equal(isClaudeModel("custom/sonnet-4"), false);
});
