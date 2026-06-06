import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export interface TierConfig {
  model: string;
  description: string;
  whenToUse: string[];
  variant?: string;
  costRatio?: number;
  steps?: number;
  [key: string]: unknown;
}

export type Preset = Record<string, TierConfig>;

export interface ModeConfig {
  defaultTier: string;
  description: string;
  overrideRules?: string[];
}

export interface RouterConfig {
  activePreset: string;
  activeMode?: string;
  presets: Record<string, Preset>;
  rules: string[];
  defaultTier: string;
  modes?: Record<string, ModeConfig>;
  tierCaps?: Record<string, number>;
  tierPrompts?: Record<string, string>;
  taskPatterns?: Record<string, string[]>;
  fallback?: Record<string, unknown>;
}

export interface RouterState {
  activePreset?: string;
  activeMode?: string;
  [key: string]: unknown;
}

export interface RouterPaths {
  configPath: string;
  statePath: string;
}

export interface ResolvedRouterPolicy {
  activePreset: string;
  activeMode?: string;
  defaultTier: string;
  rules: string[];
  tierCaps: Record<string, number>;
  taskPatterns: Record<string, string[]>;
}

export interface AdapterPathsOptions {
  host: string;
  packageRoot: string;
  env?: NodeJS.ProcessEnv;
  configEnvVar?: string;
  stateEnvVar?: string;
  configFileName?: string;
  stateFileName?: string;
  stateDirectorySegments?: string[];
}

export interface AdapterEnvironmentOptions {
  env?: NodeJS.ProcessEnv;
  paths: RouterPaths;
  configEnvVar?: string;
  stateEnvVar?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
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

function ensureObject(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message);
  }

  return value;
}

function validateTierConfig(
  presetName: string,
  tierName: string,
  value: unknown,
): TierConfig {
  const tier = ensureObject(
    value,
    `tiers.json: tier '${presetName}.${tierName}' must be an object`,
  );

  if (typeof tier.model !== "string" || !tier.model.trim()) {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.model' must be a non-empty string`,
    );
  }
  if (typeof tier.description !== "string") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.description' must be a string`,
    );
  }
  if (!isStringArray(tier.whenToUse)) {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.whenToUse' must be an array of strings`,
    );
  }
  if (tier.variant !== undefined && typeof tier.variant !== "string") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.variant' must be a string`,
    );
  }
  if (tier.costRatio !== undefined && typeof tier.costRatio !== "number") {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.costRatio' must be a number`,
    );
  }
  if (
    tier.steps !== undefined &&
    (typeof tier.steps !== "number" || !Number.isInteger(tier.steps) || tier.steps < 1)
  ) {
    throw new Error(
      `tiers.json: '${presetName}.${tierName}.steps' must be a positive integer`,
    );
  }

  return tier as TierConfig;
}

