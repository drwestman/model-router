"use strict";

const pluginModule = require("./index.bundle.cjs");
const pluginExport =
  typeof pluginModule === "function" ? pluginModule : pluginModule.default;

module.exports = pluginExport;
for (const key of Object.keys(pluginModule)) {
  if (key !== "default" && !(key in pluginExport)) {
    pluginExport[key] = pluginModule[key];
  }
}
