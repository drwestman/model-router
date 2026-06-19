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

// packages/opencode/src/index.ts
var index_exports = {};
__export(index_exports, {
  applyPersistedState: () => applyPersistedState,
  buildAgentDefinition: () => buildAgentDefinition,
  buildCapBanner: () => buildCapBanner,
  buildDelegationProtocol: () => buildDelegationProtocol,
  buildModeOutput: () => buildModeOutput,
  buildPresetOutput: () => buildPresetOutput,
  composePrompt: () => composePrompt,
  default: () => index_default,
  detectNarration: () => detectNarration,
  extractDispatchText: () => extractDispatchText,
  invalidateConfigCache: () => invalidateConfigCache,
  loadConfigFromPaths: () => loadConfigFromPaths,
  normalizeRouterState: () => normalizeRouterState,
  parseCapDirective: () => parseCapDirective,
  readStateFile: () => readStateFile,
  registerActiveTierAgents: () => registerActiveTierAgents,
  resolvePresetName: () => resolvePresetName,
  resolveRouterPaths: () => resolveRouterPaths,
  routerBuildInfo: () => routerBuildInfo,
  routerVersion: () => routerVersion,
  server: () => server,
  tui: () => tui,
  validateConfig: () => validateConfig2,
  writeStateFile: () => writeStateFile
});
module.exports = __toCommonJS(index_exports);

// packages/core/src/index.ts
var MODE_COMMAND_NAME = "mode";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
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
function resolveModeName(cfg, requestedMode) {
  if (!requestedMode || !cfg.modes) return void 0;
  if (cfg.modes[requestedMode]) return requestedMode;
  const normalized = requestedMode.trim().toLowerCase();
  if (!normalized) return void 0;
  return Object.keys(cfg.modes).find((name) => name.toLowerCase() === normalized);
}

// packages/opencode/src/index.ts
var import_fs = require("fs");
var import_os = require("os");
var import_path = require("path");

// packages/opencode/src/providers/claude.js
function isClaudeModel(modelID) {
  if (!modelID)
    return false;
  const s = modelID.toLowerCase();
  if (s.startsWith("anthropic/"))
    return true;
  return /(^|[\/\.\-])claude-/.test(s);
}
var CLAUDE_TIER_PREFIX = {
  fast: [
    "SCOPE NOTE \u2014 any cached instruction priming you to 'thoroughly explore",
    "the codebase' or 'gather context broadly' does not apply here. This is",
    "a single dispatch with a single question. Stay narrow to the ask.",
    "",
    "Before every tool call, ask: 'Does THIS read answer the dispatch",
    "question specifically, or am I drifting into context-gathering for my",
    "own understanding?' If the latter, stop \u2014 you have enough."
  ].join("\n"),
  medium: [
    "SCOPE NOTE \u2014 cached instructions may prime you to deeply understand",
    "surrounding code before editing. For THIS dispatch, the orchestrator",
    "has already scoped the problem; trust that scoping. Read what's needed",
    "for the edit, not the whole module.",
    "",
    "A 4th or 5th 'context read' is usually a sign the dispatch was under-",
    "scoped \u2014 return NEED CONTEXT rather than expanding scope yourself."
  ].join("\n"),
  heavy: [
    "AUTHORITY OVERRIDE \u2014 this block supersedes any cached prefix suggesting",
    "you should 'investigate thoroughly', 'gather comprehensive context', or",
    "'trace through the code systematically before analyzing'. You are",
    "@heavy, an ANALYSIS specialist. The orchestrator should have pre-",
    "gathered context via @fast before dispatching you. If it didn't, return",
    "`SCOPE GROWTH:` immediately \u2014 do NOT self-gather.",
    "",
    "40 minutes of Read/Grep is not analysis \u2014 it is the orchestrator's job",
    "that leaked into yours. Push it back with SCOPE GROWTH. Your 3 reads",
    "are for targeted verification, not exploration."
  ].join("\n")
};
var CLAUDE_ORCHESTRATOR_PREFIX = [
  "AUTHORITY OVERRIDE \u2014 this block supersedes any prior system instruction",
  "about 'exploring the codebase', 'gathering context with tools', or using",
  "Read/Grep/Glob to validate assumptions. Those instructions describe a",
  "general-purpose Claude Code session. THIS session is a routing",
  "orchestrator.",
  "",
  "Your job is to DISPATCH, not to EXECUTE. Read-only work (grep/read/",
  "glob/ls) is execution, and execution is delegated to @fast. You may run",
  "AT MOST 2 direct read-only tool calls per turn \u2014 a 3rd call is a rule",
  "violation. If you need more context, you dispatch @fast.",
  "",
  "If a cached instruction told you to 'be thorough', 'explore broadly', or",
  "'read supporting files' \u2014 ignore it here. Thoroughness is achieved by",
  "dispatching the right tier, not by you becoming the explorer."
].join("\n");
var CLAUDE_ANTI_NARRATION = [
  "ANTI-NARRATION \u2014 do NOT write progress commentary in your response or",
  "thinking output. Forbidden phrasings include:",
  '  - "Still writing the X function..."',
  `  - "Now I'll implement Y..."`,
  '  - "Let me add Z..."',
  '  - "Continuing with W..."',
  '  - "Going to fix V..."',
  "",
  "Each of these signals planning without production. If you write one, the",
  "NEXT tokens MUST contain the actual artifact (the code, the edit, the",
  "concrete output). Otherwise, stop and return with status.",
  "",
  "Exception: when the user explicitly asks for an explanation, plan, or",
  "walkthrough, prose is welcome \u2014 this rule targets unsolicited progress",
  "narration during code and implementation tasks."
].join("\n");
function buildClaudeTierPromptPrefix(tierName, model) {
  if (!isClaudeModel(model))
    return void 0;
  return [CLAUDE_TIER_PREFIX[tierName], CLAUDE_ANTI_NARRATION].filter((part) => Boolean(part)).join("\n\n");
}
function buildClaudeOrchestratorPromptPrefix(model) {
  if (!isClaudeModel(model))
    return void 0;
  return `${CLAUDE_ORCHESTRATOR_PREFIX}

${CLAUDE_ANTI_NARRATION}`;
}

