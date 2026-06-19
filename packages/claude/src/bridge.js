import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODE_COMMAND_NAME, createAdapterPaths, packageRootFrom, readConfig, readState as readPersistedState, resolveModeName, resolvePolicy, resolvePresetName, writeState as writePersistedState, } from "@drwestman/model-router-core";
const TIER_NAMES = ["fast", "medium", "heavy"];
const RULE_KEYWORDS = {
    fast: [
        "search",
        "inspect",
        "read",
        "list",
        "check",
        "grep",
        "docs",
        "lookup",
        "look up",
        "summarize",
        "find",
    ],
    medium: [
        "implement",
        "change",
        "edit",
        "refactor",
        "add",
        "update",
        "test",
        "fix",
        "write",
        "debug",
        "create",
        "build",
        "review",
    ],
    heavy: [
        "architecture",
        "root cause",
        "performance",
        "security",
        "migrate",
        "migration",
        "multi-system",
        "tradeoff",
        "rewrite",
        "deep analysis",
        "complex debug",
    ],
};
const COMMAND_USAGE = "run-command <tiers|preset|mode|bypass|delegate|annotate-plan|ponytail-review> [args]";
function resolvePackageRoot() {
    if (typeof __dirname === "string" && __dirname) {
        return join(__dirname, "..");
    }
    return packageRootFrom(import.meta.url);
}
export const adapterName = "claude";
const adapterPathOptions = {
    host: adapterName,
    packageRoot: resolvePackageRoot(),
    configEnvVar: "CLAUDE_MODEL_ROUTER_CONFIG_PATH",
    stateEnvVar: "CLAUDE_MODEL_ROUTER_STATE_PATH",
    stateDirectorySegments: [".config", "claude"],
    stateFileName: "model-router.state.json",
};
function resolveAdapterPaths(env = process.env) {
    return createAdapterPaths({
        ...adapterPathOptions,
        env,
    });
}
function fail(message) {
    throw new Error(`[model-router] ${message}`);
}
function isTierName(value) {
    return TIER_NAMES.includes(value);
}
function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function compileKeywordRegex(keyword) {
    const pattern = keyword
        .trim()
        .split(/\s+/)
        .map(escapeRegExp)
        .join("\\s+");
    return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`, "i");
}
const RULE_KEYWORD_REGEXES = {
    fast: RULE_KEYWORDS.fast.map(compileKeywordRegex),
    medium: RULE_KEYWORDS.medium.map(compileKeywordRegex),
    heavy: RULE_KEYWORDS.heavy.map(compileKeywordRegex),
};
function hasKeyword(text, keyword) {
    return (keyword instanceof RegExp ? keyword : compileKeywordRegex(keyword)).test(text);
}
function addMatches(text, tier, patterns, weight, scores) {
    let matches = 0;
    for (const pattern of patterns) {
        if (hasKeyword(text, pattern)) {
            scores[tier] += weight;
            matches += 1;
        }
    }
    return matches;
}
function getPolicyDefaultTier(policyDefaultTier) {
    return isTierName(policyDefaultTier) ? policyDefaultTier : "medium";
}
function scorePrompt(config, state, prompt) {
    const text = normalizeText(prompt).toLowerCase();
    const policy = resolvePolicy(config, state);
    const scores = { fast: 0, medium: 0, heavy: 0 };
    let strongTier;
    const explicitTier = text.match(/(?:^|\s)(?:@|tier:)(fast|medium|heavy)(?=$|\s|[.,;:!?])/i)?.[1]?.toLowerCase();
    if (explicitTier && isTierName(explicitTier)) {
        strongTier = explicitTier;
        scores[explicitTier] += 10;
    }
    for (const tier of TIER_NAMES) {
        const ruleMatches = addMatches(text, tier, RULE_KEYWORD_REGEXES[tier], 2, scores);
        const taskPatterns = (policy.taskPatterns?.[tier] ?? []).filter(Boolean);
        const taskMatches = addMatches(text, tier, taskPatterns, 3, scores);
        if (!strongTier && (ruleMatches >= 2 || taskMatches >= 2)) {
            strongTier = tier;
        }
    }
    if (!strongTier) {
        if (/^(inspect|search|read|list|grep|find|look up|lookup|summarize)\b/.test(text)) {
            strongTier = "fast";
            scores.fast += 4;
        }
        else if (/^(implement|fix|write|edit|refactor|add|update|test|debug|create|build)\b/.test(text)) {
            strongTier = "medium";
            scores.medium += 4;
        }
        else if (/^(analyze|diagnose|investigate|migrate|redesign)\b/.test(text)) {
            strongTier = "heavy";
            scores.heavy += 4;
        }
    }
    const sorted = [...TIER_NAMES].sort((left, right) => scores[right] - scores[left]);
    const tier = sorted[0] ?? getPolicyDefaultTier(policy.defaultTier);
    const topScore = scores[tier];
    const secondTier = sorted[1] ?? tier;
    const secondScore = scores[secondTier];
    const margin = topScore - secondScore;
    if (topScore < 3 || margin <= 0) {
        return {
            tier: getPolicyDefaultTier(policy.defaultTier),
            confidence: "ambiguous",
        };
    }
    if (strongTier === tier || (topScore >= 6 && margin >= 2)) {
        return { tier, confidence: "very-high" };
    }
    if (topScore >= 4 && margin >= 1) {
        return { tier, confidence: "moderate" };
    }
    return {
        tier: getPolicyDefaultTier(policy.defaultTier),
        confidence: "ambiguous",
    };
}
function getActivePreset(config, state) {
    const policy = resolvePolicy(config, state);
    return config.presets[policy.activePreset] ?? {};
}
function getTierContract(tierName) {
    switch (tierName) {
        case "fast":
            return "read-only exploration, concrete findings, no code edits";
        case "heavy":
            return "deep analysis for architecture, security, performance, or hard debugging";
        default:
            return "implementation, refactoring, tests, and targeted verification";
    }
}
function buildDelegationTemplate(config, state, tierName, task) {
    const normalizedState = normalizeState(config, state);
    const policy = resolvePolicy(config, normalizedState);
    const preset = config.presets[policy.activePreset] ?? {};
    const tier = preset[tierName];
    if (!tier) {
        fail(`tier '${tierName}' is not available in preset '${policy.activePreset}'.`);
    }
    return [
        "[model-router]",
        `delegate: @${tierName}`,
        `preset: ${policy.activePreset}`,
        `mode: ${policy.activeMode ?? "none"}`,
        `model: ${tier.model}`,
        `cap: ${config.tierCaps?.[tierName] ?? "none"}`,
        `contract: ${getTierContract(tierName)}`,
        "if native Claude subagents are available, delegate the task below.",
        "if they are unavailable, do the same work locally.",
        "task:",
        task.trim(),
    ].join("\n");
}
function buildRoutingHint(classification) {
    if (classification.confidence !== "moderate") {
        return null;
    }
    return `[model-router] likely @${classification.tier}. Delegate if Claude subagents are available; otherwise keep the same scope locally.`;
}
function buildPromptContext(config, state, prompt) {
    const classification = scorePrompt(config, state, prompt);
    if (classification.confidence === "very-high") {
        return buildDelegationTemplate(config, state, classification.tier, prompt.trim());
    }
    return buildRoutingHint(classification);
}
function readPromptFromStdin() {
    let input;
    try {
        input = readFileSync(0, "utf8");
    }
    catch {
        return null;
    }
    if (!input.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(input);
        if (typeof parsed?.prompt === "string") {
            return parsed.prompt;
        }
        return typeof parsed?.data?.prompt === "string" ? parsed.data.prompt : null;
    }
    catch {
        return null;
    }
}
function emit(text, event = "UserPromptSubmit") {
    if (!text) {
        return;
    }
    if (process.env.PLUGIN_DATA) {
        process.stdout.write(`${JSON.stringify({
            hookSpecificOutput: {
                hookEventName: event,
                additionalContext: text,
            },
        })}\n`);
        return;
    }
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}
function listPresetNames(config) {
    return Object.keys(config.presets ?? {});
}
function listGlobalModeNames(config) {
    return Object.keys(config.modes ?? {});
}
function defaultModeForPreset(config) {
    return config.activeMode ?? listGlobalModeNames(config)[0];
}
function getPreset(config, presetName) {
    const resolved = resolvePresetName(config, presetName);
    return resolved ? config.presets[resolved] ?? null : null;
}
function getMode(config, modeName) {
    const resolved = resolveModeName(config, modeName);
    return resolved ? config.modes?.[resolved] ?? null : null;
}
function getTier(config, presetName, tierName) {
    const preset = getPreset(config, presetName);
    return preset?.[tierName] ?? null;
}
function loadConfig() {
    return readConfig(resolveAdapterPaths().configPath);
}
function defaultState(config) {
    return {
        activePreset: config.activePreset,
        activeMode: defaultModeForPreset(config),
        bypass: false,
    };
}
function normalizeState(config, input) {
    const base = defaultState(config);
    if (!input || typeof input !== "object") {
        return base;
    }
    const value = input;
    const resolvedPreset = typeof value.activePreset === "string"
        ? resolvePresetName(config, value.activePreset)
        : undefined;
    const resolvedMode = typeof value.activeMode === "string"
        ? resolveModeName(config, value.activeMode)
        : undefined;
    if (resolvedPreset) {
        base.activePreset = resolvedPreset;
    }
    if (resolvedMode) {
        base.activeMode = resolvedMode;
    }
    if (typeof value.bypass === "boolean") {
        base.bypass = value.bypass;
    }
    return base;
}
function loadState(config) {
    return normalizeState(config, readPersistedState(resolveAdapterPaths().statePath));
}
function saveState(config, input) {
    const next = normalizeState(config, input);
    writePersistedState(resolveAdapterPaths().statePath, next);
    return next;
}
function statusLine(state) {
    return `active: ${state.activePreset}/${state.activeMode} | bypass: ${state.bypass ? "on" : "off"}`;
}
function buildSessionText(config, state) {
    const normalizedState = normalizeState(config, state);
    if (normalizedState.bypass) {
        return "[model-router disabled] /bypass off to re-enable.";
    }
    const policy = resolvePolicy(config, normalizedState);
    const preset = getActivePreset(config, normalizedState);
    const mode = policy.activeMode ? config.modes?.[policy.activeMode] : undefined;
    return [
        "[model-router]",
        `preset: ${policy.activePreset}`,
        `mode: ${policy.activeMode ?? "none"}`,
        `mode guidance: ${mode?.description ?? "none"}`,
        `default tier: ${policy.defaultTier}`,
        `fast: ${preset.fast?.model ?? "unavailable"}${config.tierCaps?.fast ? ` (cap ${config.tierCaps.fast})` : ""}`,
        `medium: ${preset.medium?.model ?? "unavailable"}${config.tierCaps?.medium ? ` (cap ${config.tierCaps.medium})` : ""}`,
        `heavy: ${preset.heavy?.model ?? "unavailable"}${config.tierCaps?.heavy ? ` (cap ${config.tierCaps.heavy})` : ""}`,
        "tag plans with [tier:fast], [tier:medium], or [tier:heavy] when work mixes exploration and implementation.",
        ...policy.rules.map((rule) => `rule: ${rule}`),
        "commands: /tiers /preset <name> /mode <name> /bypass on|off /delegate <tier> <task> /annotate-plan <plan text>",
        "if Claude subagents are unavailable, follow the same tier guidance locally.",
    ].join("\n");
}
function buildTiersText(config, state) {
    const normalizedState = normalizeState(config, state);
    const policy = resolvePolicy(config, normalizedState);
    const lines = ["[model-router]", statusLine(normalizedState), "presets:"];
    for (const presetName of listPresetNames(config)) {
        const preset = config.presets[presetName] ?? {};
        lines.push(`- ${presetName}: fast=${preset.fast?.model ?? "unavailable"}, medium=${preset.medium?.model ?? "unavailable"}, heavy=${preset.heavy?.model ?? "unavailable"}`);
    }
    lines.push("modes:");
    for (const modeName of listGlobalModeNames(config)) {
        const marker = modeName === policy.activeMode ? "*" : "";
        const mode = config.modes?.[modeName];
        lines.push(`- ${modeName}${marker}: ${mode?.description ?? ""} Default tier: ${mode?.defaultTier ?? "unknown"}.`);
    }
    return lines.join("\n");
}
function buildStateText(state) {
    return `[model-router] ${statusLine(state)}`;
}
function usage(command, values) {
    return `[model-router] usage: ${command} ${values}`;
}
function getPlanSteps(text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return [];
    }
    if (trimmed.includes("\n")) {
        return trimmed
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
    }
    return trimmed
        .split(";")
        .map((step) => step.trim())
        .filter(Boolean);
}
function annotateStep(config, state, step) {
    const match = step.match(/^([-*+]\s+|\d+[.)]\s+)(.*)$/);
    const prefix = match ? match[1] : "";
    const body = match ? match[2].trim() : step.trim();
    if (!body) {
        return null;
    }
    const classification = scorePrompt(config, state, body);
    const tier = classification.confidence === "ambiguous" ? "medium" : classification.tier;
    return `${prefix}${body} [tier:${tier}]`;
}
function handlePreset(config, state, args) {
    const presetName = args[0];
    if (!presetName) {
        return usage("/preset", `<name> (${listPresetNames(config).join(", ")})`);
    }
    const resolvedPreset = resolvePresetName(config, presetName);
    if (!resolvedPreset) {
        return `[model-router] unknown preset '${presetName}'. Available: ${listPresetNames(config).join(", ")}`;
    }
    return buildStateText(saveState(config, {
        ...state,
        activePreset: resolvedPreset,
    }));
}
function handleMode(config, state, args) {
    const modeName = args[0];
    if (!modeName) {
        return usage(`/${MODE_COMMAND_NAME}`, `<name> (${listGlobalModeNames(config).join(", ")})`);
    }
    const resolvedMode = resolveModeName(config, modeName);
    if (!resolvedMode) {
        return `[model-router] unknown mode '${modeName}'. Available: ${listGlobalModeNames(config).join(", ")}`;
    }
    return buildStateText(saveState(config, {
        ...state,
        activeMode: resolvedMode,
    }));
}
function handleBypass(config, state, args) {
    const value = args[0];
    if (value !== "on" && value !== "off") {
        return "[model-router] usage: /bypass on|off";
    }
    return buildStateText(saveState(config, {
        ...state,
        bypass: value === "on",
    }));
}
function handleDelegate(config, state, argText) {
    const trimmed = argText.trim();
    const firstSpace = trimmed.indexOf(" ");
    const tierName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace).trim();
    const task = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();
    if (!isTierName(tierName) || !task) {
        return "[model-router] usage: /delegate <fast|medium|heavy> <task>";
    }
    return buildDelegationTemplate(config, state, tierName, task);
}
function handleAnnotatePlan(config, state, argText) {
    const steps = getPlanSteps(argText)
        .map((step) => annotateStep(config, state, step))
        .filter((value) => Boolean(value));
    if (steps.length === 0) {
        return "[model-router] usage: /annotate-plan <plan text>";
    }
    return steps.join("\n");
}
function handlePonytailReview(argText) {
    const text = argText.trim();
    if (!text) {
        return [
            "[model-router] ponytail review",
            "- delete non-required work first",
            "- prefer stdlib/native before deps",
            "- keep files/helpers/tests minimal",
        ].join("\n");
    }
    const lower = text.toLowerCase();
    const cut = [];
    const keep = ["direct hook change only", "targeted smoke test only"];
    const escalate = [];
    if (/(dependency|package|library|framework)/.test(lower)) {
        cut.push("new dependency unless stdlib/native fails");
    }
    if (/(abstract|abstraction|helper|utility|wrapper|framework)/.test(lower)) {
        cut.push("extra abstraction until duplication is real");
    }
    if (/(file|module|folder|directory)/.test(lower)) {
        cut.push("multi-file spread if one file can do it");
    }
    if (/(state|persist|session|startup|system prompt)/.test(lower)) {
        escalate.push("it changes state or session-start behavior");
    }
    if (/(migrate|migration|architecture|rewrite|platform)/.test(lower)) {
        escalate.push("it stops being a small hook change");
    }
    return [
        "[model-router] ponytail review",
        `cut: ${cut.join("; ") || "anything not required for the asked behavior"}`,
        `keep: ${keep.join("; ")}`,
        `escalate only if: ${escalate.join("; ") || "the change cannot stay local and transient"}`,
    ].join("\n");
}
function normalizeCommandName(command) {
    if (typeof command !== "string") {
        return null;
    }
    const trimmed = command.trim();
    if (!trimmed) {
        return null;
    }
    const bare = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    if (bare.startsWith("model-router:")) {
        return bare.slice("model-router:".length);
    }
    if (bare.startsWith("model-router.")) {
        return bare.slice("model-router.".length);
    }
    return bare;
}
function runCommand(config, state, command, argText = "") {
    const commandName = normalizeCommandName(command);
    if (!commandName) {
        return null;
    }
    const args = argText.trim() ? argText.trim().split(/\s+/) : [];
    switch (commandName) {
        case "tiers":
            return buildTiersText(config, state);
        case "preset":
            return handlePreset(config, state, args);
        case MODE_COMMAND_NAME:
            return handleMode(config, state, args);
        case "bypass":
            return handleBypass(config, state, args);
        case "delegate":
            return handleDelegate(config, state, argText);
        case "annotate-plan":
            return handleAnnotatePlan(config, state, argText);
        case "ponytail-review":
            return handlePonytailReview(argText);
        default:
            return null;
    }
}
function handleCommand(config, state, prompt) {
    if (typeof prompt !== "string") {
        return null;
    }
    const trimmed = prompt.trim();
    if (!trimmed.startsWith("/")) {
        return null;
    }
    const match = trimmed.match(/^(\/\S+)(?:\s+([\s\S]*))?$/);
    if (!match) {
        return null;
    }
    return runCommand(config, state, match[1], match[2] ?? "");
}
function promptSubmitMain() {
    const prompt = readPromptFromStdin();
    if (!prompt) {
        return;
    }
    const config = loadConfig();
    const state = loadState(config);
    const commandOutput = handleCommand(config, state, prompt);
    if (commandOutput !== null) {
        emit(commandOutput);
        return;
    }
    if (prompt.trim().startsWith("/") || state.bypass) {
        return;
    }
    emit(buildPromptContext(config, state, prompt));
}
function activateMain() {
    const config = loadConfig();
    const state = loadState(config);
    emit(buildSessionText(config, state), "SessionStart");
}
function runCommandMain(argv = process.argv.slice(2)) {
    const [command, ...args] = argv;
    if (!command) {
        process.stderr.write(`[model-router] usage: ${COMMAND_USAGE}\n`);
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
export { activateMain, resolveAdapterPaths, buildDelegationTemplate, buildPromptContext, buildSessionText, buildStateText, buildTiersText, defaultModeForPreset, defaultState, getMode, getPreset, getTier, handleCommand, listGlobalModeNames, listPresetNames, loadConfig, loadState, normalizeCommandName, normalizeState, promptSubmitMain, runCommand, runCommandMain, saveState, scorePrompt, };
export const config = {
    get adapterPaths() {
        return resolveAdapterPaths();
    },
    get configPath() {
        return resolveAdapterPaths().configPath;
    },
    defaultModeForPreset,
    getMode,
    getPreset,
    getTier,
    listGlobalModeNames,
    listPresetNames,
    loadConfig,
};
export const state = {
    defaultState,
    loadState,
    normalizeState,
    saveState,
    get statePath() {
        return resolveAdapterPaths().statePath;
    },
};
export const instructions = {
    buildSessionText,
    buildStateText,
    buildTiersText,
};
export const commands = {
    buildDelegationTemplate,
    buildPromptContext,
    handleCommand,
    normalizeCommandName,
    runCommand,
    scorePrompt,
};
export const output = {
    emit,
};