export function validateConfig(raw: unknown): RouterConfig {
  const obj = ensureObject(raw, "tiers.json: expected a JSON object at root");

  if (typeof obj.activePreset !== "string" || !obj.activePreset.trim()) {
    throw new Error("tiers.json: 'activePreset' must be a non-empty string");
  }
  if (obj.activeMode !== undefined && typeof obj.activeMode !== "string") {
    throw new Error("tiers.json: 'activeMode' must be a string");
  }

  const presets = ensureObject(obj.presets, "tiers.json: 'presets' must be a non-null object");
  const normalizedPresets: Record<string, Preset> = {};
  for (const [presetName, presetValue] of Object.entries(presets)) {
    const preset = ensureObject(
      presetValue,
      `tiers.json: preset '${presetName}' must be an object`,
    );

    const normalizedPreset: Preset = {};

    for (const [tierName, tierValue] of Object.entries(preset)) {
      normalizedPreset[tierName] = validateTierConfig(presetName, tierName, tierValue);
    }

    normalizedPresets[presetName] = normalizedPreset;
  }

  if (!isStringArray(obj.rules)) {
    throw new Error("tiers.json: 'rules' must be an array of strings");
  }
  if (typeof obj.defaultTier !== "string") {
    throw new Error("tiers.json: 'defaultTier' must be a string");
  }

  if (obj.modes !== undefined) {
    const modes = ensureObject(obj.modes, "tiers.json: 'modes' must be an object");
    for (const [modeName, value] of Object.entries(modes)) {
      const mode = ensureObject(value, `tiers.json: mode '${modeName}' must be an object`);
      if (typeof mode.defaultTier !== "string") {
        throw new Error(`tiers.json: mode '${modeName}.defaultTier' must be a string`);
      }
      if (typeof mode.description !== "string") {
        throw new Error(`tiers.json: mode '${modeName}.description' must be a string`);
      }
      if (mode.overrideRules !== undefined && !isStringArray(mode.overrideRules)) {
        throw new Error(
          `tiers.json: mode '${modeName}.overrideRules' must be an array of strings`,
        );
      }
    }
  }

  if (obj.tierCaps !== undefined) {
    const caps = ensureObject(obj.tierCaps, "tiers.json: 'tierCaps' must be an object");
    for (const [tierName, value] of Object.entries(caps)) {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        throw new Error(`tiers.json: tierCaps.'${tierName}' must be a positive integer`);
      }
    }
  }

  if (obj.tierPrompts !== undefined) {
    const prompts = ensureObject(
      obj.tierPrompts,
      "tiers.json: 'tierPrompts' must be an object",
    );
    for (const [tierName, value] of Object.entries(prompts)) {
      if (typeof value !== "string") {
        throw new Error(`tiers.json: tierPrompts.'${tierName}' must be a string`);
      }
    }
  }

  if (obj.taskPatterns !== undefined) {
    const taskPatterns = ensureObject(
      obj.taskPatterns,
      "tiers.json: 'taskPatterns' must be an object",
    );
    for (const [tierName, value] of Object.entries(taskPatterns)) {
      if (!isStringArray(value)) {
        throw new Error(`tiers.json: taskPatterns.'${tierName}' must be an array of strings`);
      }
    }
  }

  if (obj.fallback !== undefined) {
    ensureObject(obj.fallback, "tiers.json: 'fallback' must be an object");
  }

  const normalizedModes = obj.modes as Record<string, ModeConfig> | undefined;
  const normalizedTierCaps = obj.tierCaps as Record<string, number> | undefined;
  const normalizedTierPrompts = obj.tierPrompts as Record<string, string> | undefined;
  const normalizedTaskPatterns = obj.taskPatterns as Record<string, string[]> | undefined;
  const normalizedFallback = obj.fallback as Record<string, unknown> | undefined;

  return {
    activePreset: obj.activePreset,
    activeMode: obj.activeMode as string | undefined,
    presets: normalizedPresets,
    rules: obj.rules as string[],
    defaultTier: obj.defaultTier,
    modes: normalizedModes,
    tierCaps: normalizedTierCaps,
    tierPrompts: normalizedTierPrompts,
    taskPatterns: normalizedTaskPatterns,
    fallback: normalizedFallback,
  };
}

export function readConfig(configPath: string): RouterConfig {
  return validateConfig(JSON.parse(readFileSync(configPath, "utf-8")) as unknown);
}

export function resolvePresetName(
  cfg: RouterConfig,
  requestedPreset: string,
): string | undefined {
  if (cfg.presets[requestedPreset]) {
    return requestedPreset;
  }

  const normalized = requestedPreset.trim().toLowerCase();
  if (!normalized) return undefined;

  return Object.keys(cfg.presets).find((name) => name.toLowerCase() === normalized);
}

export function resolveActivePreset(
  cfg: RouterConfig,
  state?: RouterState,
): string {
  const requested = state?.activePreset?.trim();
  if (requested) {
    const resolved = resolvePresetName(cfg, requested);
    if (resolved) return resolved;
  }

  return cfg.activePreset;
}

export function resolveModeConfig(
  cfg: RouterConfig,
  modeName: string | undefined,
): ModeConfig | undefined {
  if (!modeName || !cfg.modes) return undefined;
  return cfg.modes[modeName];
}

export function resolveActiveMode(
  cfg: RouterConfig,
  state?: RouterState,
): string | undefined {
  const requested = state?.activeMode?.trim() || cfg.activeMode?.trim();
  if (!requested || !cfg.modes?.[requested]) {
    return undefined;
  }

  return requested;
}

export function calculateTierCaps(cfg: RouterConfig): Record<string, number> {
  return { ...(cfg.tierCaps ?? {}) };
}