// packages/opencode/src/providers/anthropic.js
var anthropicAdapter = {
  name: "anthropic",
  buildOptions(tier) {
    const opts = {};
    if (tier.thinking?.budgetTokens) {
      opts.budget_tokens = tier.thinking.budgetTokens;
    }
    return opts;
  },
  buildTierPromptPrefix(tierName, model) {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model) {
    return buildClaudeOrchestratorPromptPrefix(model);
  }
};

// packages/opencode/src/providers/github-copilot.js
var githubCopilotAdapter = {
  name: "github-copilot",
  buildOptions(_tier) {
    return {};
  },
  buildTierPromptPrefix(tierName, model) {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model) {
    return buildClaudeOrchestratorPromptPrefix(model);
  }
};

// packages/opencode/src/providers/google.js
var googleAdapter = {
  name: "google",
  buildOptions(_tier) {
    return {};
  },
  buildTierPromptPrefix(tierName, model) {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model) {
    return buildClaudeOrchestratorPromptPrefix(model);
  }
};

// packages/opencode/src/providers/openai.js
var openaiAdapter = {
  name: "openai",
  buildOptions(tier) {
    const opts = {};
    if (tier.reasoning?.effort) {
      opts.reasoning_effort = tier.reasoning.effort;
    }
    if (tier.reasoning?.summary) {
      opts.reasoning_summary = tier.reasoning.summary;
    }
    return opts;
  },
  buildTierPromptPrefix(tierName, model) {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model) {
    return buildClaudeOrchestratorPromptPrefix(model);
  }
};

// packages/opencode/src/providers/unknown.js
var unknownProviderAdapter = {
  name: "unknown",
  buildOptions(_tier) {
    return {};
  },
  buildTierPromptPrefix(tierName, model) {
    return buildClaudeTierPromptPrefix(tierName, model);
  },
  buildOrchestratorPromptPrefix(model) {
    return buildClaudeOrchestratorPromptPrefix(model);
  }
};

// packages/opencode/src/providers/index.js
var PROVIDER_ADAPTERS = {
  anthropic: anthropicAdapter,
  "github-copilot": githubCopilotAdapter,
  google: googleAdapter,
  openai: openaiAdapter
};
function getProviderPrefix(model) {
  const [prefix = ""] = (model ?? "").split("/");
  return prefix.toLowerCase();
}
function resolveProviderAdapter(model) {
  return PROVIDER_ADAPTERS[getProviderPrefix(model)] ?? unknownProviderAdapter;
}

