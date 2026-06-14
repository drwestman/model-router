const { getMode, getPreset, listGlobalModeNames, listPresetNames } = require("./config");

function statusLine(state) {
  return `active: ${state.activePreset}/${state.activeMode} | bypass: ${state.bypass ? "on" : "off"}`;
}

function buildSessionText(config, state) {
  if (state.bypass) {
    return "[model-router disabled] /bypass off to re-enable.";
  }

  const preset = getPreset(config, state.activePreset);
  const mode = getMode(config, state.activeMode);
  const tiers = preset.tiers;
  const caps = config.tierCaps || {};
  const rules = Array.isArray(config.rules) ? config.rules : [];

  return [
    "[model-router]",
    `preset: ${state.activePreset}`,
    `mode: ${state.activeMode}`,
    `mode guidance: ${mode.description}`,
    `default tier: ${mode.defaultTier}`,
    `fast: ${tiers.fast.model}${caps.fast ? ` (cap ${caps.fast})` : ""}`,
    `medium: ${tiers.medium.model}${caps.medium ? ` (cap ${caps.medium})` : ""}`,
    `heavy: ${tiers.heavy.model}${caps.heavy ? ` (cap ${caps.heavy})` : ""}`,
    "tag plans with [tier:fast], [tier:medium], or [tier:heavy] when a plan has mixed work.",
    ...rules.map((rule) => `rule: ${rule}`),
    "commands: /tiers /preset <name> /mode <name> /bypass on|off /annotate-plan <plan text>",
  ].join("\n");
}

function buildTiersText(config, state) {
  const lines = ["[model-router]", statusLine(state), "presets:"];

  for (const presetName of listPresetNames(config)) {
    const preset = getPreset(config, presetName);
    lines.push(
      `- ${presetName}: fast=${preset.tiers.fast.model}, medium=${preset.tiers.medium.model}, heavy=${preset.tiers.heavy.model}`,
    );
  }

  lines.push("modes:");

  for (const modeName of listGlobalModeNames(config)) {
    const marker = modeName === state.activeMode ? "*" : "";
    const mode = getMode(config, modeName);

    lines.push(`- ${modeName}${marker}: ${mode.description} Default tier: ${mode.defaultTier}.`);
  }

  return lines.join("\n");
}

function buildStateText(state) {
  return `[model-router] ${statusLine(state)}`;
}

module.exports = {
  buildSessionText,
  buildStateText,
  buildTiersText,
};