export function resolvePolicy(
  cfg: RouterConfig,
  state?: RouterState,
): ResolvedRouterPolicy {
  const activePreset = resolveActivePreset(cfg, state);
  const activeMode = resolveActiveMode(cfg, state);
  const mode = resolveModeConfig(cfg, activeMode);

  return {
    activePreset,
    activeMode,
    defaultTier: mode?.defaultTier ?? cfg.defaultTier,
    rules: mode?.overrideRules ?? cfg.rules,
    tierCaps: calculateTierCaps(cfg),
    taskPatterns: { ...(cfg.taskPatterns ?? {}) },
  };
}

export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export function renderPrompt(
  template: string,
  cfg: RouterConfig,
  state?: RouterState,
): string {
  const policy = resolvePolicy(cfg, state);
  const preset = cfg.presets[policy.activePreset] ?? {};
  const tierLine = Object.entries(preset)
    .map(([tierName, tier]) => `${tierName}=${tier.model}`)
    .join(", ");
  const modeSuffix = policy.activeMode ? ` Mode: ${policy.activeMode}.` : "";
  const rulesLine = policy.rules.length ? `- ${policy.rules.join("\n- ")}` : "";

  return renderTemplate(template, {
    activePreset: policy.activePreset,
    activeMode: policy.activeMode ?? "",
    defaultTier: policy.defaultTier,
    modeSuffix,
    rulesLine,
    tierLine,
  });
}

export interface ModelReference {
  provider?: string;
  model: string;
}

export function parseModelReference(input: string): ModelReference {
  const trimmed = input.trim();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    return { model: trimmed };
  }

  return {
    provider: trimmed.slice(0, slashIndex).trim().toLowerCase(),
    model: trimmed.slice(slashIndex + 1).trim(),
  };
}

export function normalizeModelReference(input: string): string {
  const parsed = parseModelReference(input);
  return parsed.provider ? `${parsed.provider}/${parsed.model}` : parsed.model;
}

export function createAdapterPaths(options: AdapterPathsOptions): RouterPaths {
  const env = options.env ?? process.env;
  const configEnvVar = options.configEnvVar ?? "MODEL_ROUTER_CONFIG_PATH";
  const stateEnvVar = options.stateEnvVar ?? "MODEL_ROUTER_STATE_PATH";
  const configuredConfigPath = normalizeConfiguredPath(env[configEnvVar]);
  const configuredStatePath = normalizeConfiguredPath(env[stateEnvVar]);

  return {
    configPath:
      configuredConfigPath ?? join(options.packageRoot, options.configFileName ?? "tiers.json"),
    statePath:
      configuredStatePath ??
      join(
        homedir(),
        ...(options.stateDirectorySegments ?? [".config", options.host]),
        options.stateFileName ?? `${options.host}-model-router.state.json`,
      ),
  };
}

export function withAdapterEnvironment<T>(
  options: AdapterEnvironmentOptions,
  action: () => T,
): T {
  const env = options.env ?? process.env;
  const configEnvVar = options.configEnvVar ?? "MODEL_ROUTER_CONFIG_PATH";
  const stateEnvVar = options.stateEnvVar ?? "MODEL_ROUTER_STATE_PATH";
  const previousConfig = env[configEnvVar];
  const previousState = env[stateEnvVar];

  if (!previousConfig) {
    env[configEnvVar] = options.paths.configPath;
  }
  if (!previousState) {
    env[stateEnvVar] = options.paths.statePath;
  }

  try {
    return action();
  } finally {
    if (previousConfig === undefined) {
      delete env[configEnvVar];
    } else {
      env[configEnvVar] = previousConfig;
    }

    if (previousState === undefined) {
      delete env[stateEnvVar];
    } else {
      env[stateEnvVar] = previousState;
    }
  }
}

export function readState<TState extends RouterState = RouterState>(
  statePath: string,
): TState | undefined {
  if (!existsSync(statePath)) return undefined;

  return JSON.parse(readFileSync(statePath, "utf-8")) as TState;
}

export function writeState(statePath: string, state: RouterState): void {
  const dirPath = dirname(statePath);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function packageRootFrom(importMetaUrl: string): string {
  return join(dirname(fileURLToPath(importMetaUrl)), "..");
}