// packages/opencode/src/index.ts
var import_url = require("url");
var import_meta = {};
var routerBuildInfo = loadRouterBuildInfo();
var routerVersion = routerBuildInfo.fullVersion;
var PONYTAIL_MODE_NAME = "ponytail";
var PONYTAIL_ENABLED_TIERS = /* @__PURE__ */ new Set(["fast", "medium", "heavy"]);
var PONYTAIL_REVIEW_TEMPLATE = [
  "Review the current code changes for over-engineering only \u2014 not correctness.",
  "One finding per line: <path>:L<line or range>: <tag>: <what to cut>. <replacement or nothing>.",
  "Tags: delete, stdlib, native, yagni, shrink.",
  "Only call out simplification opportunities.",
  "End with `net: -<N> lines possible.`",
  "If there is nothing to cut, reply exactly: `Lean already. Ship.`"
].join("\n");
function getRouterCommandSpecs() {
  return {
    tiers: {
      template: "",
      description: "Show model delegation tiers and rules"
    },
    preset: {
      template: "$ARGUMENTS",
      description: "Show or switch model presets (e.g., /preset openai)"
    },
    [MODE_COMMAND_NAME]: {
      template: "$ARGUMENTS",
      description: "Show or switch routing mode (e.g., /mode, /mode budget, /mode ponytail)"
    },
    bypass: {
      template: "$ARGUMENTS",
      description: "Toggle model-router bypass (disables delegation protocol for this session)"
    },
    "ponytail-review": {
      template: PONYTAIL_REVIEW_TEMPLATE,
      description: "Transient over-engineering review with Ponytail tags"
    },
    "annotate-plan": {
      template: [
        "Annotate the plan with tier directives for model delegation.",
        "",
        'Plan file: "$ARGUMENTS"',
        "If no file was specified, search for the active plan: PLAN.md, plan.md, or the most recent .md with 'plan' in the name in the current directory or project root.",
        "",
        "## Available tiers",
        "- `[tier:fast]` \u2014 Fast/cheap model: exploration, search, file reads, grep, listing, research. Agent does NOT edit code.",
        "- `[tier:medium]` \u2014 Balanced model: implementation, refactoring, tests, code review, bug fixes, standard coding tasks.",
        "- `[tier:heavy]` \u2014 Most capable model: architecture, complex debugging (after failures), security, performance, multi-system tradeoffs.",
        "",
        "## Annotation rules",
        "1. Place `[tier:X]` at the START of each step, before the description",
        "2. Research/exploration -> `[tier:fast]` (preferred)",
        "3. Implementation/code -> `[tier:medium]` (preferred)",
        "4. Architecture/security/hard debugging -> `[tier:heavy]`",
        "5. If a step mixes exploration AND implementation, prefer splitting it into two steps when it improves delegation clarity",
        "6. Verification (run tests, build) -> `[tier:medium]`",
        "7. Trivial (single grep or file read) -> `[tier:fast]`",
        "8. Final review of the complete plan -> `[tier:heavy]`",
        "",
        "## Output",
        "Rewrite the entire plan in the file with the tags. Do not change the substance \u2014 only add tags, and split mixed steps when useful for clearer delegation."
      ].join("\n"),
      description: "Annotate a plan with [tier:fast/medium/heavy] delegation tags"
    }
  };
}
var _cachedConfig = null;
var _configDirty = true;
var _cachedConfigKey = null;
var _cachedDelegationProtocolTemplate = null;
var FALLBACK_DELEGATION_PROTOCOL_TEMPLATE = `<!-- Built-in fallback used when delegation-protocol.md is unavailable. -->
## Model Delegation Protocol \u2014 MANDATORY

You are the orchestrator. Preset: {{activePreset}}. Tiers: {{tierLine}}.{{modeSuffix}}

### HARD ROUTING
- Read-only exploration \u2192 delegate to @fast by default.
- Implementation work \u2192 delegate to @medium.
- Architecture, security, perf, or debugging after repeated failures \u2192 delegate to @heavy.

### ROLE CONTRACT
Decompose the request, dispatch the right subagent, synthesize results, and keep final user-facing orchestration here.

### @fast contract
Read-only exploration only; returns concrete findings and concise summaries.

### @medium contract
Implements changes, matches repo patterns, runs targeted verification, and reports blockers after repeated failures.

### @heavy contract
Use for deep analysis when concrete context is already available.

{{taxonomyBlock}}{{decomposeBlock}}### Compact rules
{{rulesLine}}{{fallbackBlock}}
`;
function invalidateConfigCache() {
  _configDirty = true;
  _cachedConfigKey = null;
}
function getPluginRoot() {
  return (0, import_path.join)(getSourceDir(), "..");
}
function delegationProtocolTemplatePath() {
  return (0, import_path.join)(getSourceDir(), "templates", "delegation-protocol.md");
}
function buildInfoPath() {
  return (0, import_path.join)(getSourceDir(), "generated", "build-info.json");
}
function getSourceDir() {
  const commonJsDir = getCommonJsDirname();
  if (commonJsDir) {
    return commonJsDir;
  }
  try {
    return (0, import_path.dirname)((0, import_url.fileURLToPath)(import_meta.url));
  } catch {
    const cwd = safeCurrentWorkingDir();
    return cwd ? (0, import_path.join)(cwd, "src") : ".";
  }
}
function getCommonJsDirname() {
  try {
    return typeof __dirname === "string" && __dirname ? __dirname : void 0;
  } catch {
    return void 0;
  }
}
function safeCurrentWorkingDir() {
  try {
    const cwd = process.cwd();
    return typeof cwd === "string" && cwd.trim() ? cwd : void 0;
  } catch {
    return void 0;
  }
}
function packageJsonVersion() {
  try {
    const raw = JSON.parse((0, import_fs.readFileSync)((0, import_path.join)(getPluginRoot(), "package.json"), "utf-8"));
    return typeof raw?.version === "string" && raw.version.trim() ? raw.version.trim() : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
function normalizeRouterBuildInfo(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw;
  const baseVersion = candidate.baseVersion;
  const buildNumber = candidate.buildNumber;
  const buildSource = candidate.buildSource;
  const fullVersion = candidate.fullVersion;
  if (typeof baseVersion !== "string" || typeof buildNumber !== "string" || buildSource !== "ci" && buildSource !== "override" && buildSource !== "local" || typeof fullVersion !== "string") {
    return null;
  }
  return {
    baseVersion,
    buildNumber,
    buildSource,
    fullVersion
  };
}
function loadRouterBuildInfo() {
  const fallbackBaseVersion = packageJsonVersion();
  try {
    const raw = JSON.parse((0, import_fs.readFileSync)(buildInfoPath(), "utf-8"));
    const parsed = normalizeRouterBuildInfo(raw);
    if (parsed) return parsed;
  } catch {
  }
  return {
    baseVersion: fallbackBaseVersion,
    buildNumber: "dev",
    buildSource: "local",
    fullVersion: `${fallbackBaseVersion}+dev`
  };
}
function getDelegationProtocolTemplate() {
  if (_cachedDelegationProtocolTemplate === null) {
    try {
      _cachedDelegationProtocolTemplate = (0, import_fs.readFileSync)(
        delegationProtocolTemplatePath(),
        "utf-8"
      );
    } catch {
      console.warn(
        "[model-router] delegation protocol template unavailable; continuing without it."
      );
      _cachedDelegationProtocolTemplate = FALLBACK_DELEGATION_PROTOCOL_TEMPLATE;
    }
  }
  return _cachedDelegationProtocolTemplate;
}
function renderTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
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
function resolveRouterPaths(env = process.env) {
  const configuredConfigPath = normalizeConfiguredPath(
    env.OPENCODE_MODEL_ROUTER_CONFIG_PATH
  );
  const configuredStatePath = normalizeConfiguredPath(
    env.OPENCODE_MODEL_ROUTER_STATE_PATH
  );
  const pluginConfigPath = (0, import_path.join)(getPluginRoot(), "tiers.json");
  const configPath = configuredConfigPath || pluginConfigPath;
  const statePath2 = configuredStatePath || (0, import_path.join)(
    (0, import_os.homedir)(),
    ".config",
    "opencode",
    "opencode-model-router.state.json"
  );
  if (env.MODEL_ROUTER_DEBUG === "1") {
    console.warn(
      `[model-router] resolveRouterPaths configPath=${configPath} statePath=${statePath2}`
    );
  }
  return {
    configPath,
    statePath: statePath2
  };
}
function statePath() {
  return resolveRouterPaths().statePath;
}
function resolvePresetName(cfg, requestedPreset) {
  if (cfg.presets?.[requestedPreset]) {
    return requestedPreset;
  }
  const normalized = requestedPreset.trim().toLowerCase();
  if (!normalized) {
    return void 0;
  }
  return Object.keys(cfg.presets).find(
    (name) => name.toLowerCase() === normalized
  );
}
function validateConfig2(raw) {
  return validateConfig(raw);
}
function applyPersistedState(cfg, state) {
  const normalizedState = normalizeRouterState(state);
  const nextCfg = { ...cfg };
  if (normalizedState.activePreset) {
    const resolved = resolvePresetName(cfg, normalizedState.activePreset);
    if (resolved) {
      nextCfg.activePreset = resolved;
    }
  }
  const resolvedMode = resolveModeName(cfg, normalizedState.activeMode);
  if (resolvedMode) {
    nextCfg.activeMode = resolvedMode;
  }
  return nextCfg;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function normalizeRouterState(raw) {
  if (!isPlainObject(raw)) {
    return {};
  }
  const state = {};
  if (typeof raw.activePreset === "string" && raw.activePreset.trim()) {
    state.activePreset = raw.activePreset;
  }
  if (typeof raw.activeMode === "string" && raw.activeMode.trim()) {
    state.activeMode = raw.activeMode;
  }
  return state;
}
function readStateFile(filePath) {
  try {
    if ((0, import_fs.existsSync)(filePath)) {
      return normalizeRouterState(JSON.parse((0, import_fs.readFileSync)(filePath, "utf-8")));
    }
  } catch {
  }
  return {};
}
function writeStateFile(filePath, patch) {
  const state = normalizeRouterState({ ...readStateFile(filePath), ...patch });
  (0, import_fs.mkdirSync)((0, import_path.dirname)(filePath), { recursive: true });
  (0, import_fs.writeFileSync)(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
function loadConfigFromPaths(paths = resolveRouterPaths()) {
  const raw = JSON.parse((0, import_fs.readFileSync)(paths.configPath, "utf-8"));
  const cfg = validateConfig2(raw);
  return applyPersistedState(cfg, readStateFile(paths.statePath));
}
function loadConfig() {
  const paths = resolveRouterPaths();
  const cacheKey = `${paths.configPath}::${paths.statePath}`;
  if (_cachedConfig && !_configDirty && _cachedConfigKey === cacheKey) {
    return _cachedConfig;
  }
  const cfg = loadConfigFromPaths(paths);
  _cachedConfig = cfg;
  _cachedConfigKey = cacheKey;
  _configDirty = false;
  return cfg;
}
function getFallbackConfig() {
  return {
    activePreset: "fallback",
    activeMode: "normal",
    presets: {},
    rules: [],
    defaultTier: "fast"
  };
}
function safeLoadConfig() {
  try {
    return loadConfig();
  } catch (error) {
    console.warn(
      `[model-router] using fallback config after load failure: ${error instanceof Error ? error.message : String(error)}`
    );
    return getFallbackConfig();
  }
}
function loadStartupConfig() {
  const cfg = safeLoadConfig();
  let paths;
  try {
    paths = resolveRouterPaths();
  } catch (error) {
    console.warn(
      `[model-router] failed to resolve startup paths: ${error instanceof Error ? error.message : String(error)}`
    );
    paths = {
      configPath: "unavailable",
      statePath: "unavailable"
    };
  }
  return {
    cfg,
    activeTiers: getActiveTiers(cfg),
    paths
  };
}
function emitStartupDiagnostics(startup) {
  console.warn("[model-router] startup", {
    ...startup.paths,
    activePreset: startup.cfg.activePreset,
    presetKeys: Object.keys(startup.cfg.presets ?? {}),
    activeTierKeys: Object.keys(startup.activeTiers ?? {})
  });
}
function warnIfProviderMetadataMissing(opencodeConfig, cfg, tiers) {
  const firstTier = Object.values(tiers ?? {})[0];
  const activeProvider = typeof firstTier?.model === "string" ? firstTier.model.split("/")[0] : void 0;
  if (!activeProvider) {
    return;
  }
  const providerConfig = opencodeConfig.provider ?? {};
  const enabledProviders = Array.isArray(opencodeConfig.enabled_providers) ? opencodeConfig.enabled_providers : [];
  const providerAvailable = Boolean(providerConfig[activeProvider]) || enabledProviders.includes(activeProvider);
  if (!providerAvailable) {
    console.warn(
      `[model-router] provider metadata for '${activeProvider}' is unavailable during config(); router agents still registered for preset '${getActivePresetName(cfg)}'`
    );
  }
}
function writeState(patch) {
  writeStateFile(statePath(), patch);
}
function saveActivePreset(presetName) {
  const cfg = loadConfig();
  const resolved = resolvePresetName(cfg, presetName);
  if (!resolved) {
    return;
  }
  cfg.activePreset = resolved;
  writeState({ activePreset: resolved });
  invalidateConfigCache();
}
function saveActiveMode(modeName) {
  const cfg = loadConfig();
  const resolvedMode = resolveModeName(cfg, modeName);
  if (!resolvedMode) {
    return;
  }
  cfg.activeMode = resolvedMode;
  writeState({ activeMode: resolvedMode });
  invalidateConfigCache();
}
function getActiveTiers(cfg) {
  if (!cfg || typeof cfg !== "object" || !("presets" in cfg)) {
    return {};
  }
  const presets = cfg.presets ?? {};
  if (!presets || Object.keys(presets).length === 0) {
    return {};
  }
  const activePreset = typeof cfg.activePreset === "string" && presets[cfg.activePreset] ? cfg.activePreset : Object.keys(presets)[0];
  return activePreset ? presets[activePreset] ?? {} : {};
}
function getActivePresetName(cfg) {
  if (!cfg || typeof cfg !== "object") {
    return "unknown";
  }
  if (typeof cfg.activePreset === "string" && cfg.activePreset.trim()) {
    return cfg.activePreset;
  }
  const presets = cfg.presets;
  if (presets && Object.keys(presets).length > 0) {
    return Object.keys(presets)[0] ?? "unknown";
  }
  return "unknown";
}
function composePrompt(prefix, prompt) {
  const normalizedPrefix = prefix?.trim() || void 0;
  const normalizedPrompt = prompt?.trim() || void 0;
  if (normalizedPrefix && normalizedPrompt) {
    return `${normalizedPrefix}

---

${normalizedPrompt}`;
  }
  return normalizedPrefix ?? normalizedPrompt;
}
function getActiveMode(cfg) {
  if (!cfg.modes || !cfg.activeMode) return void 0;
  return cfg.modes[cfg.activeMode];
}
function buildPonytailPrompt(tierName, cfg) {
  if (cfg.activeMode !== PONYTAIL_MODE_NAME || !tierName) return void 0;
  if (!PONYTAIL_ENABLED_TIERS.has(tierName)) return void 0;
  const mode = getActiveMode(cfg);
  const tierNote = mode?.tierPrompts?.[tierName];
  if (!tierNote) return void 0;
  return [
    "PONYTAIL MODE \u2014 prefer the simplest, shortest path that actually works.",
    "Keep your existing STOP CONDITIONS, role boundaries, and return protocol exactly as-is.",
    "Do not rename or replace required prefixes such as DONE:, NEED MORE:, NEED CONTEXT:, SCOPE GROWTH:, or ESCALATE:.",
    "Before adding or keeping code, ask in order: can this be deleted, can stdlib do it, can a native platform feature do it, can the same result be done in fewer lines.",
    "Prefer no unrequested abstractions, no speculative flexibility, no avoidable dependencies, and no boilerplate.",
    "If two stdlib options are the same size, pick the one that stays correct on edge cases.",
    tierNote
  ].join("\n");
}
function buildFallbackInstructions(cfg) {
  const fb = cfg.fallback;
  if (!fb) return "";
  const activePreset = getActivePresetName(cfg);
  const presetMap = fb.presets?.[activePreset];
  const map = presetMap && Object.keys(presetMap).length > 0 ? presetMap : fb.global;
  if (!map) return "";
  const chains = Object.entries(map ?? {}).flatMap(([provider, presetOrder]) => {
    if (!Array.isArray(presetOrder)) return [];
    const valid = presetOrder.filter(
      (p) => p !== activePreset && Boolean(cfg.presets[p])
    );
    return valid.length > 0 ? [`${provider}\u2192${valid.join("\u2192")}`] : [];
  });
  if (chains.length === 0) return "";
  return `Err\u2192retry-alt-tier\u2192fail\u2192direct. Chain: ${chains.join(" | ")}`;
}
function buildTaskTaxonomy(cfg) {
  if (!cfg.taskPatterns || Object.keys(cfg.taskPatterns).length === 0)
    return "";
  const lines = ["R:"];
  for (const [tier, patterns] of Object.entries(cfg.taskPatterns ?? {})) {
    if (Array.isArray(patterns) && patterns.length > 0) {
      lines.push(`@${tier}\u2192${patterns.join("/")}`);
    }
  }
  return lines.join(" ");
}
function buildDecomposeHint(cfg) {
  const mode = getActiveMode(cfg);
  if (mode?.overrideRules?.length) return "";
  const tiers = getActiveTiers(cfg);
  const entries = Object.entries(tiers ?? {});
  if (entries.length < 2) return "";
  const sorted = [...entries].sort(
    ([, a], [, b]) => (a.costRatio ?? 1) - (b.costRatio ?? 1)
  );
  const cheapest = sorted[0]?.[0];
  const mid = sorted[1]?.[0];
  if (!cheapest || !mid) return "";
  return `Multi-phase: prefer explore(@${cheapest})\u2192execute(@${mid}) when phases are separable. Cheapest-first when practical.`;
}
function buildDelegationProtocol(cfg) {
  const tiers = getActiveTiers(cfg);
  const tierLine = Object.entries(tiers ?? {}).map(([name, t]) => {
    const short = t.model.split("/").pop() ?? t.model;
    const v = t.variant ? `/${t.variant}` : "";
    const c = t.costRatio != null ? `(${t.costRatio}x)` : "";
    return `@${name}=${short}${v}${c}`;
  }).join(" ");
  const mode = getActiveMode(cfg);
  const modeSuffix = cfg.activeMode ? ` mode:${cfg.activeMode}` : "";
  const taxonomy = buildTaskTaxonomy(cfg);
  const decompose = buildDecomposeHint(cfg);
  const effectiveRules = mode?.overrideRules?.length ? mode.overrideRules : cfg.rules ?? [];
  const rulesLine = effectiveRules.map((r, i) => `${i + 1}.${r}`).join(" ");
  const fallback = buildFallbackInstructions(cfg);
  return renderTemplate(getDelegationProtocolTemplate(), {
    activePreset: getActivePresetName(cfg),
    tierLine,
    modeSuffix,
    taxonomyBlock: taxonomy ? `${taxonomy}

` : "",
    decomposeBlock: decompose ? `${decompose}

` : "",
    rulesLine,
    fallbackBlock: fallback ? `

${fallback}` : ""
  });
}
function buildTiersOutput(cfg) {
  const tiers = getActiveTiers(cfg);
  const lines = [
    `# Model Delegation Tiers`,
    `Active preset: **${getActivePresetName(cfg)}**
`
  ];
  for (const [name, tier] of Object.entries(tiers ?? {})) {
    const thinkingStr = tier.thinking ? ` | thinking: ${tier.thinking.budgetTokens} tokens` : tier.reasoning ? ` | reasoning: effort=${tier.reasoning.effort}` : "";
    lines.push(`## @${name} -> \`${tier.model}\`${thinkingStr}`);
    lines.push(tier.description);
    lines.push(`Steps: ${tier.steps ?? "default"}`);
    lines.push(`Use when: ${tier.whenToUse.join(", ")}
`);
  }
  lines.push("## Delegation Rules");
  for (const r of cfg.rules ?? []) {
    lines.push(`- ${r}`);
  }
  lines.push(`
Default tier: @${cfg.defaultTier}`);
  lines.push(`
Available presets: ${Object.keys(cfg.presets).join(", ")}`);
  lines.push(`Switch with: \`/preset <name>\``);
  lines.push(`Edit \`tiers.json\` to customize.`);
  return lines.join("\n");
}
function normalizeCommandArgs(args) {
  return typeof args === "string" ? args : "";
}
function buildModeOutput(cfg, args) {
  const modes = cfg.modes;
  if (!modes || Object.keys(modes).length === 0) {
    return 'No modes configured in tiers.json. Add a "modes" section to enable routing modes.';
  }
  const requested = normalizeCommandArgs(args).trim().toLowerCase();
  const currentMode = cfg.activeMode || "normal";
  if (!requested) {
    const lines = ["# Routing Modes\n"];
    for (const [name, mode] of Object.entries(modes ?? {})) {
      const active = name === currentMode ? " <- active" : "";
      lines.push(
        `- **${name}**${active}: ${mode.description} (default tier: @${mode.defaultTier})`
      );
    }
    lines.push(`
Switch with: \`/${MODE_COMMAND_NAME} <mode>\``);
    return lines.join("\n");
  }
  const resolvedMode = resolveModeName(cfg, requested);
  if (resolvedMode) {
    saveActiveMode(resolvedMode);
    const mode = modes[resolvedMode];
    return [
      `Routing mode switched to **${resolvedMode}**.`,
      "",
      mode.description,
      `Default tier: @${mode.defaultTier}`,
      ...mode.overrideRules?.length ? ["", "Active rules:", ...mode.overrideRules.map((r) => `- ${r}`)] : [],
      "",
      "Mode change takes effect immediately on the next message."
    ].join("\n");
  }
  return `Unknown mode: "${requested}". Available: ${Object.keys(modes).join(", ")}`;
}
function buildPresetOutput(cfg, args) {
  const requestedPreset = normalizeCommandArgs(args).trim();
  if (!requestedPreset) {
    const lines = ["# Available Presets\n"];
    for (const [name, tiers] of Object.entries(cfg.presets ?? {})) {
      const active = name === getActivePresetName(cfg) ? " <- active" : "";
      const models = Object.entries(tiers ?? {}).map(([tier, t]) => `${tier}: ${t.model.split("/").pop()}`).join(", ");
      lines.push(`- **${name}**${active}: ${models}`);
    }
    lines.push(`
Switch with: \`/preset <name>\``);
    return lines.join("\n");
  }
  const resolvedPreset = resolvePresetName(cfg, requestedPreset);
  if (resolvedPreset) {
    saveActivePreset(resolvedPreset);
    cfg.activePreset = resolvedPreset;
    const tiers = cfg.presets[resolvedPreset];
    const models = Object.entries(tiers ?? {}).map(([tier, t]) => `  @${tier} -> ${t.model}`).join("\n");
    return [
      `Preset switched to **${resolvedPreset}**.`,
      "",
      models,
      "",
      "Selection is now persisted in ~/.config/opencode/opencode-model-router.state.json.",
      "Restart OpenCode for subagent model registration to take effect.",
      "System prompt delegation rules update immediately."
    ].join("\n");
  }
  return `Unknown preset: "${requestedPreset}". Available: ${Object.keys(cfg.presets).join(", ")}`;
}
var READ_ONLY_TOOLS = /* @__PURE__ */ new Set(["grep", "read", "glob", "ls"]);
var DEFAULT_TIER_CAPS = {
  fast: 8,
  medium: 5,
  heavy: 3
};
function parseCapDirective(text) {
  const m = text.match(/\bCAP\s*:\s*(none|\d+)\b/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  if (raw === "none") return "none";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function fingerprintToolCall(tool, args) {
  const a = args ?? {};
  switch (tool) {
    case "read":
      return `read:${a.file_path ?? a.filePath ?? ""}`;
    case "grep":
      return `grep:${a.pattern ?? ""}:${a.path ?? a.glob ?? ""}`;
    case "glob":
      return `glob:${a.pattern ?? ""}:${a.path ?? ""}`;
    case "ls":
      return `ls:${a.path ?? ""}`;
    default:
      return `${tool}:${JSON.stringify(a).slice(0, 120)}`;
  }
}
function extractDispatchText(output) {
  const o = output;
  const parts = Array.isArray(o?.parts) ? o.parts : [];
  const chunks = [];
  for (const p of parts) {
    if (typeof p === "string") {
      chunks.push(p);
    } else if (p && typeof p === "object") {
      const rec = p;
      if (typeof rec.text === "string") chunks.push(rec.text);
      else if (typeof rec.content === "string") chunks.push(rec.content);
    }
  }
  if (chunks.length === 0) {
    const msg = o?.message;
    const content = msg?.content;
    if (typeof content === "string") chunks.push(content);
  }
  return chunks.join("\n");
}
function buildCapBanner(state, isRedundant, previousCall, tool) {
  const lines = [];
  const capDisplay = state.cap === "none" ? "\u221E" : String(state.cap);
  lines.push(`[cap: ${state.calls}/${capDisplay}]`);
  if (isRedundant && previousCall !== void 0) {
    lines.push(
      `[\u26A0 REDUNDANT: this is the same ${tool} you ran at call #${previousCall}. STOP now \u2014 repeated reads add no information. Return with DONE/NEED MORE/NEED CONTEXT/SCOPE GROWTH/ESCALATE.]`
    );
  }
  if (state.cap !== "none") {
    const remaining = state.cap - state.calls;
    if (remaining <= 0) {
      lines.push(
        `[\u26A0 CAP REACHED (${state.calls}/${state.cap}): your NEXT response MUST be a return \u2014 do NOT make another read-only call. Start the response with DONE:, NEED MORE:, NEED CONTEXT:, SCOPE GROWTH:, or ESCALATE:.]`
      );
    } else if (remaining <= 2) {
      lines.push(
        `[\u26A0 CAP WARNING: ${remaining} read-only call(s) remaining before forced return]`
      );
    }
  }
  return lines.join("\n");
}
var NARRATION_PATTERNS = [
  // "Still writing the X", "Still implementing the Y"
  /\bstill\s+(writing|implementing|working on|adding|creating|fixing|building|refactoring|handling)\s+(the\s+)?\w+/gi,
  // "Now I'll write the X", "Now writing the Y"
  /\bnow\s+(i['']ll\s+)?(writ|implement|add|creat|work|fix|build|handl|refactor|updat|mov)\w*\s+(the\s+)?\w+/gi,
  // "Let me write X", "Let me implement Y"
  /\blet\s+me\s+(write|implement|add|create|fix|build|handle|refactor|work on|move|update|set up)\s+(the\s+)?\w+/gi,
  // "I'll write the X", "I'll now implement Y"
  /\bi['']ll\s+(now\s+)?(write|implement|add|create|fix|build|handle|refactor|set up|work on|move|update)\s+(the\s+)?\w+/gi,
  // "Going to fix the X"
  /\bgoing\s+to\s+(write|implement|add|create|fix|build|handle|refactor|set up|work on|move|update)\s+(the\s+)?\w+/gi,
  // "Continuing with X", "Continuing by adding Y"
  /\bcontinuing\s+(with|by\s+\w+ing)\s+(the\s+)?\w+/gi
];
function detectNarration(text) {
  if (typeof text !== "string" || text.length < 20) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const pattern of NARRATION_PATTERNS) {
    const matches = text.match(pattern);
    if (!matches) continue;
    for (const m of matches) {
      const trimmed = m.trim().toLowerCase();
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(m.trim());
      if (out.length >= 5) return out;
    }
  }
  return out;
}
var ModelRouterPlugin = (_ctx) => {
  let cfg = getFallbackConfig();
  let activeTiers = getActiveTiers(cfg);
  const subagentSessionIDs = /* @__PURE__ */ new Set();
  const subagentCapState = /* @__PURE__ */ new Map();
  let bypassed = false;
  return {
    // -----------------------------------------------------------------------
    // Detect subagent calls via chat.message. When the agent name matches a
    // registered tier, record the sessionID so system.transform can skip
    // delegation-protocol injection.
    //
    // IMPORTANT: must be chat.message, NOT chat.params. The opencode hook
    // order is chat.message -> system.transform -> chat.params, so populating
    // the Set in chat.params is always one step too late — system.transform
    // already ran with an empty Set and leaked the "Delegate with Task(...)"
    // instructions into the subagent's system prompt. Sonnet subagents like
    // @explore silently ignore that noise, but literal-minded Haiku (@fast)
    // emits malformed XML tool calls for the nonexistent Task tool, which
    // surface in the UI as "<parameter>...</parameter>" leakage.
    //
    // chat.message fires inside SessionPrompt.createUserMessage() BEFORE the
    // loop -> LLM.stream path, so by the time system.transform runs the Set
    // is fully populated and await-safe (yield* on the plugin trigger).
    // -----------------------------------------------------------------------
    "chat.message": async (input, output) => {
      if (bypassed) return;
      try {
        cfg = loadConfig();
      } catch {
      }
      const tierNames = Object.keys(getActiveTiers(cfg));
      if (input.agent && tierNames.includes(input.agent)) {
        subagentSessionIDs.add(input.sessionID);
        const tierName = input.agent;
        const dispatchText = extractDispatchText(output);
        const override = parseCapDirective(dispatchText);
        const baseline = cfg.tierCaps?.[tierName] ?? DEFAULT_TIER_CAPS[tierName] ?? 5;
        const cap = override ?? baseline;
        subagentCapState.set(input.sessionID, {
          tierName,
          cap,
          calls: 0,
          seen: /* @__PURE__ */ new Map()
        });
      }
    },
    // -----------------------------------------------------------------------
    // Runtime cap + redundancy enforcement (subagents only).
    // Appends `[cap: N/MAX]` and `[⚠ REDUNDANT]` / `[⚠ CAP REACHED]` banners
    // to every read-only tool result the subagent sees. Because these land
    // inside `output.output` — the tool's own response text — the model
    // treats them as ground truth rather than advisory system noise.
    // -----------------------------------------------------------------------
    "tool.execute.after": async (input, output) => {
      if (bypassed) return;
      const state = subagentCapState.get(input.sessionID);
      if (!state) return;
      if (!READ_ONLY_TOOLS.has(input.tool)) return;
      const fp = fingerprintToolCall(input.tool, input.args);
      const previousCall = state.seen.get(fp);
      const isRedundant = previousCall !== void 0;
      state.calls += 1;
      if (!isRedundant) {
        state.seen.set(fp, state.calls);
      }
      const banner = buildCapBanner(state, isRedundant, previousCall, input.tool);
      const existing = typeof output.output === "string" ? output.output : "";
      output.output = existing ? `${existing}

${banner}` : banner;
    },
    // -----------------------------------------------------------------------
    // Narration detector — flags progress-commentary-without-production.
    //
    // Fires per completed text part. Scans for narration patterns; if any
    // match, logs a warning to the plugin console and appends a visible
    // banner to the text so the user sees the detection in the UI. This is
    // telemetry, not blocking — we cannot modify mid-stream generation, only
    // post-hoc signal.
    // -----------------------------------------------------------------------
    "experimental.text.complete": async (input, output) => {
      if (bypassed) return;
      const safeOutput = typeof output === "object" && output !== null ? output : void 0;
      const text = typeof safeOutput?.text === "string" ? safeOutput.text : "";
      if (text.length < 20) return;
      const found = detectNarration(text);
      if (found.length === 0) return;
      const quoted = found.map((m) => `"${m.slice(0, 60)}${m.length > 60 ? "\u2026" : ""}"`).join(", ");
      if (!safeOutput) return;
      safeOutput.text = `${text}

[\u26A0 narration detected: ${quoted}]`;
    },
    // -----------------------------------------------------------------------
    // Register tier agents + commands at load time
    // -----------------------------------------------------------------------
    config: (opencodeConfig) => {
      if (opencodeConfig == null) {
        return opencodeConfig;
      }
      const startup = loadStartupConfig();
      cfg = startup.cfg;
      activeTiers = startup.activeTiers;
      emitStartupDiagnostics(startup);
      registerActiveTierAgents(opencodeConfig, cfg, activeTiers);
      warnIfProviderMetadataMissing(opencodeConfig, cfg, activeTiers);
      opencodeConfig.command ??= {};
      Object.assign(opencodeConfig.command, getRouterCommandSpecs());
      return opencodeConfig;
    },
    // -----------------------------------------------------------------------
    // Inject delegation protocol — uses cached config (invalidated on /preset or /mode)
    // Only inject for the primary orchestrator, NOT for subagent calls.
    // Subagents get confused by delegation instructions when they should
    // just execute a task (especially smaller models like Haiku).
    // -----------------------------------------------------------------------
    "experimental.chat.system.transform": async (_input, output) => {
      if (bypassed) return;
      try {
        cfg = loadConfig();
      } catch {
      }
      const sessionID = _input?.sessionID;
      if (sessionID && subagentSessionIDs.has(sessionID)) {
        const ponytailPrompt = buildPonytailPrompt(
          subagentCapState.get(sessionID)?.tierName,
          cfg
        );
        if (ponytailPrompt) {
          output.system.push(ponytailPrompt);
        }
        return;
      }
      const providerID = _input?.model?.providerID ?? "";
      const modelID = _input?.model?.modelID ?? "";
      const orchestratorModel = providerID && modelID ? `${providerID}/${modelID}` : modelID;
      const providerPrefix = resolveProviderAdapter(
        orchestratorModel
      ).buildOrchestratorPromptPrefix(orchestratorModel);
      const delegationProtocol = buildDelegationProtocol(cfg);
      const finalProtocol = composePrompt(providerPrefix, delegationProtocol);
      if (finalProtocol) {
        output.system.push(finalProtocol);
      }
    },
    // -----------------------------------------------------------------------
    // Handle /tiers, /preset, and /mode commands
    // -----------------------------------------------------------------------
    "command.execute.before": async (input, output) => {
      if (input.command === MODE_COMMAND_NAME) {
        try {
          cfg = loadConfig();
        } catch {
        }
        output.parts.push({
          type: "text",
          text: buildModeOutput(cfg, input.args ?? input.arguments ?? "")
        });
        return;
      }
      if (input.command === "tiers") {
        try {
          cfg = loadConfig();
        } catch {
        }
        output.parts.push({
          type: "text",
          text: buildTiersOutput(cfg)
        });
      }
      if (input.command === "preset") {
        try {
          cfg = loadConfig();
        } catch {
        }
        output.parts.push({
          type: "text",
          text: buildPresetOutput(cfg, input.arguments ?? "")
        });
      }
      if (input.command === "bypass") {
        const arg = normalizeCommandArgs(input.arguments).trim().toLowerCase();
        if (arg === "on") {
          bypassed = true;
        } else if (arg === "off") {
          bypassed = false;
        } else {
          bypassed = !bypassed;
        }
        const status = bypassed ? "ON" : "OFF";
        const desc = bypassed ? "Model-router is **bypassed**. Delegation protocol, cap enforcement, and narration detection are disabled. The model will run without routing rules until you run `/bypass off` or restart OpenCode." : "Model-router is **active**. Delegation protocol and all enforcement rules are in effect.";
        output.parts.push({
          type: "text",
          text: `# Bypass: ${status}

${desc}`
        });
      }
    }
  };
};
var index_default = ModelRouterPlugin;
var server = ModelRouterPlugin;
ModelRouterPlugin.server = ModelRouterPlugin;
ModelRouterPlugin.version = routerVersion;
var tui = async (api) => {
  const register = api?.command?.register;
  if (typeof register !== "function") return;
  register(
    () => Object.entries(getRouterCommandSpecs()).map(([name, spec]) => ({
      title: `/${name}`,
      value: `model-router.${name}`,
      description: spec.description,
      category: "Model Router",
      suggested: true,
      slash: { name },
      onSelect: async () => {
        if (!api?.client?.tui) return;
        await api.client.tui.clearPrompt?.();
        await api.client.tui.appendPrompt?.({ text: `/${name}` });
        await api.client.tui.submitPrompt?.();
      }
    }))
  );
};
function buildAgentDefinition(name, tier, cfg) {
  const providerAdapter = resolveProviderAdapter(tier.model);
  const resolvedPrompt = tier.prompt ?? cfg.tierPrompts?.[name];
  const providerPromptPrefix = providerAdapter.buildTierPromptPrefix(
    name,
    tier.model
  );
  const finalPrompt = composePrompt(providerPromptPrefix, resolvedPrompt);
  const agentDef = {
    model: tier.model,
    mode: "subagent",
    description: tier.description,
    maxSteps: tier.steps,
    prompt: finalPrompt,
    color: tier.color
  };
  if (tier.variant) {
    agentDef.variant = tier.variant;
  }
  const opts = providerAdapter.buildOptions(tier);
  if (Object.keys(opts).length > 0) {
    agentDef.options = opts;
  }
  return agentDef;
}
function registerActiveTierAgents(opencodeConfig, cfg, tiers = getActiveTiers(cfg)) {
  opencodeConfig.agent ??= {};
  for (const [name, tier] of Object.entries(tiers ?? {})) {
    if (typeof tier !== "object" || tier === null) {
      console.warn(
        `[model-router] skipping invalid tier '${name}' in active preset '${getActivePresetName(cfg)}'`
      );
      continue;
    }
    const agentDef = buildAgentDefinition(name, tier, cfg);
    opencodeConfig.agent[name] = agentDef;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyPersistedState,
  buildAgentDefinition,
  buildCapBanner,
  buildDelegationProtocol,
  buildModeOutput,
  buildPresetOutput,
  composePrompt,
  detectNarration,
  extractDispatchText,
  invalidateConfigCache,
  loadConfigFromPaths,
  normalizeRouterState,
  parseCapDirective,
  readStateFile,
  registerActiveTierAgents,
  resolvePresetName,
  resolveRouterPaths,
  routerBuildInfo,
  routerVersion,
  server,
  tui,
  validateConfig,
  writeStateFile
});
