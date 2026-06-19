var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/claude/src/bridge.ts
var bridge_exports = {};
__export(bridge_exports, {
  activateMain: () => activateMain,
  adapterName: () => adapterName,
  buildDelegationTemplate: () => buildDelegationTemplate,
  buildPromptContext: () => buildPromptContext,
  buildSessionText: () => buildSessionText,
  buildStateText: () => buildStateText,
  buildTiersText: () => buildTiersText,
  commands: () => commands,
  config: () => config,
  defaultModeForPreset: () => defaultModeForPreset,
  defaultState: () => defaultState,
  getMode: () => getMode,
  getPreset: () => getPreset,
  getTier: () => getTier,
  handleCommand: () => handleCommand,
  instructions: () => instructions,
  listGlobalModeNames: () => listGlobalModeNames,
  listPresetNames: () => listPresetNames,
  loadConfig: () => loadConfig,
  loadState: () => loadState,
  normalizeCommandName: () => normalizeCommandName,
  normalizeState: () => normalizeState,
  output: () => output,
  promptSubmitMain: () => promptSubmitMain,
  resolveAdapterPaths: () => resolveAdapterPaths,
  runCommand: () => runCommand,
  runCommandMain: () => runCommandMain,
  saveState: () => saveState,
  scorePrompt: () => scorePrompt,
  state: () => state
});
module.exports = __toCommonJS(bridge_exports);
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// packages/core/src/index.ts
var import_fs = require("fs");
var import_os = require("os");
var import_path = require("path");
var import_url = require("url");
var MODE_COMMAND_NAME = "mode";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function normalizeConfiguredPath(value) {
  const trimmed = value?.trim();
  if (!trimmed) return void 0;
  if (!trimmed.startsWith("file://")) return trimmed;
  try {
    return (0, import_url.fileURLToPath)(trimmed);
  } catch {
    return trimmed;
  }
}
function ensureObject(value, message) {
  if (!isRecord(value)) {
    throw new Error(message);
  }
  return value;
}
function validateTierConfig(presetName, tierName, value) {
  const tier = ensureObject(
    value,
    `tiers.json: tier '${presetName}.${tierName}' must be an object`
  );
  if (typeof tier.model !== "string" || !tier.model.trim()) {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.model' must be a non-empty string`
    );
  }
  if (typeof tier.description !== "string") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.description' must be a string`
    );
  }
  if (!isStringArray(tier.whenToUse)) {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.whenToUse' must be an array of strings`
    );
  }
  if (tier.variant !== void 0 && typeof tier.variant !== "string") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.variant' must be a string`
    );
  }
  if (tier.color !== void 0 && typeof tier.color !== "string") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.color' must be a string`
    );
  }
  if (tier.prompt !== void 0 && typeof tier.prompt !== "string") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.prompt' must be a string`
    );
  }
  if (tier.costRatio !== void 0 && typeof tier.costRatio !== "number") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.costRatio' must be a number`
    );
  }
  if (tier.steps !== void 0 && (typeof tier.steps !== "number" || !Number.isInteger(tier.steps) || tier.steps < 1)) {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.steps' must be a positive integer`
    );
  }
  if (tier.thinking !== void 0) {
    const thinking = ensureObject(
      tier.thinking,
      `tiers.json: '${presetName}.${tierName}.thinking' must be an object`
    );
    if (thinking.budgetTokens !== void 0 && typeof thinking.budgetTokens !== "number") {
      throw new Error(
        `tiers.json: '${presetName}.${tierName}.thinking.budgetTokens' must be a number`
      );
    }
  }
  if (tier.reasoning !== void 0) {
    const reasoning = ensureObject(
      tier.reasoning,
      `tiers.json: '${presetName}.${tierName}.reasoning' must be an object`
    );
    if (reasoning.effort !== void 0 && reasoning.effort !== "low" && reasoning.effort !== "medium" && reasoning.effort !== "high") {
      throw new Error(
        `tiers.json: '${presetName}.${tierName}.reasoning.effort' must be a string`
      );
    }
    if (reasoning.summary !== void 0 && reasoning.summary !== "auto" && reasoning.summary !== "always" && reasoning.summary !== "never") {
      throw new Error(
        `tiers.json: '${presetName}.${tierName}.reasoning.summary' must be a string`
      );
    }
  }
  return tier;
}
function validateConfig(raw) {
  const obj = ensureObject(raw, "tiers.json: expected a JSON object at root");
  if (typeof obj.activePreset !== "string" || !obj.activePreset.trim()) {
    throw new Error("tiers.json: 'activePreset' must be a non-empty string");
  }
  if (obj.activeMode !== void 0 && typeof obj.activeMode !== "string") {
    throw new Error("tiers.json: 'activeMode' must be a string");
  }
  const presets = ensureObject(obj.presets, "tiers.json: 'presets' must be a non-null object");
  const normalizedPresets = {};
  for (const [presetName, presetValue] of Object.entries(presets)) {
    const preset = ensureObject(
      presetValue,
      `tiers.json: preset '${presetName}' must be an object`
    );
    const normalizedPreset = {};
    for (const [tierName, tierValue] of Object.entries(preset)) {
      normalizedPreset[tierName] = validateTierConfig(presetName, tierName, tierValue);
    }
    normalizedPresets[presetName] = normalizedPreset;
  }
  if (!Object.prototype.hasOwnProperty.call(normalizedPresets, obj.activePreset)) {
    throw new Error(
      `tiers.json: activePreset '${obj.activePreset}' is not defined in presets`
    );
  }
  if (!isStringArray(obj.rules)) {
    throw new Error("tiers.json: 'rules' must be an array of strings");
  }
  if (typeof obj.defaultTier !== "string") {
    throw new Error("tiers.json: 'defaultTier' must be a string");
  }
  if (obj.modes !== void 0) {
    const modes = ensureObject(obj.modes, "tiers.json: 'modes' must be an object");
    for (const [modeName, value] of Object.entries(modes)) {
      const mode = ensureObject(value, `tiers.json: mode '${modeName}' must be an object`);
      if (typeof mode.defaultTier !== "string") {
        throw new Error(`tiers.json: mode '${modeName}.defaultTier' must be a string`);
      }
      if (typeof mode.description !== "string") {
        throw new Error(`tiers.json: mode '${modeName}.description' must be a string`);
      }
      if (mode.overrideRules !== void 0 && !isStringArray(mode.overrideRules)) {
        throw new Error(
          `tiers.json: mode '${modeName}.overrideRules' must be an array of strings`
        );
      }
      if (mode.tierPrompts !== void 0) {
        const tierPrompts = ensureObject(
          mode.tierPrompts,
          `tiers.json: mode '${modeName}.tierPrompts' must be an object`
        );
        for (const [tierName, prompt] of Object.entries(tierPrompts)) {
          if (typeof prompt !== "string") {
            throw new Error(
              `tiers.json: mode '${modeName}.tierPrompts.${tierName}' must be a string`
            );
          }
        }
      }
    }
  }
  if (obj.tierCaps !== void 0) {
    const caps = ensureObject(obj.tierCaps, "tiers.json: 'tierCaps' must be an object");
    for (const [tierName, value] of Object.entries(caps)) {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        throw new Error(`tiers.json: tierCaps.'${tierName}' must be a positive integer`);
      }
    }
  }
  if (obj.tierPrompts !== void 0) {
    const prompts = ensureObject(
      obj.tierPrompts,
      "tiers.json: 'tierPrompts' must be an object"
    );
    for (const [tierName, value] of Object.entries(prompts)) {
      if (typeof value !== "string") {
        throw new Error(`tiers.json: tierPrompts.'${tierName}' must be a string`);
      }
    }
  }
  if (obj.taskPatterns !== void 0) {
    const taskPatterns = ensureObject(
      obj.taskPatterns,
      "tiers.json: 'taskPatterns' must be an object"
    );
    for (const [tierName, value] of Object.entries(taskPatterns)) {
      if (!isStringArray(value)) {
        throw new Error(`tiers.json: taskPatterns.'${tierName}' must be an array of strings`);
      }
    }
  }
  if (obj.fallback !== void 0) {
    ensureObject(obj.fallback, "tiers.json: 'fallback' must be an object");
  }
  const normalizedModes = obj.modes;
  const normalizedTierCaps = obj.tierCaps;
  const normalizedTierPrompts = obj.tierPrompts;
  const normalizedTaskPatterns = obj.taskPatterns;
  const normalizedFallback = obj.fallback;
  return {
    activePreset: obj.activePreset,
    activeMode: obj.activeMode,
    presets: normalizedPresets,
    rules: obj.rules,
    defaultTier: obj.defaultTier,
    modes: normalizedModes,
    tierCaps: normalizedTierCaps,
    tierPrompts: normalizedTierPrompts,
    taskPatterns: normalizedTaskPatterns,
    fallback: normalizedFallback
  };
}
function readConfig(configPath) {
  return validateConfig(JSON.parse((0, import_fs.readFileSync)(configPath, "utf-8")));
}
function resolvePresetName(cfg, requestedPreset) {
  if (cfg.presets[requestedPreset]) {
    return requestedPreset;
  }
  const normalized = requestedPreset.trim().toLowerCase();
  if (!normalized) return void 0;
  return Object.keys(cfg.presets).find((name) => name.toLowerCase() === normalized);
}
function resolveActivePreset(cfg, state2) {
  const requested = state2?.activePreset?.trim();
  if (requested) {
    const resolved = resolvePresetName(cfg, requested);
    if (resolved) return resolved;
  }
  return cfg.activePreset;
}
function resolveModeConfig(cfg, modeName) {
  const resolvedMode = resolveModeName(cfg, modeName);
  return resolvedMode ? cfg.modes?.[resolvedMode] : void 0;
}
function resolveModeName(cfg, requestedMode) {
  if (!requestedMode || !cfg.modes) return void 0;
  if (cfg.modes[requestedMode]) return requestedMode;
  const normalized = requestedMode.trim().toLowerCase();
  if (!normalized) return void 0;
  return Object.keys(cfg.modes).find((name) => name.toLowerCase() === normalized);
}
function resolveActiveMode(cfg, state2) {
  return resolveModeName(cfg, state2?.activeMode?.trim() || cfg.activeMode?.trim());
}
function calculateTierCaps(cfg) {
  return { ...cfg.tierCaps ?? {} };
}
function resolvePolicy(cfg, state2) {
  const activePreset = resolveActivePreset(cfg, state2);
  const activeMode = resolveActiveMode(cfg, state2);
  const mode = resolveModeConfig(cfg, activeMode);
  return {
    activePreset,
    activeMode,
    defaultTier: mode?.defaultTier ?? cfg.defaultTier,
    rules: mode?.overrideRules ?? cfg.rules,
    tierCaps: calculateTierCaps(cfg),
    taskPatterns: { ...cfg.taskPatterns ?? {} }
  };
}
function createAdapterPaths(options) {
  const env = options.env ?? process.env;
  const configEnvVar = options.configEnvVar ?? "MODEL_ROUTER_CONFIG_PATH";
  const stateEnvVar = options.stateEnvVar ?? "MODEL_ROUTER_STATE_PATH";
  const configuredConfigPath = normalizeConfiguredPath(env[configEnvVar]);
  const configuredStatePath = normalizeConfiguredPath(env[stateEnvVar]);
  return {
    configPath: configuredConfigPath ?? (0, import_path.join)(options.packageRoot, options.configFileName ?? "tiers.json"),
    statePath: configuredStatePath ?? (0, import_path.join)(
      (0, import_os.homedir)(),
      ...options.stateDirectorySegments ?? [".config", options.host],
      options.stateFileName ?? `${options.host}-model-router.state.json`
    )
  };
}
function readState(statePath) {
  if (!(0, import_fs.existsSync)(statePath)) return void 0;
  return JSON.parse((0, import_fs.readFileSync)(statePath, "utf-8"));
}
function writeState(statePath, state2) {
  const dirPath = (0, import_path.dirname)(statePath);
  if (!(0, import_fs.existsSync)(dirPath)) {
    (0, import_fs.mkdirSync)(dirPath, { recursive: true });
  }
  (0, import_fs.writeFileSync)(statePath, JSON.stringify(state2, null, 2));
}
function packageRootFrom(importMetaUrl) {
  return (0, import_path.join)((0, import_path.dirname)((0, import_url.fileURLToPath)(importMetaUrl)), "..");
}

