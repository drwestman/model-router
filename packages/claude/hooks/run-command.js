#!/usr/bin/env node

const { loadConfig } = require("./config");
const { runCommand } = require("./commands");
const { loadState } = require("./state");

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;

  if (!command) {
    process.stderr.write(
      "[model-router] usage: run-command <tiers|preset|mode|bypass|annotate-plan|ponytail-review> [args]\n",
    );
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const state = loadState(config);
  const output = runCommand(config, state, command, args.join(" "));

  if (output === null) {
    process.stderr.write(`[model-router] unknown command '${command}'.\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${output}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
