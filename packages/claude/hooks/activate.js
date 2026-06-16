const { loadConfig } = require("./config");
const { buildSessionText } = require("./instructions");
const { emit } = require("./output");
const { loadState } = require("./state");

function main() {
  const config = loadConfig();
  const state = loadState(config);

  emit(buildSessionText(config, state), "SessionStart");
}

main();
