const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const statePath =
  process.env.CLAUDE_MODEL_ROUTER_STATE_PATH ||
  path.join(os.homedir(), ".config", "claude", "model-router.state.json");

const { defaultModeForPreset, getPreset } = require("./config");

function defaultState(config) {
  return {
    activePreset: config.defaultPreset,
    activeMode: defaultModeForPreset(config, config.defaultPreset),
    bypass: false,
  };
}

function normalizeState(config, input) {
  const base = defaultState(config);

  if (!input || typeof input !== "object") {
    return base;
  }

  if (typeof input.activePreset === "string" && getPreset(config, input.activePreset)) {
    base.activePreset = input.activePreset;
  }

  if (typeof input.activeMode === "string" && config.modes[input.activeMode]) {
    base.activeMode = input.activeMode;
  }

  if (typeof input.bypass === "boolean") {
    base.bypass = input.bypass;
  }

  return base;
}

function loadState(config) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return normalizeState(config, parsed);
  } catch {
    return defaultState(config);
  }
}

function saveState(config, input) {
  const next = normalizeState(config, input);

  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const tempPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;

  fs.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, statePath);

  return next;
}

module.exports = {
  loadState,
  saveState,
  statePath,
};
