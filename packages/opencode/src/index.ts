/// <reference path="./opencode-ai-plugin.d.ts" />

import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import {
  MODE_COMMAND_NAME,
  resolveModeName,
  validateConfig as validateCanonicalConfig,
} from "@drwestman/model-router-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { resolveProviderAdapter } from "./providers/index.js";
import type {
  ModeConfig,
  Preset,
  RouterConfig,
  RouterPaths,
  RouterState,
  TierConfig,
} from "./types.js";
export type {
  ModeConfig,
  Preset,
  RouterConfig,
  RouterPaths,
  RouterState,
  TierConfig,
} from "./types.js";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
export interface RouterBuildInfo {
  baseVersion: string;
  buildNumber: string;
  buildSource: "ci" | "override" | "local";
  fullVersion: string;
}

export const routerBuildInfo = loadRouterBuildInfo();
export const routerVersion = routerBuildInfo.fullVersion;

type RouterCommandSpec = {
  template: string;
  description: string;
};

const PONYTAIL_MODE_NAME = "ponytail";
const PONYTAIL_ENABLED_TIERS = new Set(["fast", "medium", "heavy"]);
const PONYTAIL_REVIEW_TEMPLATE = [
  "Review the current code changes for over-engineering only — not correctness.",
  "One finding per line: <path>:L<line or range>: <tag>: <what to cut>. <replacement or nothing>.",
  "Tags: delete, stdlib, native, yagni, shrink.",
  "Only call out simplification opportunities.",
  "End with `net: -<N> lines possible.`",
  "If there is nothing to cut, reply exactly: `Lean already. Ship.`",
].join("\n");

function getRouterCommandSpecs(): Record<string, RouterCommandSpec> {
  return {
    tiers: {
      template: "",
      description: "Show model delegation tiers and rules",
    },
    preset: {
      template: "$ARGUMENTS",
      description: "Show or switch model presets (e.g., /preset openai)",
    },
    [MODE_COMMAND_NAME]: {
      template: "$ARGUMENTS",
      description:
        "Show or switch routing mode (e.g., /mode, /mode budget, /mode ponytail)",
    },
    bypass: {
      template: "$ARGUMENTS",
      description:
        "Toggle model-router bypass (disables delegation protocol for this session)",
    },
    "ponytail-review": {
      template: PONYTAIL_REVIEW_TEMPLATE,
      description: "Transient over-engineering review with Ponytail tags",
    },
    "annotate-plan": {
      template: [
        "Annotate the plan with tier directives for model delegation.",
        "",
        'Plan file: "$ARGUMENTS"',
        "If no file was specified, search for the active plan: PLAN.md, plan.md, or the most recent .md with 'plan' in the name in the current directory or project root.",
        "",
        "## Available tiers",
        "- `[tier:fast]` — Fast/cheap model: exploration, search, file reads, grep, listing, research. Agent does NOT edit code.",
        "- `[tier:medium]` — Balanced model: implementation, refactoring, tests, code review, bug fixes, standard coding tasks.",
        "- `[tier:heavy]` — Most capable model: architecture, complex debugging (after failures), security, performance, multi-system tradeoffs.",
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
        "Rewrite the entire plan in the file with the tags. Do not change the substance — only add tags, and split mixed steps when useful for clearer delegation.",
      ].join("\n"),
      description: "Annotate a plan with [tier:fast/medium/heavy] delegation tags",
    },
  };
}

// ---------------------------------------------------------------------------
// Config loader with caching
// ---------------------------------------------------------------------------

