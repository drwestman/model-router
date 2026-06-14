const {
  getMode,
  getPreset,
  listGlobalModeNames,
  listPresetNames,
} = require("./config");
const { buildStateText, buildTiersText } = require("./instructions");
const { saveState } = require("./state");

function usage(command, values) {
  return `[model-router] usage: ${command} ${values}`;
}

function handlePreset(config, state, args) {
  const presetName = args[0];

  if (!presetName) {
    return usage("/preset", `<name> (${listPresetNames(config).join(", ")})`);
  }

  if (!getPreset(config, presetName)) {
    return `[model-router] unknown preset '${presetName}'. Available: ${listPresetNames(config).join(", ")}`;
  }

  const next = saveState(config, {
    ...state,
    activePreset: presetName,
  });

  return buildStateText(next);
}

function handleMode(config, state, args) {
  const modeName = args[0];

  if (!modeName) {
    return usage("/mode", `<name> (${listGlobalModeNames(config).join(", ")})`);
  }

  if (!getMode(config, modeName)) {
    return `[model-router] unknown mode '${modeName}'. Available: ${listGlobalModeNames(config).join(", ")}`;
  }

  const next = saveState(config, {
    ...state,
    activeMode: modeName,
  });

  return buildStateText(next);
}

function handleBypass(config, state, args) {
  const value = args[0];

  if (value !== "on" && value !== "off") {
    return "[model-router] usage: /bypass on|off";
  }

  const next = saveState(config, {
    ...state,
    bypass: value === "on",
  });

  return buildStateText(next);
}

const FAST_KEYWORDS = [
  "search",
  "inspect",
  "read",
  "list",
  "check",
  "grep",
  "docs",
];

const MEDIUM_KEYWORDS = [
  "implement",
  "change",
  "edit",
  "refactor",
  "add",
  "update",
  "test",
  "fix",
  "write",
  "debug",
];

const HEAVY_KEYWORDS = [
  "architecture",
  "root cause",
  "performance",
  "security",
  "migrate",
  "migration",
  "debug complex",
  "complex debug",
];

function includesKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getPlanTier(step) {
  const text = step.toLowerCase();

  if (includesKeyword(text, HEAVY_KEYWORDS)) {
    return "heavy";
  }

  if (includesKeyword(text, MEDIUM_KEYWORDS)) {
    return "medium";
  }

  if (includesKeyword(text, FAST_KEYWORDS)) {
    return "fast";
  }

  return "medium";
}

function getPlanSteps(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.includes("\n")) {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return trimmed
    .split(/[;,]/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function annotateStep(step) {
  const match = step.match(/^([-*+]\s+|\d+[.)]\s+)(.*)$/);
  const prefix = match ? match[1] : "";
  const body = match ? match[2].trim() : step.trim();

  if (!body) {
    return null;
  }

  return `${prefix}${body} [tier:${getPlanTier(body)}]`;
}

function handleAnnotatePlan(argText) {
  const steps = getPlanSteps(argText)
    .map(annotateStep)
    .filter(Boolean);

  if (steps.length === 0) {
    return "[model-router] usage: /annotate-plan <plan text>";
  }

  return steps.join("\n");
}

function handlePonytailReview(argText) {
  const text = argText.trim();

  if (!text) {
    return [
      "[model-router] ponytail review",
      "- delete non-required work first",
      "- prefer stdlib/native before deps",
      "- keep files/helpers/tests minimal",
    ].join("\n");
  }

  const lower = text.toLowerCase();
  const cut = [];
  const keep = ["direct hook change only", "targeted smoke test only"];
  const escalate = [];

  if (/(dependency|package|library|framework)/.test(lower)) {
    cut.push("new dependency unless stdlib/native fails");
  }

  if (/(abstract|abstraction|helper|utility|wrapper|framework)/.test(lower)) {
    cut.push("extra abstraction until duplication is real");
  }

  if (/(file|module|folder|directory)/.test(lower)) {
    cut.push("multi-file spread if one file can do it");
  }

  if (/(state|persist|session|startup|system prompt)/.test(lower)) {
    escalate.push("it changes state or session-start behavior");
  }

  if (/(migrate|migration|architecture|rewrite|platform)/.test(lower)) {
    escalate.push("it stops being a small hook change");
  }

  return [
    "[model-router] ponytail review",
    `cut: ${cut.join("; ") || "anything not required for the asked behavior"}`,
    `keep: ${keep.join("; ")}`,
    `escalate only if: ${escalate.join("; ") || "the change cannot stay local and transient"}`,
  ].join("\n");
}

function handleCommand(config, state, prompt) {
  if (typeof prompt !== "string") {
    return null;
  }

  const trimmed = prompt.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const match = trimmed.match(/^(\/\S+)(?:\s+([\s\S]*))?$/);

  if (!match) {
    return null;
  }

  const [, command, argText = ""] = match;
  const args = argText.trim() ? argText.trim().split(/\s+/) : [];

  switch (command) {
    case "/tiers":
      return buildTiersText(config, state);
    case "/preset":
      return handlePreset(config, state, args);
    case "/mode":
      return handleMode(config, state, args);
    case "/bypass":
      return handleBypass(config, state, args);
    case "/annotate-plan":
      return handleAnnotatePlan(argText);
    case "/ponytail-review":
      return handlePonytailReview(argText);
    default:
      return null;
  }
}

module.exports = {
  handleCommand,
};
