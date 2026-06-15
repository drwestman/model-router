const fs = require("node:fs");
const path = require("node:path");

const configPath =
  process.env.CLAUDE_MODEL_ROUTER_CONFIG_PATH ||
  path.join(__dirname, "..", "tiers.json");

function fail(message) {
  throw new Error(`[model-router] ${message}`);
}

function getPreset(config, presetName) {
  return config.presets[presetName] || null;
}

function getMode(config, modeName) {
  return config.modes[modeName] || null;
}

function getTier(config, presetName, tierName) {
  return config.presets[presetName]?.tiers[tierName] || null;
}

function listPresetNames(config) {
  return Object.keys(config.presets);
}

function listModeNames(preset) {
  return preset?.modes ? Object.keys(preset.modes) : [];
}

function listGlobalModeNames(config) {
  return Object.keys(config.modes);
}

function defaultModeForPreset(config, presetName) {
  const preset = getPreset(config, presetName);

  if (!preset) {
    return config.defaultMode;
  }

  if (config.modes[config.defaultMode]) {
    return config.defaultMode;
  }

  return Object.keys(config.modes)[0];
}

function loadConfig() {
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("tiers.json must be a valid JSON object.");
  }

  const presets = parsed.presets;
  const modes = parsed.modes;
  const tierCaps = parsed.tierCaps;
  const rules = Array.isArray(parsed.rules) ? parsed.rules : [];

  if (!presets || Array.isArray(presets) || Object.keys(presets).length === 0) {
    fail("tiers.json must define at least one preset.");
  }

  if (!modes || Array.isArray(modes) || Object.keys(modes).length === 0) {
    fail("tiers.json must define at least one mode.");
  }

  const defaultPreset =
    typeof parsed.defaultPreset === "string"
      ? parsed.defaultPreset
      : Object.keys(presets)[0];

  if (!presets[defaultPreset]) {
    fail(`defaultPreset '${defaultPreset}' is not defined.`);
  }

  const defaultMode =
    typeof parsed.defaultMode === "string"
      ? parsed.defaultMode
      : Object.keys(modes)[0];

  const normalized = { defaultPreset, defaultMode, presets, modes, rules, tierCaps };

  for (const presetName of Object.keys(presets)) {
    const currentPreset = presets[presetName];

    if (!currentPreset?.tiers || Object.keys(currentPreset.tiers).length === 0) {
      fail(`preset '${presetName}' must define tiers.`);
    }

    for (const tierName of ["fast", "medium", "heavy"]) {
      if (typeof currentPreset.tiers[tierName]?.model !== "string") {
        fail(`preset '${presetName}' must define a model for tier '${tierName}'.`);
      }
    }
  }

  if (!modes[defaultMode]) {
    fail(`defaultMode '${defaultMode}' is not defined.`);
  }

  return normalized;
}

module.exports = {
  configPath,
  defaultModeForPreset,
  getMode,
  getPreset,
  getTier,
  listGlobalModeNames,
  listModeNames,
  listPresetNames,
  loadConfig,
};
