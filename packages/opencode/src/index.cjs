"use strict";

const pluginModule = require("./index.js");
const pluginExport =
  typeof pluginModule === "function" ? pluginModule : pluginModule.default;

module.exports = pluginExport;
Object.assign(module.exports, pluginModule);
