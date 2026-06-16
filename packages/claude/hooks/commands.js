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

const COMMAND_HANDLERS = {
  tiers: (config, state) => buildTiersText(config, state),
  preset: (config, state, argText, args) => handlePreset(config, state, args),
  mode: (config, state, argText, args) => handleMode(config, state, args),
  bypass: (config, state, argText, args) => handleBypass(config, state, args),
  "annotate-plan": (config, state, argText) => handleAnnotatePlan(argText),
  "ponytail-review": (config, state, argText) => handlePonytailReview(argText),
};

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileKeywordRegexes(keywords) {
  return keywords.map((keyword) => {
    const pattern = keyword
      .trim()
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s+");

    return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`);
  });
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

const FAST_KEYWORD_REGEXES = compileKeywordRegexes(FAST_KEYWORDS);
const MEDIUM_KEYWORD_REGEXES = compileKeywordRegexes(MEDIUM_KEYWORDS);
const HEAVY_KEYWORD_REGEXES = compileKeywordRegexes(HEAVY_KEYWORDS);

function includesKeyword(text, regexes) {
  return regexes.some((regex) => regex.test(text));
}

function getPlanTier(step) {
  const text = step.toLowerCase();

  if (includesKeyword(text, HEAVY_KEYWORD_REGEXES)) {
    return "heavy";
  }

  if (includesKeyword(text, MEDIUM_KEYWORD_REGEXES)) {
    return "medium";
  }

  if (includesKeyword(text, FAST_KEYWORD_REGEXES)) {
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
    .split(";")
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

function normalizeCommandName(command) {
  if (typeof command !== "string") {
    return null;
  }

  const trimmed = command.trim();

  if (!trimmed) {
    return null;
  }

  const bare = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;

  if (bare.startsWith("model-router:")) {
    return bare.slice("model-router:".length);
  }

  if (bare.startsWith("model-router.")) {
    return bare.slice("model-router.".length);
  }

  return bare;
}

function runCommand(config, state, command, argText = "") {
  const commandName = normalizeCommandName(command);

  if (!commandName) {
    return null;
  }

  const args = argText.trim() ? argText.trim().split(/\s+/) : [];
  const handler = COMMAND_HANDLERS[commandName];

  return handler ? handler(config, state, argText, args) : null;
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

  return runCommand(config, state, command, argText);
}

module.exports = {
  handleCommand,
  normalizeCommandName,
  runCommand,
};
