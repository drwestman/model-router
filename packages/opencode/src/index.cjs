"use strict";

const pluginModule = require("./index.bundle.cjs");
const pluginExport =
  typeof pluginModule === "function" ? pluginModule : pluginModule.default;

module.exports = pluginExport;
Object.assign(module.exports, pluginModule);