// packages/claude/src/bridge.ts
var import_meta = {};
var TIER_NAMES = ["fast", "medium", "heavy"];
var RULE_KEYWORDS = {
  fast: [
    "search",
    "inspect",
    "read",
    "list",
    "check",
    "grep",
    "docs",
    "lookup",
    "look up",
    "summarize",
    "find"
  ],
  medium: [
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
    "create",
    "build",
    "review"
  ],
  heavy: [
    "architecture",
    "root cause",
    "performance",
    "security",
    "migrate",
    "migration",
    "multi-system",
    "tradeoff",
    "rewrite",
    "deep analysis",
    "complex debug"
  ]
};
var COMMAND_USAGE = "run-command <tiers|preset|mode|bypass|delegate|annotate-plan|ponytail-review> [args]";
function resolvePackageRoot() {
  if (typeof __dirname === "string" && __dirname) {
    return (0, import_node_path.join)(__dirname, "..");
  }
  return packageRootFrom(import_meta.url);
}
var adapterName = "claude";
var adapterPathOptions = {
  host: adapterName,
  packageRoot: resolvePackageRoot(),
  configEnvVar: "CLAUDE_MODEL_ROUTER_CONFIG_PATH",
  stateEnvVar: "CLAUDE_MODEL_ROUTER_STATE_PATH",
  stateDirectorySegments: [".config", "claude"],
  stateFileName: "model-router.state.json"
};
function resolveAdapterPaths(env = process.env) {
  return createAdapterPaths({
    ...adapterPathOptions,
    env
  });
}
function fail(message) {
  throw new Error(`[model-router] ${message}`);
}
function isTierName(value) {
  return TIER_NAMES.includes(value);
}
function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function compileKeywordRegex(keyword) {
  const pattern = keyword.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`, "i");
}
var RULE_KEYWORD_REGEXES = {
  fast: RULE_KEYWORDS.fast.map(compileKeywordRegex),
  medium: RULE_KEYWORDS.medium.map(compileKeywordRegex),
  heavy: RULE_KEYWORDS.heavy.map(compileKeywordRegex)
};
function hasKeyword(text, keyword) {
  return (keyword instanceof RegExp ? keyword : compileKeywordRegex(keyword)).test(text);
}
function addMatches(text, tier, patterns, weight, scores) {
  let matches = 0;
  for (const pattern of patterns) {
    if (hasKeyword(text, pattern)) {
      scores[tier] += weight;
      matches += 1;
    }
  }
  return matches;
}
function getPolicyDefaultTier(policyDefaultTier) {
  return isTierName(policyDefaultTier) ? policyDefaultTier : "medium";
}
function scorePrompt(config2, state2, prompt) {
  const text = normalizeText(prompt).toLowerCase();
  const policy = resolvePolicy(config2, state2);
  const scores = { fast: 0, medium: 0, heavy: 0 };
  let strongTier;
  const explicitTier = text.match(/(?:^|\s)(?:@|tier:)(fast|medium|heavy)(?=$|\s|[.,;:!?])/i)?.[1]?.toLowerCase();
  if (explicitTier && isTierName(explicitTier)) {
    strongTier = explicitTier;
    scores[explicitTier] += 10;
  }
  for (const tier2 of TIER_NAMES) {
    const ruleMatches = addMatches(text, tier2, RULE_KEYWORD_REGEXES[tier2], 2, scores);
    const taskPatterns = (policy.taskPatterns?.[tier2] ?? []).filter(Boolean);
    const taskMatches = addMatches(text, tier2, taskPatterns, 3, scores);
    if (!strongTier && (ruleMatches >= 2 || taskMatches >= 2)) {
      strongTier = tier2;
    }
  }
  if (!strongTier) {
    if (/^(inspect|search|read|list|grep|find|look up|lookup|summarize)\b/.test(text)) {
      strongTier = "fast";
      scores.fast += 4;
    } else if (/^(implement|fix|write|edit|refactor|add|update|test|debug|create|build)\b/.test(text)) {
      strongTier = "medium";
      scores.medium += 4;
    } else if (/^(analyze|diagnose|investigate|migrate|redesign)\b/.test(text)) {
      strongTier = "heavy";
      scores.heavy += 4;
    }
  }
  const sorted = [...TIER_NAMES].sort((left, right) => scores[right] - scores[left]);
  const tier = sorted[0] ?? getPolicyDefaultTier(policy.defaultTier);
  const topScore = scores[tier];
  const secondTier = sorted[1] ?? tier;
  const secondScore = scores[secondTier];
  const margin = topScore - secondScore;
  if (topScore < 3 || margin <= 0) {
    return {
      tier: getPolicyDefaultTier(policy.defaultTier),
      confidence: "ambiguous"
    };
  }
  if (strongTier === tier || topScore >= 6 && margin >= 2) {
    return { tier, confidence: "very-high" };
  }
  if (topScore >= 4 && margin >= 1) {
    return { tier, confidence: "moderate" };
  }
  return {
    tier: getPolicyDefaultTier(policy.defaultTier),
    confidence: "ambiguous"
  };
}
function getActivePreset(config2, state2) {
  const policy = resolvePolicy(config2, state2);
  return config2.presets[policy.activePreset] ?? {};
}
function getTierContract(tierName) {
  switch (tierName) {
    case "fast":
      return "read-only exploration, concrete findings, no code edits";
    case "heavy":
      return "deep analysis for architecture, security, performance, or hard debugging";
    default:
      return "implementation, refactoring, tests, and targeted verification";
  }
}
function buildDelegationTemplate(config2, state2, tierName, task) {
  const normalizedState = normalizeState(config2, state2);
  const policy = resolvePolicy(config2, normalizedState);
  const preset = config2.presets[policy.activePreset] ?? {};
  const tier = preset[tierName];
  if (!tier) {
    fail(`tier '${tierName}' is not available in preset '${policy.activePreset}'.`);
  }
  return [
    "[model-router]",
    `delegate: @${tierName}`,
    `preset: ${policy.activePreset}`,
    `mode: ${policy.activeMode ?? "none"}`,
    `model: ${tier.model}`,
    `cap: ${config2.tierCaps?.[tierName] ?? "none"}`,
    `contract: ${getTierContract(tierName)}`,
    "if native Claude subagents are available, delegate the task below.",
    "if they are unavailable, do the same work locally.",
    "task:",
    task.trim()
  ].join("\n");
}
function buildRoutingHint(classification) {
  if (classification.confidence !== "moderate") {
    return null;
  }
  return `[model-router] likely @${classification.tier}. Delegate if Claude subagents are available; otherwise keep the same scope locally.`;
}
function buildPromptContext(config2, state2, prompt) {
  const classification = scorePrompt(config2, state2, prompt);
  const preset = getActivePreset(config2, state2);
  if (!preset[classification.tier]) {
    return null;
  }
  if (classification.confidence === "very-high") {
    return buildDelegationTemplate(config2, state2, classification.tier, prompt.trim());
  }
  return buildRoutingHint(classification);
}
function readPromptFromStdin() {
  let input;
  try {
    input = (0, import_node_fs.readFileSync)(0, "utf8");
  } catch {
    return null;
  }
  if (!input.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed?.prompt === "string") {
      return parsed.prompt;
    }
    return typeof parsed?.data?.prompt === "string" ? parsed.data.prompt : null;
  } catch {
    return null;
  }
}
function emit(text, event = "UserPromptSubmit") {
  if (!text) {
    return;
  }
  if (process.env.PLUGIN_DATA) {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event,
          additionalContext: text
        }
      })}
`
    );
    return;
  }
  process.stdout.write(text.endsWith("\n") ? text : `${text}
`);
}
function listPresetNames(config2) {
  return Object.keys(config2.presets ?? {});
}
function listGlobalModeNames(config2) {
  return Object.keys(config2.modes ?? {});
}
function defaultModeForPreset(config2) {
  return config2.activeMode ?? listGlobalModeNames(config2)[0];
}
function getPreset(config2, presetName) {
  const resolved = resolvePresetName(config2, presetName);
  return resolved ? config2.presets[resolved] ?? null : null;
}
function getMode(config2, modeName) {
  const resolved = resolveModeName(config2, modeName);
  return resolved ? config2.modes?.[resolved] ?? null : null;
}
function getTier(config2, presetName, tierName) {
  const preset = getPreset(config2, presetName);
  return preset?.[tierName] ?? null;
}
function loadConfig() {
  return readConfig(resolveAdapterPaths().configPath);
}
function defaultState(config2) {
  return {
    activePreset: config2.activePreset,
    activeMode: defaultModeForPreset(config2),
    bypass: false
  };
}
function normalizeState(config2, input) {
  const base = defaultState(config2);
  if (!input || typeof input !== "object") {
    return base;
  }
  const value = input;
  const resolvedPreset = typeof value.activePreset === "string" ? resolvePresetName(config2, value.activePreset) : void 0;
  const resolvedMode = typeof value.activeMode === "string" ? resolveModeName(config2, value.activeMode) : void 0;
  if (resolvedPreset) {
    base.activePreset = resolvedPreset;
  }
  if (resolvedMode) {
    base.activeMode = resolvedMode;
  }
  if (typeof value.bypass === "boolean") {
    base.bypass = value.bypass;
  }
  return base;
}
function loadState(config2) {
  return normalizeState(config2, readState(resolveAdapterPaths().statePath));
}
function saveState(config2, input) {
  const next = normalizeState(config2, input);
  writeState(resolveAdapterPaths().statePath, next);
  return next;
}
function statusLine(state2) {
  return `active: ${state2.activePreset}/${state2.activeMode} | bypass: ${state2.bypass ? "on" : "off"}`;
}
function buildSessionText(config2, state2) {
  const normalizedState = normalizeState(config2, state2);
  if (normalizedState.bypass) {
    return "[model-router disabled] /bypass off to re-enable.";
  }
  const policy = resolvePolicy(config2, normalizedState);
  const preset = getActivePreset(config2, normalizedState);
  const mode = policy.activeMode ? config2.modes?.[policy.activeMode] : void 0;
  return [
    "[model-router]",
    `preset: ${policy.activePreset}`,
    `mode: ${policy.activeMode ?? "none"}`,
    `mode guidance: ${mode?.description ?? "none"}`,
    `default tier: ${policy.defaultTier}`,
    `fast: ${preset.fast?.model ?? "unavailable"}${config2.tierCaps?.fast ? ` (cap ${config2.tierCaps.fast})` : ""}`,
    `medium: ${preset.medium?.model ?? "unavailable"}${config2.tierCaps?.medium ? ` (cap ${config2.tierCaps.medium})` : ""}`,
    `heavy: ${preset.heavy?.model ?? "unavailable"}${config2.tierCaps?.heavy ? ` (cap ${config2.tierCaps.heavy})` : ""}`,
    "tag plans with [tier:fast], [tier:medium], or [tier:heavy] when work mixes exploration and implementation.",
    ...policy.rules.map((rule) => `rule: ${rule}`),
    "commands: /tiers /preset <name> /mode <name> /bypass on|off /delegate <tier> <task> /annotate-plan <plan text>",
    "if Claude subagents are unavailable, follow the same tier guidance locally."
  ].join("\n");
}
function buildTiersText(config2, state2) {
  const normalizedState = normalizeState(config2, state2);
  const policy = resolvePolicy(config2, normalizedState);
  const lines = ["[model-router]", statusLine(normalizedState), "presets:"];
  for (const presetName of listPresetNames(config2)) {
    const preset = config2.presets[presetName] ?? {};
    lines.push(
      `- ${presetName}: fast=${preset.fast?.model ?? "unavailable"}, medium=${preset.medium?.model ?? "unavailable"}, heavy=${preset.heavy?.model ?? "unavailable"}`
    );
  }
  lines.push("modes:");
  for (const modeName of listGlobalModeNames(config2)) {
    const marker = modeName === policy.activeMode ? "*" : "";
    const mode = config2.modes?.[modeName];
    lines.push(`- ${modeName}${marker}: ${mode?.description ?? ""} Default tier: ${mode?.defaultTier ?? "unknown"}.`);
  }
  return lines.join("\n");
}
function buildStateText(state2) {
  return `[model-router] ${statusLine(state2)}`;
}
function usage(command, values) {
  return `[model-router] usage: ${command} ${values}`;
}
function getPlanSteps(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.includes("\n")) {
    return trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  return trimmed.split(";").map((step) => step.trim()).filter(Boolean);
}
function annotateStep(config2, state2, step) {
  const match = step.match(/^([-*+]\s+|\d+[.)]\s+)(.*)$/);
  const prefix = match ? match[1] : "";
  const body = match ? match[2].trim() : step.trim();
  if (!body) {
    return null;
  }
  const classification = scorePrompt(config2, state2, body);
  const tier = classification.confidence === "ambiguous" ? getPolicyDefaultTier(resolvePolicy(config2, state2).defaultTier) : classification.tier;
  return `${prefix}${body} [tier:${tier}]`;
}
function handlePreset(config2, state2, args) {
  const presetName = args[0];
  if (!presetName) {
    return usage("/preset", `<name> (${listPresetNames(config2).join(", ")})`);
  }
  const resolvedPreset = resolvePresetName(config2, presetName);
  if (!resolvedPreset) {
    return `[model-router] unknown preset '${presetName}'. Available: ${listPresetNames(config2).join(", ")}`;
  }
  return buildStateText(
    saveState(config2, {
      ...state2,
      activePreset: resolvedPreset
    })
  );
}
function handleMode(config2, state2, args) {
  const modeName = args[0];
  if (!modeName) {
    return usage(`/${MODE_COMMAND_NAME}`, `<name> (${listGlobalModeNames(config2).join(", ")})`);
  }
  const resolvedMode = resolveModeName(config2, modeName);
  if (!resolvedMode) {
    return `[model-router] unknown mode '${modeName}'. Available: ${listGlobalModeNames(config2).join(", ")}`;
  }
  return buildStateText(
    saveState(config2, {
      ...state2,
      activeMode: resolvedMode
    })
  );
}
function handleBypass(config2, state2, args) {
  const value = args[0];
  if (value !== "on" && value !== "off") {
    return "[model-router] usage: /bypass on|off";
  }
  return buildStateText(
    saveState(config2, {
      ...state2,
      bypass: value === "on"
    })
  );
}
function handleDelegate(config2, state2, argText) {
  const trimmed = argText.trim();
  const firstSpace = trimmed.indexOf(" ");
  const tierName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace).trim();
  const task = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();
  if (!isTierName(tierName) || !task) {
    return "[model-router] usage: /delegate <fast|medium|heavy> <task>";
  }
  const normalizedState = normalizeState(config2, state2);
  const policy = resolvePolicy(config2, normalizedState);
  if (!getActivePreset(config2, normalizedState)[tierName]) {
    return `[model-router] error: tier '${tierName}' is not available in preset '${policy.activePreset}'.`;
  }
  return buildDelegationTemplate(config2, state2, tierName, task);
}
function handleAnnotatePlan(config2, state2, argText) {
  const steps = getPlanSteps(argText).map((step) => annotateStep(config2, state2, step)).filter((value) => Boolean(value));
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
      "- keep files/helpers/tests minimal"
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
    `escalate only if: ${escalate.join("; ") || "the change cannot stay local and transient"}`
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
function runCommand(config2, state2, command, argText = "") {
  const commandName = normalizeCommandName(command);
  if (!commandName) {
    return null;
  }
  const args = argText.trim() ? argText.trim().split(/\s+/) : [];
  switch (commandName) {
    case "tiers":
      return buildTiersText(config2, state2);
    case "preset":
      return handlePreset(config2, state2, args);
    case MODE_COMMAND_NAME:
      return handleMode(config2, state2, args);
    case "bypass":
      return handleBypass(config2, state2, args);
    case "delegate":
      return handleDelegate(config2, state2, argText);
    case "annotate-plan":
      return handleAnnotatePlan(config2, state2, argText);
    case "ponytail-review":
      return handlePonytailReview(argText);
    default:
      return null;
  }
}
function handleCommand(config2, state2, prompt) {
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
  return runCommand(config2, state2, match[1], match[2] ?? "");
}
function promptSubmitMain() {
  const prompt = readPromptFromStdin();
  if (!prompt) {
    return;
  }
  const config2 = loadConfig();
  const state2 = loadState(config2);
  const commandOutput = handleCommand(config2, state2, prompt);
  if (commandOutput !== null) {
    emit(commandOutput);
    return;
  }
  if (prompt.trim().startsWith("/") || state2.bypass) {
    return;
  }
  emit(buildPromptContext(config2, state2, prompt));
}
function activateMain() {
  const config2 = loadConfig();
  const state2 = loadState(config2);
  emit(buildSessionText(config2, state2), "SessionStart");
}
function runCommandMain(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (!command) {
    process.stderr.write(`[model-router] usage: ${COMMAND_USAGE}
`);
    process.exitCode = 1;
    return;
  }
  const config2 = loadConfig();
  const state2 = loadState(config2);
  const output2 = runCommand(config2, state2, command, args.join(" "));
  if (output2 === null) {
    process.stderr.write(`[model-router] unknown command '${command}'.
`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${output2}
`);
}
var config = {
  get adapterPaths() {
    return resolveAdapterPaths();
  },
  get configPath() {
    return resolveAdapterPaths().configPath;
  },
  defaultModeForPreset,
  getMode,
  getPreset,
  getTier,
  listGlobalModeNames,
  listPresetNames,
  loadConfig
};
var state = {
  defaultState,
  loadState,
  normalizeState,
  saveState,
  get statePath() {
    return resolveAdapterPaths().statePath;
  }
};
var instructions = {
  buildSessionText,
  buildStateText,
  buildTiersText
};
var commands = {
  buildDelegationTemplate,
  buildPromptContext,
  handleCommand,
  normalizeCommandName,
  runCommand,
  scorePrompt
};
var output = {
  emit
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activateMain,
  adapterName,
  buildDelegationTemplate,
  buildPromptContext,
  buildSessionText,
  buildStateText,
  buildTiersText,
  commands,
  config,
  defaultModeForPreset,
  defaultState,
  getMode,
  getPreset,
  getTier,
  handleCommand,
  instructions,
  listGlobalModeNames,
  listPresetNames,
  loadConfig,
  loadState,
  normalizeCommandName,
  normalizeState,
  output,
  promptSubmitMain,
  resolveAdapterPaths,
  runCommand,
  runCommandMain,
  saveState,
  scorePrompt,
  state
});