let _cachedConfig: RouterConfig | null = null;
let _configDirty = true;
let _cachedConfigKey: string | null = null;
let _cachedDelegationProtocolTemplate: string | null = null;
const FALLBACK_DELEGATION_PROTOCOL_TEMPLATE = `<!-- Built-in fallback used when delegation-protocol.md is unavailable. -->
## Model Delegation Protocol — MANDATORY

You are the orchestrator. Preset: {{activePreset}}. Tiers: {{tierLine}}.{{modeSuffix}}

### HARD ROUTING
- Read-only exploration → delegate to @fast by default.
- Implementation work → delegate to @medium.
- Architecture, security, perf, or debugging after repeated failures → delegate to @heavy.

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

/** Mark config cache as stale so it is re-read on next access. */
export function invalidateConfigCache(): void {
  _configDirty = true;
  _cachedConfigKey = null;
}

function getPluginRoot(): string {
  return join(getSourceDir(), ".."); // src/ -> plugin root
}

function delegationProtocolTemplatePath(): string {
  return join(getSourceDir(), "templates", "delegation-protocol.md");
}

function buildInfoPath(): string {
  return join(getSourceDir(), "generated", "build-info.json");
}

function getSourceDir(): string {
  const commonJsDir = getCommonJsDirname();
  if (commonJsDir) {
    return commonJsDir;
  }

  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    const cwd = safeCurrentWorkingDir();
    return cwd ? join(cwd, "src") : ".";
  }
}

function getCommonJsDirname(): string | undefined {
  try {
    return typeof __dirname === "string" && __dirname ? __dirname : undefined;
  } catch {
    return undefined;
  }
}

function safeCurrentWorkingDir(): string | undefined {
  try {
    const cwd = process.cwd();
    return typeof cwd === "string" && cwd.trim() ? cwd : undefined;
  } catch {
    return undefined;
  }
}

function packageJsonVersion(): string {
  try {
    const raw = JSON.parse(readFileSync(join(getPluginRoot(), "package.json"), "utf-8"));
    return typeof raw?.version === "string" && raw.version.trim()
      ? raw.version.trim()
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function normalizeRouterBuildInfo(raw: unknown): RouterBuildInfo | null {
  if (typeof raw !== "object" || raw === null) return null;

  const candidate = raw as Record<string, unknown>;
  const baseVersion = candidate.baseVersion;
  const buildNumber = candidate.buildNumber;
  const buildSource = candidate.buildSource;
  const fullVersion = candidate.fullVersion;

  if (
    typeof baseVersion !== "string" ||
    typeof buildNumber !== "string" ||
    (buildSource !== "ci" && buildSource !== "override" && buildSource !== "local") ||
    typeof fullVersion !== "string"
  ) {
    return null;
  }

  return {
    baseVersion,
    buildNumber,
    buildSource,
    fullVersion,
  };
}

function loadRouterBuildInfo(): RouterBuildInfo {
  const fallbackBaseVersion = packageJsonVersion();

  try {
    const raw = JSON.parse(readFileSync(buildInfoPath(), "utf-8")) as unknown;
    const parsed = normalizeRouterBuildInfo(raw);
    if (parsed) return parsed;
  } catch {}

  return {
    baseVersion: fallbackBaseVersion,
    buildNumber: "dev",
    buildSource: "local",
    fullVersion: `${fallbackBaseVersion}+dev`,
  };
}

function getDelegationProtocolTemplate(): string {
  if (_cachedDelegationProtocolTemplate === null) {
    try {
      _cachedDelegationProtocolTemplate = readFileSync(
        delegationProtocolTemplatePath(),
        "utf-8",
      );
    } catch {
      console.warn(
        "[model-router] delegation protocol template unavailable; continuing without it.",
      );
      _cachedDelegationProtocolTemplate = FALLBACK_DELEGATION_PROTOCOL_TEMPLATE;
    }
  }
  return _cachedDelegationProtocolTemplate;
}

function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function normalizeConfiguredPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("file://")) return trimmed;

  try {
    return fileURLToPath(trimmed);
  } catch {
    return trimmed;
  }
}

export function resolveRouterPaths(
  env: NodeJS.ProcessEnv = process.env,
): RouterPaths {
  const configuredConfigPath = normalizeConfiguredPath(
    env.OPENCODE_MODEL_ROUTER_CONFIG_PATH,
  );
  const configuredStatePath = normalizeConfiguredPath(
    env.OPENCODE_MODEL_ROUTER_STATE_PATH,
  );
  const pluginConfigPath = join(getPluginRoot(), "tiers.json");
  const configPath = configuredConfigPath || pluginConfigPath;
  const statePath =
    configuredStatePath ||
    join(
      homedir(),
      ".config",
      "opencode",
      "opencode-model-router.state.json",
    );

  if (env.MODEL_ROUTER_DEBUG === "1") {
    console.warn(
      `[model-router] resolveRouterPaths configPath=${configPath} statePath=${statePath}`,
    );
  }

  return {
    configPath,
    statePath,
  };
}

function configPath(): string {
  return resolveRouterPaths().configPath;
}

function statePath(): string {
  return resolveRouterPaths().statePath;
}

export function resolvePresetName(
  cfg: RouterConfig,
  requestedPreset: string,
): string | undefined {
  if (cfg.presets?.[requestedPreset]) {
    return requestedPreset;
  }

  const normalized = requestedPreset.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return Object.keys(cfg.presets).find(
    (name) => name.toLowerCase() === normalized,
  );
}

export function validateConfig(raw: unknown): RouterConfig {
  return validateCanonicalConfig(raw);
}

export function applyPersistedState(
  cfg: RouterConfig,
  state: RouterState,
): RouterConfig {
  const normalizedState = normalizeRouterState(state);
  const nextCfg: RouterConfig = { ...cfg };

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

export function normalizeRouterState(raw: unknown): RouterState {
  if (!isPlainObject(raw)) {
    return {};
  }

  const state: RouterState = {};
  if (typeof raw.activePreset === "string" && raw.activePreset.trim()) {
    state.activePreset = raw.activePreset;
  }
  if (typeof raw.activeMode === "string" && raw.activeMode.trim()) {
    state.activeMode = raw.activeMode;
  }

  return state;
}

export function readStateFile(filePath: string): RouterState {
  try {
    if (existsSync(filePath)) {
      return normalizeRouterState(JSON.parse(readFileSync(filePath, "utf-8")));
    }
  } catch {
    // ignore
  }
  return {};
}

export function writeStateFile(
  filePath: string,
  patch: Partial<RouterState>,
): void {
  const state = normalizeRouterState({ ...readStateFile(filePath), ...patch });
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export function loadConfigFromPaths(
  paths: RouterPaths = resolveRouterPaths(),
): RouterConfig {
  const raw = JSON.parse(readFileSync(paths.configPath, "utf-8"));
  const cfg = validateConfig(raw);

  return applyPersistedState(cfg, readStateFile(paths.statePath));
}

function loadConfig(): RouterConfig {
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

function getFallbackConfig(): RouterConfig {
  return {
    activePreset: "fallback",
    activeMode: "normal",
    presets: {},
    rules: [],
    defaultTier: "fast",
  };
}

function safeLoadConfig(): RouterConfig {
  try {
    return loadConfig();
  } catch (error) {
    console.warn(
      `[model-router] using fallback config after load failure: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return getFallbackConfig();
  }
}

