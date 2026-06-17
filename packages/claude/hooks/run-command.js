#!/usr/bin/env node

const { runCommandMain } = require("../src/bridge.cjs");

if (require.main === module) {
  runCommandMain();
}

module.exports = {
  main: runCommandMain,
};
