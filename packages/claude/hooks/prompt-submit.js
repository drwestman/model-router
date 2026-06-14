const fs = require("node:fs");

const { handleCommand } = require("./commands");
const { loadConfig } = require("./config");
const { emit } = require("./output");
const { loadState } = require("./state");

function readPrompt() {
  const input = fs.readFileSync(0, "utf8");

  if (!input.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    if (typeof parsed?.prompt === "string") {
      return parsed.prompt;
    }

    return typeof parsed?.data?.prompt === "string" ? parsed.data.prompt : null;
  } catch {
    return null;
  }
}

function main() {
  const prompt = readPrompt();

  if (!prompt) {
    return;
  }

  const config = loadConfig();
  const state = loadState(config);

  emit(handleCommand(config, state, prompt));
}

main();