interface StartupConfig {
  cfg: RouterConfig;
  activeTiers: Preset;
  paths: RouterPaths;
}

function loadStartupConfig(): StartupConfig {
  const cfg = safeLoadConfig();
  let paths: RouterPaths;

  try {
    paths = resolveRouterPaths();
  } catch (error) {
    console.warn(
      `[model-router] failed to resolve startup paths: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    paths = {
      configPath: "unavailable",
      statePath: "unavailable",
    };
  }

  return {
    cfg,
    activeTiers: getActiveTiers(cfg),
    paths,
  };
}

function emitStartupDiagnostics(startup: StartupConfig): void {
  console.warn("[model-router] startup", {
    ...startup.paths,
    activePreset: startup.cfg.activePreset,
    presetKeys: Object.keys(startup.cfg.presets ?? {}),
    activeTierKeys: Object.keys(startup.activeTiers ?? {}),
  });
}

function warnIfProviderMetadataMissing(
  opencodeConfig: Record<string, any>,
  cfg: RouterConfig,
  tiers: Preset,
): void {
  const firstTier = Object.values(tiers ?? {})[0];
  const activeProvider =
    typeof firstTier?.model === "string"
      ? firstTier.model.split("/")[0]
      : undefined;

  if (!activeProvider) {
    return;
  }

  const providerConfig = opencodeConfig.provider ?? {};
  const enabledProviders = Array.isArray(opencodeConfig.enabled_providers)
    ? opencodeConfig.enabled_providers
    : [];
  const providerAvailable =
    Boolean(providerConfig[activeProvider]) ||
    enabledProviders.includes(activeProvider);

  if (!providerAvailable) {
    console.warn(
      `[model-router] provider metadata for '${activeProvider}' is unavailable during config(); router agents still registered for preset '${getActivePresetName(cfg)}'`,
    );
  }
}

// ---------------------------------------------------------------------------
// State persistence helpers
// ---------------------------------------------------------------------------

/** Read current persisted state (or empty object on failure). */
function readState(): RouterState {
  return readStateFile(statePath());
}

/** Write state to disk (merges with existing keys). */
function writeState(patch: Partial<RouterState>): void {
  writeStateFile(statePath(), patch);
}

function saveActivePreset(presetName: string): void {
  const cfg = loadConfig();
  const resolved = resolvePresetName(cfg, presetName);
  if (!resolved) {
    return;
  }

  cfg.activePreset = resolved;

  // Persist user-selected preset to state file only — never mutate tiers.json
  writeState({ activePreset: resolved });

  // Invalidate cache so next read picks up the new active preset
  invalidateConfigCache();
}

function saveActiveMode(modeName: string): void {
  const cfg = loadConfig();
  const resolvedMode = resolveModeName(cfg, modeName);
  if (!resolvedMode) {
    return;
  }

  cfg.activeMode = resolvedMode;
  writeState({ activeMode: resolvedMode });
  invalidateConfigCache();
}

function getActiveTiers(cfg: RouterConfig | null | undefined): Preset {
  if (!cfg || typeof cfg !== "object" || !("presets" in cfg)) {
    return {};
  }

  const presets = cfg.presets ?? {};
  if (!presets || Object.keys(presets).length === 0) {
    return {};
  }

  const activePreset =
    typeof cfg.activePreset === "string" && presets[cfg.activePreset]
      ? cfg.activePreset
      : Object.keys(presets)[0];

  return activePreset ? presets[activePreset] ?? {} : {};
}

function getActivePresetName(cfg: RouterConfig | null | undefined): string {
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

export function composePrompt(
  prefix: string | undefined,
  prompt: string | undefined,
): string | undefined {
  const normalizedPrefix = prefix?.trim() || undefined;
  const normalizedPrompt = prompt?.trim() || undefined;

  if (normalizedPrefix && normalizedPrompt) {
    return `${normalizedPrefix}\n\n---\n\n${normalizedPrompt}`;
  }

  return normalizedPrefix ?? normalizedPrompt;
}

// ---------------------------------------------------------------------------
// Mode helpers
// ---------------------------------------------------------------------------

function getActiveMode(cfg: RouterConfig): ModeConfig | undefined {
  if (!cfg.modes || !cfg.activeMode) return undefined;
  return cfg.modes[cfg.activeMode];
}

function buildPonytailPrompt(tierName: string | undefined, cfg: RouterConfig): string | undefined {
  if (cfg.activeMode !== PONYTAIL_MODE_NAME || !tierName) return undefined;
  if (!PONYTAIL_ENABLED_TIERS.has(tierName)) return undefined;

  const mode = getActiveMode(cfg);
  const tierNote = mode?.tierPrompts?.[tierName];
  if (!tierNote) return undefined;

  return [
    "PONYTAIL MODE — prefer the simplest, shortest path that actually works.",
    "Keep your existing STOP CONDITIONS, role boundaries, and return protocol exactly as-is.",
    "Do not rename or replace required prefixes such as DONE:, NEED MORE:, NEED CONTEXT:, SCOPE GROWTH:, or ESCALATE:.",
    "Before adding or keeping code, ask in order: can this be deleted, can stdlib do it, can a native platform feature do it, can the same result be done in fewer lines.",
    "Prefer no unrequested abstractions, no speculative flexibility, no avoidable dependencies, and no boilerplate.",
    "If two stdlib options are the same size, pick the one that stays correct on edge cases.",
    tierNote,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Fallback instructions builder
// ---------------------------------------------------------------------------

function buildFallbackInstructions(cfg: RouterConfig): string {
  const fb = cfg.fallback;
  if (!fb) return "";

  const activePreset = getActivePresetName(cfg);
  const presetMap = fb.presets?.[activePreset];
  const map =
    presetMap && Object.keys(presetMap).length > 0 ? presetMap : fb.global;
  if (!map) return "";

  const chains = Object.entries(map ?? {}).flatMap(([provider, presetOrder]) => {
    if (!Array.isArray(presetOrder)) return [];
    const valid = presetOrder.filter(
      (p) => p !== activePreset && Boolean(cfg.presets[p]),
    );
    return valid.length > 0 ? [`${provider}→${valid.join("→")}`] : [];
  });

  if (chains.length === 0) return "";
  return `Err→retry-alt-tier→fail→direct. Chain: ${chains.join(" | ")}`;
}

// ---------------------------------------------------------------------------
// Cost & taxonomy builders
// ---------------------------------------------------------------------------

function buildTaskTaxonomy(cfg: RouterConfig): string {
  if (!cfg.taskPatterns || Object.keys(cfg.taskPatterns).length === 0)
    return "";
  const lines = ["R:"];
  for (const [tier, patterns] of Object.entries(cfg.taskPatterns ?? {})) {
    if (Array.isArray(patterns) && patterns.length > 0) {
      lines.push(`@${tier}→${patterns.join("/")}`);
    }
  }
  return lines.join(" ");
}

/**
 * Injects a multi-phase decomposition hint into the delegation protocol.
 * Teaches the orchestrator to split composite tasks (explore + implement)
 * so the cheap @fast tier handles exploration and @medium handles execution.
 * Only active in normal mode — budget/quality modes have their own override rules.
 */
function buildDecomposeHint(cfg: RouterConfig): string {
  const mode = getActiveMode(cfg);
  // Budget and quality modes handle this via overrideRules — skip to avoid conflicts
  if (mode?.overrideRules?.length) return "";

  const tiers = getActiveTiers(cfg);
  const entries = Object.entries(tiers ?? {});
  if (entries.length < 2) return "";

  // Sort by costRatio ascending to find cheapest (explore) and next (execute) tiers
  const sorted = [...entries].sort(
    ([, a], [, b]) => (a.costRatio ?? 1) - (b.costRatio ?? 1),
  );
  const cheapest = sorted[0]?.[0];
  const mid = sorted[1]?.[0];
  if (!cheapest || !mid) return "";

  return `Multi-phase: prefer explore(@${cheapest})→execute(@${mid}) when phases are separable. Cheapest-first when practical.`;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

export function buildDelegationProtocol(cfg: RouterConfig): string {
  const tiers = getActiveTiers(cfg);

  // Compact tier summary: @name=model/variant(costRatio)
  const tierLine = Object.entries(tiers ?? {})
    .map(([name, t]) => {
      const short = t.model.split("/").pop() ?? t.model;
      const v = t.variant ? `/${t.variant}` : "";
      const c = t.costRatio != null ? `(${t.costRatio}x)` : "";
      return `@${name}=${short}${v}${c}`;
    })
    .join(" ");

  const mode = getActiveMode(cfg);
  const modeSuffix = cfg.activeMode ? ` mode:${cfg.activeMode}` : "";

  const taxonomy = buildTaskTaxonomy(cfg);
  const decompose = buildDecomposeHint(cfg);

  const effectiveRules = mode?.overrideRules?.length
    ? mode.overrideRules
    : cfg.rules ?? [];
  const rulesLine = effectiveRules.map((r, i) => `${i + 1}.${r}`).join(" ");

  const fallback = buildFallbackInstructions(cfg);

  return renderTemplate(getDelegationProtocolTemplate(), {
    activePreset: getActivePresetName(cfg),
    tierLine,
    modeSuffix,
    taxonomyBlock: taxonomy ? `${taxonomy}\n\n` : "",
    decomposeBlock: decompose ? `${decompose}\n\n` : "",
    rulesLine,
    fallbackBlock: fallback ? `\n\n${fallback}` : "",
  });
}

// ---------------------------------------------------------------------------
// /tiers command output
// ---------------------------------------------------------------------------

function buildTiersOutput(cfg: RouterConfig): string {
  const tiers = getActiveTiers(cfg);
  const lines: string[] = [
    `# Model Delegation Tiers`,
    `Active preset: **${getActivePresetName(cfg)}**\n`,
  ];

  for (const [name, tier] of Object.entries(tiers ?? {})) {
    const thinkingStr = tier.thinking
      ? ` | thinking: ${tier.thinking.budgetTokens} tokens`
      : tier.reasoning
        ? ` | reasoning: effort=${tier.reasoning.effort}`
        : "";
    lines.push(`## @${name} -> \`${tier.model}\`${thinkingStr}`);
    lines.push(tier.description);
    lines.push(`Steps: ${tier.steps ?? "default"}`);
    lines.push(`Use when: ${tier.whenToUse.join(", ")}\n`);
  }

  lines.push("## Delegation Rules");
  for (const r of cfg.rules ?? []) {
    lines.push(`- ${r}`);
  }
  lines.push(`\nDefault tier: @${cfg.defaultTier}`);
  lines.push(`\nAvailable presets: ${Object.keys(cfg.presets).join(", ")}`);
  lines.push(`Switch with: \`/preset <name>\``);
  lines.push(`Edit \`tiers.json\` to customize.`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// /mode command output
// ---------------------------------------------------------------------------

function normalizeCommandArgs(args: unknown): string {
  return typeof args === "string" ? args : "";
}

export function buildModeOutput(cfg: RouterConfig, args: unknown): string {
  const modes = cfg.modes;
  if (!modes || Object.keys(modes).length === 0) {
    return 'No modes configured in tiers.json. Add a "modes" section to enable routing modes.';
  }

  const requested = normalizeCommandArgs(args).trim().toLowerCase();
  const currentMode = cfg.activeMode || "normal";

  // No args: show current mode and available modes
  if (!requested) {
    const lines = ["# Routing Modes\n"];
    for (const [name, mode] of Object.entries(modes ?? {})) {
      const active = name === currentMode ? " <- active" : "";
      lines.push(
        `- **${name}**${active}: ${mode.description} (default tier: @${mode.defaultTier})`,
      );
    }
    lines.push(`\nSwitch with: \`/${MODE_COMMAND_NAME} <mode>\``);
    return lines.join("\n");
  }

  // Switch mode
  const resolvedMode = resolveModeName(cfg, requested);
  if (resolvedMode) {
    saveActiveMode(resolvedMode);
    const mode = modes[resolvedMode];
    return [
      `Routing mode switched to **${resolvedMode}**.`,
      "",
      mode.description,
      `Default tier: @${mode.defaultTier}`,
      ...(mode.overrideRules?.length
        ? ["", "Active rules:", ...mode.overrideRules.map((r) => `- ${r}`)]
        : []),
      "",
      "Mode change takes effect immediately on the next message.",
    ].join("\n");
  }

  return `Unknown mode: "${requested}". Available: ${Object.keys(modes).join(", ")}`;
}

// ---------------------------------------------------------------------------
// /preset command output
// ---------------------------------------------------------------------------

export function buildPresetOutput(cfg: RouterConfig, args: unknown): string {
  const requestedPreset = normalizeCommandArgs(args).trim();

  // No args: show available presets
  if (!requestedPreset) {
    const lines = ["# Available Presets\n"];
    for (const [name, tiers] of Object.entries(cfg.presets ?? {})) {
      const active = name === getActivePresetName(cfg) ? " <- active" : "";
      const models = Object.entries(tiers ?? {})
        .map(([tier, t]) => `${tier}: ${t.model.split("/").pop()}`)
        .join(", ");
      lines.push(`- **${name}**${active}: ${models}`);
    }
    lines.push(`\nSwitch with: \`/preset <name>\``);
    return lines.join("\n");
  }

  // Switch preset
  const resolvedPreset = resolvePresetName(cfg, requestedPreset);
  if (resolvedPreset) {
    saveActivePreset(resolvedPreset);
    cfg.activePreset = resolvedPreset;
    const tiers = cfg.presets[resolvedPreset]!;
    const models = Object.entries(tiers ?? {})
      .map(([tier, t]) => `  @${tier} -> ${t.model}`)
      .join("\n");
    return [
      `Preset switched to **${resolvedPreset}**.`,
      "",
      models,
      "",
      "Selection is now persisted in ~/.config/opencode/opencode-model-router.state.json.",
      "Restart OpenCode for subagent model registration to take effect.",
      "System prompt delegation rules update immediately.",
    ].join("\n");
  }

  return `Unknown preset: "${requestedPreset}". Available: ${Object.keys(cfg.presets).join(", ")}`;
}

// ---------------------------------------------------------------------------
// Runtime cap enforcement (tool.execute.after banner injection for subagents)
// ---------------------------------------------------------------------------

/** Tools that count against the read-only cap. Keep narrow — editing tools should never count. */
const READ_ONLY_TOOLS = new Set(["grep", "read", "glob", "ls"]);

/** Fallback caps when tiers.json has no tierCaps block. */
const DEFAULT_TIER_CAPS: Record<string, number> = {
  fast: 8,
  medium: 5,
  heavy: 3,
};

type Cap = number | "none";

interface SubagentState {
  tierName: string;
  cap: Cap;
  calls: number;
  /** Fingerprint → call index where this fingerprint was first seen. */
  seen: Map<string, number>;
}

/** Extract the first `CAP:N` or `CAP:none` directive from a dispatch prompt. */
export function parseCapDirective(text: string): Cap | null {
  const m = text.match(/\bCAP\s*:\s*(none|\d+)\b/i);
  if (!m) return null;
  const raw = m[1]!.toLowerCase();
  if (raw === "none") return "none";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fingerprint a read-only tool call for redundancy detection. */
function fingerprintToolCall(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
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

/** Best-effort extraction of textual content from a chat.message output payload. */
export function extractDispatchText(output: unknown): string {
  const o = output as Record<string, unknown> | undefined;
  const parts = Array.isArray(o?.parts) ? o.parts : [];
  const chunks: string[] = [];
  for (const p of parts) {
    if (typeof p === "string") {
      chunks.push(p);
    } else if (p && typeof p === "object") {
      const rec = p as Record<string, unknown>;
      if (typeof rec.text === "string") chunks.push(rec.text);
      else if (typeof rec.content === "string") chunks.push(rec.content);
    }
  }
  if (chunks.length === 0) {
    const msg = o?.message as Record<string, unknown> | undefined;
    const content = msg?.content;
    if (typeof content === "string") chunks.push(content);
  }
  return chunks.join("\n");
}

/** Build the banner appended to every read-only tool result in a subagent session. */
export function buildCapBanner(
  state: SubagentState,
  isRedundant: boolean,
  previousCall: number | undefined,
  tool: string,
): string {
  const lines: string[] = [];
  const capDisplay = state.cap === "none" ? "∞" : String(state.cap);
  lines.push(`[cap: ${state.calls}/${capDisplay}]`);

  if (isRedundant && previousCall !== undefined) {
    lines.push(
      `[⚠ REDUNDANT: this is the same ${tool} you ran at call #${previousCall}. STOP now — repeated reads add no information. Return with DONE/NEED MORE/NEED CONTEXT/SCOPE GROWTH/ESCALATE.]`,
    );
  }

  if (state.cap !== "none") {
    const remaining = state.cap - state.calls;
    if (remaining <= 0) {
      lines.push(
        `[⚠ CAP REACHED (${state.calls}/${state.cap}): your NEXT response MUST be a return — do NOT make another read-only call. Start the response with DONE:, NEED MORE:, NEED CONTEXT:, SCOPE GROWTH:, or ESCALATE:.]`,
      );
    } else if (remaining <= 2) {
      lines.push(
        `[⚠ CAP WARNING: ${remaining} read-only call(s) remaining before forced return]`,
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Narration detector (telemetry — logs + appends banner)
// ---------------------------------------------------------------------------

/** Regex patterns that flag progress narration without production. */
const NARRATION_PATTERNS: RegExp[] = [
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
  /\bcontinuing\s+(with|by\s+\w+ing)\s+(the\s+)?\w+/gi,
];

/** Returns matched narration phrases, deduped and capped. Empty array = no narration detected. */
export function detectNarration(text: unknown): string[] {
  if (typeof text !== "string" || text.length < 20) return [];
  const seen = new Set<string>();
  const out: string[] = [];
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

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const ModelRouterPlugin: Plugin = (_ctx: PluginInput) => {
  let cfg = getFallbackConfig();
  let activeTiers = getActiveTiers(cfg);

  // Track subagent sessions so we can skip delegation protocol injection.
  // Populated by chat.params (which has the agent name) before system.transform fires.
  const subagentSessionIDs = new Set<string>();

  // Per-subagent-session cap state for runtime enforcement. Populated on chat.message,
  // read/updated by tool.execute.after. Keyed by sessionID. Orchestrator sessions are
  // intentionally NOT tracked here (per user decision: enforce on subagents only).
  const subagentCapState = new Map<string, SubagentState>();

  // Bypass mode: when true, the router skips all system prompt injection,
  // subagent tracking, cap enforcement, and narration detection for the
  // current plugin lifetime (i.e., until OpenCode is restarted).
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
    "chat.message": async (input: any, output: any) => {
      if (bypassed) return;
      // Re-read cfg so /preset switches take effect without restart
      try {
        cfg = loadConfig();
      } catch {}
      const tierNames = Object.keys(getActiveTiers(cfg));
      if (input.agent && tierNames.includes(input.agent)) {
        subagentSessionIDs.add(input.sessionID);

        // Initialize cap state on first dispatch; reset on subsequent rounds to the same
        // subagent session (rare but supported — treats each round as a fresh budget).
        const tierName = input.agent as string;
        const dispatchText = extractDispatchText(output);
        const override = parseCapDirective(dispatchText);
        const baseline =
          cfg.tierCaps?.[tierName] ?? DEFAULT_TIER_CAPS[tierName] ?? 5;
        const cap: Cap = override ?? baseline;
        subagentCapState.set(input.sessionID, {
          tierName,
          cap,
          calls: 0,
          seen: new Map(),
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
    "tool.execute.after": async (input: any, output: any) => {
      if (bypassed) return;
      const state = subagentCapState.get(input.sessionID);
      if (!state) return; // not a tracked subagent session
      if (!READ_ONLY_TOOLS.has(input.tool)) return;

      const fp = fingerprintToolCall(input.tool, input.args);
      const previousCall = state.seen.get(fp);
      const isRedundant = previousCall !== undefined;

      state.calls += 1;
      if (!isRedundant) {
        state.seen.set(fp, state.calls);
      }

      const banner = buildCapBanner(state, isRedundant, previousCall, input.tool);

      const existing =
        typeof output.output === "string" ? output.output : "";
      output.output = existing ? `${existing}\n\n${banner}` : banner;
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
    "experimental.text.complete": async (input: any, output: any) => {
      if (bypassed) return;
      const safeOutput =
        typeof output === "object" && output !== null ? output : undefined;
      const text = typeof safeOutput?.text === "string" ? safeOutput.text : "";
      if (text.length < 20) return;

      const found = detectNarration(text);
      if (found.length === 0) return;

      const quoted = found
        .map((m) => `"${m.slice(0, 60)}${m.length > 60 ? "…" : ""}"`)
        .join(", ");
      if (!safeOutput) return;

      safeOutput.text = `${text}\n\n[⚠ narration detected: ${quoted}]`;
    },

    // -----------------------------------------------------------------------
    // Register tier agents + commands at load time
    // -----------------------------------------------------------------------
    config: (opencodeConfig: any) => {
      if (opencodeConfig == null) {
        return opencodeConfig;
      }

      const startup = loadStartupConfig();
      cfg = startup.cfg;
      activeTiers = startup.activeTiers;
      emitStartupDiagnostics(startup);
      registerActiveTierAgents(opencodeConfig, cfg, activeTiers);
      warnIfProviderMetadataMissing(opencodeConfig, cfg, activeTiers);

      // Register commands
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
    "experimental.chat.system.transform": async (_input: any, output: any) => {
      if (bypassed) return;
      try {
        cfg = loadConfig(); // Returns cache unless invalidated
      } catch {
        // Use last known config if file read fails
      }

      const sessionID = _input?.sessionID;
      if (sessionID && subagentSessionIDs.has(sessionID)) {
        const ponytailPrompt = buildPonytailPrompt(
          subagentCapState.get(sessionID)?.tierName,
          cfg,
        );
        if (ponytailPrompt) {
          output.system.push(ponytailPrompt);
        }
        return;
      }

      const providerID = _input?.model?.providerID ?? "";
      const modelID = _input?.model?.modelID ?? "";
      const orchestratorModel =
        providerID && modelID ? `${providerID}/${modelID}` : modelID;
      const providerPrefix = resolveProviderAdapter(
        orchestratorModel,
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
    "command.execute.before": async (input: any, output: any) => {
      if (input.command === MODE_COMMAND_NAME) {
        try {
          cfg = loadConfig();
        } catch {}
        output.parts.push({
          type: "text" as const,
          text: buildModeOutput(cfg, input.args ?? input.arguments ?? ""),
        });
        return;
      }

      if (input.command === "tiers") {
        try {
          cfg = loadConfig();
        } catch {}
        output.parts.push({
          type: "text" as const,
          text: buildTiersOutput(cfg),
        });
      }

      if (input.command === "preset") {
        try {
          cfg = loadConfig();
        } catch {}
        output.parts.push({
          type: "text" as const,
          text: buildPresetOutput(cfg, input.arguments ?? ""),
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
        const desc = bypassed
          ? "Model-router is **bypassed**. Delegation protocol, cap enforcement, and narration detection are disabled. The model will run without routing rules until you run `/bypass off` or restart OpenCode."
          : "Model-router is **active**. Delegation protocol and all enforcement rules are in effect.";
        output.parts.push({
          type: "text" as const,
          text: `# Bypass: ${status}\n\n${desc}`,
        });
      }

    },
  };
};

export default ModelRouterPlugin;
export const server = ModelRouterPlugin;
(ModelRouterPlugin as typeof ModelRouterPlugin & { server?: typeof ModelRouterPlugin }).server =
  ModelRouterPlugin;
(ModelRouterPlugin as typeof ModelRouterPlugin & { version?: string }).version =
  routerVersion;

export const tui = async (api: any) => {
  const register = api?.command?.register;
  if (typeof register !== "function") return;

  register(() =>
    Object.entries(getRouterCommandSpecs()).map(([name, spec]) => ({
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
      },
    })),
  );
};

export function buildAgentDefinition(
  name: string,
  tier: TierConfig,
  cfg: RouterConfig,
): Record<string, unknown> {
  const providerAdapter = resolveProviderAdapter(tier.model);
  const resolvedPrompt = tier.prompt ?? cfg.tierPrompts?.[name];
  const providerPromptPrefix = providerAdapter.buildTierPromptPrefix(
    name,
    tier.model,
  );
  const finalPrompt = composePrompt(providerPromptPrefix, resolvedPrompt);

  const agentDef: Record<string, unknown> = {
    model: tier.model,
    mode: "subagent",
    description: tier.description,
    maxSteps: tier.steps,
    prompt: finalPrompt,
    color: tier.color,
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

export function registerActiveTierAgents(
  opencodeConfig: Record<string, any>,
  cfg: RouterConfig,
  tiers: Preset = getActiveTiers(cfg),
): void {
  opencodeConfig.agent ??= {};

  for (const [name, tier] of Object.entries(tiers ?? {})) {
    if (typeof tier !== "object" || tier === null) {
      console.warn(
        `[model-router] skipping invalid tier '${name}' in active preset '${getActivePresetName(cfg)}'`,
      );
      continue;
    }
    const agentDef = buildAgentDefinition(name, tier, cfg);
    opencodeConfig.agent[name] = agentDef;
  }
}
