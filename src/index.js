"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var os_1 = require("os");
var path_1 = require("path");
var url_1 = require("url");
// ---------------------------------------------------------------------------
// Config loader with caching
// ---------------------------------------------------------------------------
var _cachedConfig = null;
var _configDirty = true;
var _cachedDelegationProtocolTemplate = null;
/** Mark config cache as stale so it is re-read on next access. */
function invalidateConfigCache() {
    _configDirty = true;
}
function getPluginRoot() {
    var __dirname = (0, path_1.dirname)((0, url_1.fileURLToPath)(import.meta.url));
    return (0, path_1.join)(__dirname, ".."); // src/ -> plugin root
}
function delegationProtocolTemplatePath() {
    return (0, url_1.fileURLToPath)(new URL("./templates/delegation-protocol.md", import.meta.url));
}
function initializeDelegationProtocolTemplate() {
    _cachedDelegationProtocolTemplate = (0, fs_1.readFileSync)(delegationProtocolTemplatePath(), "utf-8");
    return _cachedDelegationProtocolTemplate;
}
function getDelegationProtocolTemplate() {
    if (_cachedDelegationProtocolTemplate === null) {
        throw new Error("delegation protocol template not initialized");
    }
    return _cachedDelegationProtocolTemplate;
}
function renderTemplate(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, function (_, key) { var _a; return (_a = values[key]) !== null && _a !== void 0 ? _a : ""; });
}
function configPath() {
    return (0, path_1.join)(getPluginRoot(), "tiers.json");
}
function statePath() {
    return (0, path_1.join)((0, os_1.homedir)(), ".config", "opencode", "opencode-model-router.state.json");
}
function resolvePresetName(cfg, requestedPreset) {
    if (cfg.presets[requestedPreset]) {
        return requestedPreset;
    }
    var normalized = requestedPreset.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    return Object.keys(cfg.presets).find(function (name) { return name.toLowerCase() === normalized; });
}
function validateConfig(raw) {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("tiers.json: expected a JSON object at root");
    }
    var obj = raw;
    if (typeof obj.activePreset !== "string" || !obj.activePreset) {
        throw new Error("tiers.json: 'activePreset' must be a non-empty string");
    }
    if (typeof obj.presets !== "object" ||
        obj.presets === null ||
        Array.isArray(obj.presets)) {
        throw new Error("tiers.json: 'presets' must be a non-null object");
    }
    var presets = obj.presets;
    for (var _i = 0, _a = Object.entries(presets); _i < _a.length; _i++) {
        var _b = _a[_i], presetName = _b[0], preset = _b[1];
        if (typeof preset !== "object" ||
            preset === null ||
            Array.isArray(preset)) {
            throw new Error("tiers.json: preset '".concat(presetName, "' must be an object"));
        }
        var tiers = preset;
        for (var _c = 0, _d = Object.entries(tiers); _c < _d.length; _c++) {
            var _e = _d[_c], tierName = _e[0], tier = _e[1];
            if (typeof tier !== "object" || tier === null) {
                throw new Error("tiers.json: tier '".concat(presetName, ".").concat(tierName, "' must be an object"));
            }
            var t = tier;
            if (typeof t.model !== "string" || !t.model) {
                throw new Error("tiers.json: '".concat(presetName, ".").concat(tierName, ".model' must be a non-empty string"));
            }
            if (typeof t.description !== "string") {
                throw new Error("tiers.json: '".concat(presetName, ".").concat(tierName, ".description' must be a string"));
            }
            if (!Array.isArray(t.whenToUse)) {
                throw new Error("tiers.json: '".concat(presetName, ".").concat(tierName, ".whenToUse' must be an array"));
            }
        }
    }
    if (!Array.isArray(obj.rules)) {
        throw new Error("tiers.json: 'rules' must be an array of strings");
    }
    if (typeof obj.defaultTier !== "string") {
        throw new Error("tiers.json: 'defaultTier' must be a string");
    }
    // Validate modes if present
    if (obj.modes !== undefined) {
        if (typeof obj.modes !== "object" ||
            obj.modes === null ||
            Array.isArray(obj.modes)) {
            throw new Error("tiers.json: 'modes' must be an object");
        }
        var modes = obj.modes;
        for (var _f = 0, _g = Object.entries(modes); _f < _g.length; _f++) {
            var _h = _g[_f], modeName = _h[0], mode = _h[1];
            if (typeof mode !== "object" || mode === null) {
                throw new Error("tiers.json: mode '".concat(modeName, "' must be an object"));
            }
            var m = mode;
            if (typeof m.defaultTier !== "string") {
                throw new Error("tiers.json: mode '".concat(modeName, ".defaultTier' must be a string"));
            }
            if (typeof m.description !== "string") {
                throw new Error("tiers.json: mode '".concat(modeName, ".description' must be a string"));
            }
        }
    }
    // Validate tierCaps if present
    if (obj.tierCaps !== undefined) {
        if (typeof obj.tierCaps !== "object" ||
            obj.tierCaps === null ||
            Array.isArray(obj.tierCaps)) {
            throw new Error("tiers.json: 'tierCaps' must be an object");
        }
        var tc = obj.tierCaps;
        for (var _j = 0, _k = Object.entries(tc); _j < _k.length; _j++) {
            var _l = _k[_j], tierName = _l[0], cap = _l[1];
            if (typeof cap !== "number" || !Number.isFinite(cap) || cap < 1) {
                throw new Error("tiers.json: tierCaps.'".concat(tierName, "' must be a positive integer"));
            }
        }
    }
    // Validate tierPrompts if present
    if (obj.tierPrompts !== undefined) {
        if (typeof obj.tierPrompts !== "object" ||
            obj.tierPrompts === null ||
            Array.isArray(obj.tierPrompts)) {
            throw new Error("tiers.json: 'tierPrompts' must be an object");
        }
        var tp = obj.tierPrompts;
        for (var _m = 0, _o = Object.entries(tp); _m < _o.length; _m++) {
            var _p = _o[_m], tierName = _p[0], prompt_1 = _p[1];
            if (typeof prompt_1 !== "string") {
                throw new Error("tiers.json: tierPrompts.'".concat(tierName, "' must be a string"));
            }
        }
    }
    // Validate taskPatterns if present
    if (obj.taskPatterns !== undefined) {
        if (typeof obj.taskPatterns !== "object" ||
            obj.taskPatterns === null ||
            Array.isArray(obj.taskPatterns)) {
            throw new Error("tiers.json: 'taskPatterns' must be an object");
        }
        var tp = obj.taskPatterns;
        for (var _q = 0, _r = Object.entries(tp); _q < _r.length; _q++) {
            var _s = _r[_q], tierName = _s[0], patterns = _s[1];
            if (!Array.isArray(patterns)) {
                throw new Error("tiers.json: taskPatterns.'".concat(tierName, "' must be an array of strings"));
            }
        }
    }
    return raw;
}
function loadConfig() {
    var _a;
    if (_cachedConfig && !_configDirty) {
        return _cachedConfig;
    }
    var raw = JSON.parse((0, fs_1.readFileSync)(configPath(), "utf-8"));
    var cfg = validateConfig(raw);
    try {
        if ((0, fs_1.existsSync)(statePath())) {
            var state = JSON.parse((0, fs_1.readFileSync)(statePath(), "utf-8"));
            if (state.activePreset) {
                var resolved = resolvePresetName(cfg, state.activePreset);
                if (resolved) {
                    cfg.activePreset = resolved;
                }
            }
            if (state.activeMode && ((_a = cfg.modes) === null || _a === void 0 ? void 0 : _a[state.activeMode])) {
                cfg.activeMode = state.activeMode;
            }
        }
    }
    catch (_b) {
        // Ignore state read errors and keep tiers.json defaults
    }
    _cachedConfig = cfg;
    _configDirty = false;
    return cfg;
}
// ---------------------------------------------------------------------------
// State persistence helpers
// ---------------------------------------------------------------------------
/** Read current persisted state (or empty object on failure). */
function readState() {
    try {
        if ((0, fs_1.existsSync)(statePath())) {
            return JSON.parse((0, fs_1.readFileSync)(statePath(), "utf-8"));
        }
    }
    catch (_a) {
        // ignore
    }
    return {};
}
/** Write state to disk (merges with existing keys). */
function writeState(patch) {
    var state = __assign(__assign({}, readState()), patch);
    var p = statePath();
    (0, fs_1.mkdirSync)((0, path_1.dirname)(p), { recursive: true });
    (0, fs_1.writeFileSync)(p, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
function saveActivePreset(presetName) {
    var cfg = loadConfig();
    var resolved = resolvePresetName(cfg, presetName);
    if (!resolved) {
        return;
    }
    cfg.activePreset = resolved;
    // Persist user-selected preset to state file only — never mutate tiers.json
    writeState({ activePreset: resolved });
    // Invalidate cache so next read picks up the new active preset
    invalidateConfigCache();
}
function saveActiveMode(modeName) {
    var _a;
    var cfg = loadConfig();
    if (!((_a = cfg.modes) === null || _a === void 0 ? void 0 : _a[modeName])) {
        return;
    }
    cfg.activeMode = modeName;
    writeState({ activeMode: modeName });
    invalidateConfigCache();
}
function getActiveTiers(cfg) {
    var _a;
    return (_a = cfg.presets[cfg.activePreset]) !== null && _a !== void 0 ? _a : Object.values(cfg.presets)[0];
}
// ---------------------------------------------------------------------------
// Build agent options from tier config
// ---------------------------------------------------------------------------
function buildAgentOptions(tier) {
    var opts = {};
    // Anthropic thinking config
    if (tier.thinking) {
        if (tier.thinking.budgetTokens) {
            opts.budget_tokens = tier.thinking.budgetTokens;
        }
    }
    // OpenAI reasoning config
    if (tier.reasoning) {
        if (tier.reasoning.effort) {
            opts.reasoning_effort = tier.reasoning.effort;
        }
        if (tier.reasoning.summary) {
            opts.reasoning_summary = tier.reasoning.summary;
        }
    }
    return Object.keys(opts).length > 0 ? opts : {};
}
// ---------------------------------------------------------------------------
// Mode helpers
// ---------------------------------------------------------------------------
function getActiveMode(cfg) {
    if (!cfg.modes || !cfg.activeMode)
        return undefined;
    return cfg.modes[cfg.activeMode];
}
// ---------------------------------------------------------------------------
// Fallback instructions builder
// ---------------------------------------------------------------------------
function buildFallbackInstructions(cfg) {
    var _a;
    var fb = cfg.fallback;
    if (!fb)
        return "";
    var presetMap = (_a = fb.presets) === null || _a === void 0 ? void 0 : _a[cfg.activePreset];
    var map = presetMap && Object.keys(presetMap).length > 0 ? presetMap : fb.global;
    if (!map)
        return "";
    var chains = Object.entries(map).flatMap(function (_a) {
        var provider = _a[0], presetOrder = _a[1];
        if (!Array.isArray(presetOrder))
            return [];
        var valid = presetOrder.filter(function (p) { return p !== cfg.activePreset && Boolean(cfg.presets[p]); });
        return valid.length > 0 ? ["".concat(provider, "\u2192").concat(valid.join("→"))] : [];
    });
    if (chains.length === 0)
        return "";
    return "Err\u2192retry-alt-tier\u2192fail\u2192direct. Chain: ".concat(chains.join(" | "));
}
// ---------------------------------------------------------------------------
// Cost & taxonomy builders
// ---------------------------------------------------------------------------
function buildTaskTaxonomy(cfg) {
    if (!cfg.taskPatterns || Object.keys(cfg.taskPatterns).length === 0)
        return "";
    var lines = ["R:"];
    for (var _i = 0, _a = Object.entries(cfg.taskPatterns); _i < _a.length; _i++) {
        var _b = _a[_i], tier = _b[0], patterns = _b[1];
        if (Array.isArray(patterns) && patterns.length > 0) {
            lines.push("@".concat(tier, "\u2192").concat(patterns.join("/")));
        }
    }
    return lines.join(" ");
}
/**
 * Injects a multi-phase decomposition hint into the delegation protocol.
 * Teaches the orchestrator to split composite tasks (explore + implement)
 * so the cheap @fast tier handles exploration and @medium handles execution.
 * Only active in normal mode — budget/quality modes have their own override rules.
 */
function buildDecomposeHint(cfg) {
    var _a, _b, _c;
    var mode = getActiveMode(cfg);
    // Budget and quality modes handle this via overrideRules — skip to avoid conflicts
    if ((_a = mode === null || mode === void 0 ? void 0 : mode.overrideRules) === null || _a === void 0 ? void 0 : _a.length)
        return "";
    var tiers = getActiveTiers(cfg);
    var entries = Object.entries(tiers);
    if (entries.length < 2)
        return "";
    // Sort by costRatio ascending to find cheapest (explore) and next (execute) tiers
    var sorted = __spreadArray([], entries, true).sort(function (_a, _b) {
        var _c, _d;
        var a = _a[1];
        var b = _b[1];
        return ((_c = a.costRatio) !== null && _c !== void 0 ? _c : 1) - ((_d = b.costRatio) !== null && _d !== void 0 ? _d : 1);
    });
    var cheapest = (_b = sorted[0]) === null || _b === void 0 ? void 0 : _b[0];
    var mid = (_c = sorted[1]) === null || _c === void 0 ? void 0 : _c[0];
    if (!cheapest || !mid)
        return "";
    return "Multi-phase: prefer explore(@".concat(cheapest, ")\u2192execute(@").concat(mid, ") when phases are separable. Cheapest-first when practical.");
}
// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildDelegationProtocol(cfg) {
    var _a;
    var tiers = getActiveTiers(cfg);
    // Compact tier summary: @name=model/variant(costRatio)
    var tierLine = Object.entries(tiers)
        .map(function (_a) {
        var _b;
        var name = _a[0], t = _a[1];
        var short = (_b = t.model.split("/").pop()) !== null && _b !== void 0 ? _b : t.model;
        var v = t.variant ? "/".concat(t.variant) : "";
        var c = t.costRatio != null ? "(".concat(t.costRatio, "x)") : "";
        return "@".concat(name, "=").concat(short).concat(v).concat(c);
    })
        .join(" ");
    var mode = getActiveMode(cfg);
    var modeSuffix = cfg.activeMode ? " mode:".concat(cfg.activeMode) : "";
    var taxonomy = buildTaskTaxonomy(cfg);
    var decompose = buildDecomposeHint(cfg);
    var effectiveRules = ((_a = mode === null || mode === void 0 ? void 0 : mode.overrideRules) === null || _a === void 0 ? void 0 : _a.length)
        ? mode.overrideRules
        : cfg.rules;
    var rulesLine = effectiveRules.map(function (r, i) { return "".concat(i + 1, ".").concat(r); }).join(" ");
    var fallback = buildFallbackInstructions(cfg);
    return renderTemplate(getDelegationProtocolTemplate(), {
        activePreset: cfg.activePreset,
        tierLine: tierLine,
        modeSuffix: modeSuffix,
        taxonomyBlock: taxonomy ? "".concat(taxonomy, "\n\n") : "",
        decomposeBlock: decompose ? "".concat(decompose, "\n\n") : "",
        rulesLine: rulesLine,
        fallbackBlock: fallback ? "\n\n".concat(fallback) : "",
    });
}
// ---------------------------------------------------------------------------
// /tiers command output
// ---------------------------------------------------------------------------
function buildTiersOutput(cfg) {
    var _a;
    var tiers = getActiveTiers(cfg);
    var lines = [
        "# Model Delegation Tiers",
        "Active preset: **".concat(cfg.activePreset, "**\n"),
    ];
    for (var _i = 0, _b = Object.entries(tiers); _i < _b.length; _i++) {
        var _c = _b[_i], name_1 = _c[0], tier = _c[1];
        var thinkingStr = tier.thinking
            ? " | thinking: ".concat(tier.thinking.budgetTokens, " tokens")
            : tier.reasoning
                ? " | reasoning: effort=".concat(tier.reasoning.effort)
                : "";
        lines.push("## @".concat(name_1, " -> `").concat(tier.model, "`").concat(thinkingStr));
        lines.push(tier.description);
        lines.push("Steps: ".concat((_a = tier.steps) !== null && _a !== void 0 ? _a : "default"));
        lines.push("Use when: ".concat(tier.whenToUse.join(", "), "\n"));
    }
    lines.push("## Delegation Rules");
    cfg.rules.forEach(function (r) { return lines.push("- ".concat(r)); });
    lines.push("\nDefault tier: @".concat(cfg.defaultTier));
    lines.push("\nAvailable presets: ".concat(Object.keys(cfg.presets).join(", ")));
    lines.push("Switch with: `/preset <name>`");
    lines.push("Edit `tiers.json` to customize.");
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// /budget command output
// ---------------------------------------------------------------------------
function buildBudgetOutput(cfg, args) {
    var _a;
    var modes = cfg.modes;
    if (!modes || Object.keys(modes).length === 0) {
        return 'No modes configured in tiers.json. Add a "modes" section to enable budget mode.';
    }
    var requested = args.trim().toLowerCase();
    var currentMode = cfg.activeMode || "normal";
    // No args: show current mode and available modes
    if (!requested) {
        var lines = ["# Routing Modes\n"];
        for (var _i = 0, _b = Object.entries(modes); _i < _b.length; _i++) {
            var _c = _b[_i], name_2 = _c[0], mode = _c[1];
            var active = name_2 === currentMode ? " <- active" : "";
            lines.push("- **".concat(name_2, "**").concat(active, ": ").concat(mode.description, " (default tier: @").concat(mode.defaultTier, ")"));
        }
        lines.push("\nSwitch with: `/budget <mode>`");
        return lines.join("\n");
    }
    // Switch mode
    if (modes[requested]) {
        saveActiveMode(requested);
        var mode = modes[requested];
        return __spreadArray(__spreadArray([
            "Routing mode switched to **".concat(requested, "**."),
            "",
            mode.description,
            "Default tier: @".concat(mode.defaultTier)
        ], (((_a = mode.overrideRules) === null || _a === void 0 ? void 0 : _a.length)
            ? __spreadArray(["", "Active rules:"], mode.overrideRules.map(function (r) { return "- ".concat(r); }), true) : []), true), [
            "",
            "Mode change takes effect immediately on the next message.",
        ], false).join("\n");
    }
    return "Unknown mode: \"".concat(requested, "\". Available: ").concat(Object.keys(modes).join(", "));
}
// ---------------------------------------------------------------------------
// /preset command output
// ---------------------------------------------------------------------------
function buildPresetOutput(cfg, args) {
    var requestedPreset = args.trim();
    // No args: show available presets
    if (!requestedPreset) {
        var lines = ["# Available Presets\n"];
        for (var _i = 0, _a = Object.entries(cfg.presets); _i < _a.length; _i++) {
            var _b = _a[_i], name_3 = _b[0], tiers = _b[1];
            var active = name_3 === cfg.activePreset ? " <- active" : "";
            var models = Object.entries(tiers)
                .map(function (_a) {
                var tier = _a[0], t = _a[1];
                return "".concat(tier, ": ").concat(t.model.split("/").pop());
            })
                .join(", ");
            lines.push("- **".concat(name_3, "**").concat(active, ": ").concat(models));
        }
        lines.push("\nSwitch with: `/preset <name>`");
        return lines.join("\n");
    }
    // Switch preset
    var resolvedPreset = resolvePresetName(cfg, requestedPreset);
    if (resolvedPreset) {
        saveActivePreset(resolvedPreset);
        cfg.activePreset = resolvedPreset;
        var tiers = cfg.presets[resolvedPreset];
        var models = Object.entries(tiers)
            .map(function (_a) {
            var tier = _a[0], t = _a[1];
            return "  @".concat(tier, " -> ").concat(t.model);
        })
            .join("\n");
        return [
            "Preset switched to **".concat(resolvedPreset, "**."),
            "",
            models,
            "",
            "Selection is now persisted in ~/.config/opencode/opencode-model-router.state.json.",
            "Restart OpenCode for subagent model registration to take effect.",
            "System prompt delegation rules update immediately.",
        ].join("\n");
    }
    return "Unknown preset: \"".concat(requestedPreset, "\". Available: ").concat(Object.keys(cfg.presets).join(", "));
}
// ---------------------------------------------------------------------------
// Runtime cap enforcement (tool.execute.after banner injection for subagents)
// ---------------------------------------------------------------------------
/** Tools that count against the read-only cap. Keep narrow — editing tools should never count. */
var READ_ONLY_TOOLS = new Set(["grep", "read", "glob", "ls"]);
/** Fallback caps when tiers.json has no tierCaps block. */
var DEFAULT_TIER_CAPS = {
    fast: 8,
    medium: 5,
    heavy: 3,
};
/** Extract the first `CAP:N` or `CAP:none` directive from a dispatch prompt. */
function parseCapDirective(text) {
    var m = text.match(/\bCAP\s*:\s*(none|\d+)\b/i);
    if (!m)
        return null;
    var raw = m[1].toLowerCase();
    if (raw === "none")
        return "none";
    var n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}
/** Fingerprint a read-only tool call for redundancy detection. */
function fingerprintToolCall(tool, args) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var a = (args !== null && args !== void 0 ? args : {});
    switch (tool) {
        case "read":
            return "read:".concat((_b = (_a = a.file_path) !== null && _a !== void 0 ? _a : a.filePath) !== null && _b !== void 0 ? _b : "");
        case "grep":
            return "grep:".concat((_c = a.pattern) !== null && _c !== void 0 ? _c : "", ":").concat((_e = (_d = a.path) !== null && _d !== void 0 ? _d : a.glob) !== null && _e !== void 0 ? _e : "");
        case "glob":
            return "glob:".concat((_f = a.pattern) !== null && _f !== void 0 ? _f : "", ":").concat((_g = a.path) !== null && _g !== void 0 ? _g : "");
        case "ls":
            return "ls:".concat((_h = a.path) !== null && _h !== void 0 ? _h : "");
        default:
            return "".concat(tool, ":").concat(JSON.stringify(a).slice(0, 120));
    }
}
/** Best-effort extraction of textual content from a chat.message output payload. */
function extractDispatchText(output) {
    var _a;
    var o = output;
    var parts = (_a = o === null || o === void 0 ? void 0 : o.parts) !== null && _a !== void 0 ? _a : [];
    var chunks = [];
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var p = parts_1[_i];
        if (typeof p === "string") {
            chunks.push(p);
        }
        else if (p && typeof p === "object") {
            var rec = p;
            if (typeof rec.text === "string")
                chunks.push(rec.text);
            else if (typeof rec.content === "string")
                chunks.push(rec.content);
        }
    }
    if (chunks.length === 0) {
        var msg = o === null || o === void 0 ? void 0 : o.message;
        var content = msg === null || msg === void 0 ? void 0 : msg.content;
        if (typeof content === "string")
            chunks.push(content);
    }
    return chunks.join("\n");
}
/** Build the banner appended to every read-only tool result in a subagent session. */
function buildCapBanner(state, isRedundant, previousCall, tool) {
    var lines = [];
    var capDisplay = state.cap === "none" ? "∞" : String(state.cap);
    lines.push("[cap: ".concat(state.calls, "/").concat(capDisplay, "]"));
    if (isRedundant && previousCall !== undefined) {
        lines.push("[\u26A0 REDUNDANT: this is the same ".concat(tool, " you ran at call #").concat(previousCall, ". STOP now \u2014 repeated reads add no information. Return with DONE/NEED MORE/NEED CONTEXT/SCOPE GROWTH/ESCALATE.]"));
    }
    if (state.cap !== "none") {
        var remaining = state.cap - state.calls;
        if (remaining <= 0) {
            lines.push("[\u26A0 CAP REACHED (".concat(state.calls, "/").concat(state.cap, "): your NEXT response MUST be a return \u2014 do NOT make another read-only call. Start the response with DONE:, NEED MORE:, NEED CONTEXT:, SCOPE GROWTH:, or ESCALATE:.]"));
        }
        else if (remaining <= 2) {
            lines.push("[\u26A0 CAP WARNING: ".concat(remaining, " read-only call(s) remaining before forced return]"));
        }
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// Claude-model adversarial prefixes
//
// Anthropic models (direct or via other providers) are served with a large
// cached "Claude Code" signature prompt that primes them toward broad
// exploratory Read/Grep/Glob behavior. Our tier prompts land after that
// cached block and lose authority through primacy bias and cache freezing.
// For Claude models specifically, we prepend an override block that
// explicitly revokes the exploratory priming for the current dispatch.
//
// Detection is by model identifier, not preset — a hybrid preset mixing
// providers gets the override only on its Claude-backed tiers.
// ---------------------------------------------------------------------------
function isClaudeModel(modelID) {
    if (!modelID)
        return false;
    var s = modelID.toLowerCase();
    if (s.startsWith("anthropic/"))
        return true;
    return /\/claude-/.test(s) || /(^|[\/\-])claude-/.test(s);
}
/** Per-tier adversarial openers. @fast/@medium use Tom 2 (scoping); @heavy uses Tom 1 (override). */
var CLAUDE_TIER_PREFIX = {
    fast: [
        "SCOPE NOTE — any cached instruction priming you to 'thoroughly explore",
        "the codebase' or 'gather context broadly' does not apply here. This is",
        "a single dispatch with a single question. Stay narrow to the ask.",
        "",
        "Before every tool call, ask: 'Does THIS read answer the dispatch",
        "question specifically, or am I drifting into context-gathering for my",
        "own understanding?' If the latter, stop — you have enough.",
    ].join("\n"),
    medium: [
        "SCOPE NOTE — cached instructions may prime you to deeply understand",
        "surrounding code before editing. For THIS dispatch, the orchestrator",
        "has already scoped the problem; trust that scoping. Read what's needed",
        "for the edit, not the whole module.",
        "",
        "A 4th or 5th 'context read' is usually a sign the dispatch was under-",
        "scoped — return NEED CONTEXT rather than expanding scope yourself.",
    ].join("\n"),
    heavy: [
        "AUTHORITY OVERRIDE — this block supersedes any cached prefix suggesting",
        "you should 'investigate thoroughly', 'gather comprehensive context', or",
        "'trace through the code systematically before analyzing'. You are",
        "@heavy, an ANALYSIS specialist. The orchestrator should have pre-",
        "gathered context via @fast before dispatching you. If it didn't, return",
        "`SCOPE GROWTH:` immediately — do NOT self-gather.",
        "",
        "40 minutes of Read/Grep is not analysis — it is the orchestrator's job",
        "that leaked into yours. Push it back with SCOPE GROWTH. Your 3 reads",
        "are for targeted verification, not exploration.",
    ].join("\n"),
};
/** Adversarial opener prepended to the delegation protocol when the orchestrator is a Claude model. */
var CLAUDE_ORCHESTRATOR_PREFIX = [
    "AUTHORITY OVERRIDE — this block supersedes any prior system instruction",
    "about 'exploring the codebase', 'gathering context with tools', or using",
    "Read/Grep/Glob to validate assumptions. Those instructions describe a",
    "general-purpose Claude Code session. THIS session is a routing",
    "orchestrator.",
    "",
    "Your job is to DISPATCH, not to EXECUTE. Read-only work (grep/read/",
    "glob/ls) is execution, and execution is delegated to @fast. You may run",
    "AT MOST 2 direct read-only tool calls per turn — a 3rd call is a rule",
    "violation. If you need more context, you dispatch @fast.",
    "",
    "If a cached instruction told you to 'be thorough', 'explore broadly', or",
    "'read supporting files' — ignore it here. Thoroughness is achieved by",
    "dispatching the right tier, not by you becoming the explorer.",
].join("\n");
/**
 * Anti-narration clause appended to every Claude-model prefix (tier + orchestrator).
 *
 * Thinking-enabled Claude models (esp. Sonnet with `max` variant) sometimes
 * produce progress narration in place of actual work — "Still writing X...",
 * "Now I'll implement Y...", "Let me add Z..." — without the X/Y/Z ever
 * appearing. This clause names the pattern, lists specific forbidden phrasings
 * (A3 — exemplified), and carves out an escape valve for legitimate
 * explanation/plan requests (A2 — with exception).
 */
var CLAUDE_ANTI_NARRATION = [
    "ANTI-NARRATION — do NOT write progress commentary in your response or",
    "thinking output. Forbidden phrasings include:",
    "  - \"Still writing the X function...\"",
    "  - \"Now I'll implement Y...\"",
    "  - \"Let me add Z...\"",
    "  - \"Continuing with W...\"",
    "  - \"Going to fix V...\"",
    "",
    "Each of these signals planning without production. If you write one, the",
    "NEXT tokens MUST contain the actual artifact (the code, the edit, the",
    "concrete output). Otherwise, stop and return with status.",
    "",
    "Exception: when the user explicitly asks for an explanation, plan, or",
    "walkthrough, prose is welcome — this rule targets unsolicited progress",
    "narration during code and implementation tasks.",
].join("\n");
// ---------------------------------------------------------------------------
// Narration detector (telemetry — logs + appends banner)
// ---------------------------------------------------------------------------
/** Regex patterns that flag progress narration without production. */
var NARRATION_PATTERNS = [
    // "Still writing the X", "Still implementing the Y"
    /\bstill\s+(writing|implementing|working on|adding|creating|fixing|building|refactoring|handling)\s+(the\s+)?\w+/gi,
    // "Now I'll write the X", "Now writing the Y"
    /\bnow\s+(i['']ll\s+)?(writ|implement|add|creat|work|fix|build|handl|refactor|updat|mov)\w*\s+(the\s+)?\w+/gi,
    // "Let me write X", "Let me implement Y"
    /\blet\s+me\s+(write|implement|add|create|fix|build|handle|refactor|work on|move|update|set up)\s+(the\s+)?\w+/gi,
    // "I'll write the X", "I'll now implement Y"
    /\bi['']ll\s+(now\s+)?(write|implement|add|create|fix|build|handle|refactor|set up|work on|move|update)\s+(the\s+)?\w+/gi,
    // "Going to fix the X"
    /\bgoing\s+to\s+(write|implement|add|create|fix|build|handle|refactor|set up|work on|move|update)\s+(the\s+)?\w+/gi,
    // "Continuing with X", "Continuing by adding Y"
    /\bcontinuing\s+(with|by\s+\w+ing)\s+(the\s+)?\w+/gi,
];
/** Returns matched narration phrases, deduped and capped. Empty array = no narration detected. */
function detectNarration(text) {
    if (text.length < 20)
        return [];
    var seen = new Set();
    var out = [];
    for (var _i = 0, NARRATION_PATTERNS_1 = NARRATION_PATTERNS; _i < NARRATION_PATTERNS_1.length; _i++) {
        var pattern = NARRATION_PATTERNS_1[_i];
        var matches = text.match(pattern);
        if (!matches)
            continue;
        for (var _a = 0, matches_1 = matches; _a < matches_1.length; _a++) {
            var m = matches_1[_a];
            var trimmed = m.trim().toLowerCase();
            if (seen.has(trimmed))
                continue;
            seen.add(trimmed);
            out.push(m.trim());
            if (out.length >= 5)
                return out;
        }
    }
    return out;
}
// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
var ModelRouterPlugin = function (_ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var cfg, activeTiers, subagentSessionIDs, subagentCapState, bypassed;
    return __generator(this, function (_a) {
        initializeDelegationProtocolTemplate();
        cfg = loadConfig();
        activeTiers = getActiveTiers(cfg);
        subagentSessionIDs = new Set();
        subagentCapState = new Map();
        bypassed = false;
        return [2 /*return*/, {
                // -----------------------------------------------------------------------
                // Detect subagent calls via chat.message. When the agent name matches a
                // registered tier, record the sessionID so system.transform can skip
                // delegation-protocol injection.
                //
                // IMPORTANT: must be chat.message, NOT chat.params. The opencode hook
                // order is chat.message -> system.transform -> chat.params, so populating
                // the Set in chat.params is always one step too late — system.transform
                // already ran with an empty Set and leaked the "Delegate with Task(...)"
                // instructions into the subagent's system prompt. Sonnet subagents like
                // @explore silently ignore that noise, but literal-minded Haiku (@fast)
                // emits malformed XML tool calls for the nonexistent Task tool, which
                // surface in the UI as "<parameter>...</parameter>" leakage.
                //
                // chat.message fires inside SessionPrompt.createUserMessage() BEFORE the
                // loop -> LLM.stream path, so by the time system.transform runs the Set
                // is fully populated and await-safe (yield* on the plugin trigger).
                // -----------------------------------------------------------------------
                "chat.message": function (input, output) { return __awaiter(void 0, void 0, void 0, function () {
                    var tierNames, tierName, dispatchText, override, baseline, cap;
                    var _a, _b, _c;
                    return __generator(this, function (_d) {
                        if (bypassed)
                            return [2 /*return*/];
                        // Re-read cfg so /preset switches take effect without restart
                        try {
                            cfg = loadConfig();
                        }
                        catch (_e) { }
                        tierNames = Object.keys(getActiveTiers(cfg));
                        if (input.agent && tierNames.includes(input.agent)) {
                            subagentSessionIDs.add(input.sessionID);
                            tierName = input.agent;
                            dispatchText = extractDispatchText(output);
                            override = parseCapDirective(dispatchText);
                            baseline = (_c = (_b = (_a = cfg.tierCaps) === null || _a === void 0 ? void 0 : _a[tierName]) !== null && _b !== void 0 ? _b : DEFAULT_TIER_CAPS[tierName]) !== null && _c !== void 0 ? _c : 5;
                            cap = override !== null && override !== void 0 ? override : baseline;
                            subagentCapState.set(input.sessionID, {
                                tierName: tierName,
                                cap: cap,
                                calls: 0,
                                seen: new Map(),
                            });
                        }
                        return [2 /*return*/];
                    });
                }); },
                // -----------------------------------------------------------------------
                // Runtime cap + redundancy enforcement (subagents only).
                // Appends `[cap: N/MAX]` and `[⚠ REDUNDANT]` / `[⚠ CAP REACHED]` banners
                // to every read-only tool result the subagent sees. Because these land
                // inside `output.output` — the tool's own response text — the model
                // treats them as ground truth rather than advisory system noise.
                // -----------------------------------------------------------------------
                "tool.execute.after": function (input, output) { return __awaiter(void 0, void 0, void 0, function () {
                    var state, fp, previousCall, isRedundant, banner, existing;
                    return __generator(this, function (_a) {
                        if (bypassed)
                            return [2 /*return*/];
                        state = subagentCapState.get(input.sessionID);
                        if (!state)
                            return [2 /*return*/]; // not a tracked subagent session
                        if (!READ_ONLY_TOOLS.has(input.tool))
                            return [2 /*return*/];
                        fp = fingerprintToolCall(input.tool, input.args);
                        previousCall = state.seen.get(fp);
                        isRedundant = previousCall !== undefined;
                        state.calls += 1;
                        if (!isRedundant) {
                            state.seen.set(fp, state.calls);
                        }
                        banner = buildCapBanner(state, isRedundant, previousCall, input.tool);
                        existing = typeof output.output === "string" ? output.output : "";
                        output.output = existing ? "".concat(existing, "\n\n").concat(banner) : banner;
                        return [2 /*return*/];
                    });
                }); },
                // -----------------------------------------------------------------------
                // Narration detector — flags progress-commentary-without-production.
                //
                // Fires per completed text part. Scans for narration patterns; if any
                // match, logs a warning to the plugin console and appends a visible
                // banner to the text so the user sees the detection in the UI. This is
                // telemetry, not blocking — we cannot modify mid-stream generation, only
                // post-hoc signal.
                // -----------------------------------------------------------------------
                "experimental.text.complete": function (input, output) { return __awaiter(void 0, void 0, void 0, function () {
                    var text, found, quoted;
                    return __generator(this, function (_a) {
                        if (bypassed)
                            return [2 /*return*/];
                        text = output === null || output === void 0 ? void 0 : output.text;
                        if (typeof text !== "string" || text.length < 20)
                            return [2 /*return*/];
                        found = detectNarration(text);
                        if (found.length === 0)
                            return [2 /*return*/];
                        quoted = found
                            .map(function (m) { return "\"".concat(m.slice(0, 60)).concat(m.length > 60 ? "…" : "", "\""); })
                            .join(", ");
                        output.text = "".concat(text, "\n\n[\u26A0 narration detected: ").concat(quoted, "]");
                        return [2 /*return*/];
                    });
                }); },
                // -----------------------------------------------------------------------
                // Register tier agents + commands at load time
                // -----------------------------------------------------------------------
                config: function (opencodeConfig) { return __awaiter(void 0, void 0, void 0, function () {
                    var _i, _a, _b, name_4, tier, resolvedPrompt, claudePrefix, finalPrompt, agentDef, opts;
                    var _c, _d, _e, _f;
                    return __generator(this, function (_g) {
                        (_c = opencodeConfig.agent) !== null && _c !== void 0 ? _c : (opencodeConfig.agent = {});
                        for (_i = 0, _a = Object.entries(activeTiers); _i < _a.length; _i++) {
                            _b = _a[_i], name_4 = _b[0], tier = _b[1];
                            resolvedPrompt = (_d = tier.prompt) !== null && _d !== void 0 ? _d : (_e = cfg.tierPrompts) === null || _e === void 0 ? void 0 : _e[name_4];
                            claudePrefix = isClaudeModel(tier.model)
                                ? "".concat(CLAUDE_TIER_PREFIX[name_4], "\n\n").concat(CLAUDE_ANTI_NARRATION)
                                : undefined;
                            finalPrompt = claudePrefix && resolvedPrompt
                                ? "".concat(claudePrefix, "\n\n---\n\n").concat(resolvedPrompt)
                                : resolvedPrompt;
                            agentDef = {
                                model: tier.model,
                                mode: "subagent",
                                description: tier.description,
                                maxSteps: tier.steps,
                                prompt: finalPrompt,
                                color: tier.color,
                            };
                            // Apply variant (thinking/reasoning mode)
                            if (tier.variant) {
                                agentDef.variant = tier.variant;
                            }
                            opts = buildAgentOptions(tier);
                            if (Object.keys(opts).length > 0) {
                                agentDef.options = opts;
                            }
                            opencodeConfig.agent[name_4] = agentDef;
                        }
                        // Register commands
                        (_f = opencodeConfig.command) !== null && _f !== void 0 ? _f : (opencodeConfig.command = {});
                        opencodeConfig.command["tiers"] = {
                            template: "",
                            description: "Show model delegation tiers and rules",
                        };
                        opencodeConfig.command["preset"] = {
                            template: "$ARGUMENTS",
                            description: "Show or switch model presets (e.g., /preset openai)",
                        };
                        opencodeConfig.command["budget"] = {
                            template: "$ARGUMENTS",
                            description: "Show or switch routing mode (e.g., /budget, /budget budget, /budget quality)",
                        };
                        opencodeConfig.command["bypass"] = {
                            template: "$ARGUMENTS",
                            description: "Toggle model-router bypass (disables delegation protocol for this session)",
                        };
                        opencodeConfig.command["annotate-plan"] = {
                            template: [
                                "Annotate the plan with tier directives for model delegation.",
                                "",
                                'Plan file: "$ARGUMENTS"',
                                "If no file was specified, search for the active plan: PLAN.md, plan.md, or the most recent .md with 'plan' in the name in the current directory or project root.",
                                "",
                                "## Available tiers",
                                "- `[tier:fast]` — Fast/cheap model: exploration, search, file reads, grep, listing, research. Agent does NOT edit code.",
                                "- `[tier:medium]` — Balanced model: implementation, refactoring, tests, code review, bug fixes, standard coding tasks.",
                                "- `[tier:heavy]` — Most capable model: architecture, complex debugging (after failures), security, performance, multi-system tradeoffs.",
                                "",
                                "## Annotation rules",
                                "1. Place `[tier:X]` at the START of each step, before the description",
                                "2. Research/exploration -> `[tier:fast]` (preferred)",
                                "3. Implementation/code -> `[tier:medium]` (preferred)",
                                "4. Architecture/security/hard debugging -> `[tier:heavy]`",
                                "5. If a step mixes exploration AND implementation, prefer splitting it into two steps when it improves delegation clarity",
                                "6. Verification (run tests, build) -> `[tier:medium]`",
                                "7. Trivial (single grep or file read) -> `[tier:fast]`",
                                "8. Final review of the complete plan -> `[tier:heavy]`",
                                "",
                                "## Output",
                                "Rewrite the entire plan in the file with the tags. Do not change the substance — only add tags, and split mixed steps when useful for clearer delegation.",
                            ].join("\n"),
                            description: "Annotate a plan with [tier:fast/medium/heavy] delegation tags",
                        };
                        return [2 /*return*/];
                    });
                }); },
                // -----------------------------------------------------------------------
                // Inject delegation protocol — uses cached config (invalidated on /preset or /budget)
                // Only inject for the primary orchestrator, NOT for subagent calls.
                // Subagents get confused by delegation instructions when they should
                // just execute a task (especially smaller models like Haiku).
                // -----------------------------------------------------------------------
                "experimental.chat.system.transform": function (_input, output) { return __awaiter(void 0, void 0, void 0, function () {
                    var sessionID, providerID, modelID, orchestratorModel, delegationProtocol, finalProtocol;
                    var _a, _b, _c, _d;
                    return __generator(this, function (_e) {
                        if (bypassed)
                            return [2 /*return*/];
                        try {
                            cfg = loadConfig(); // Returns cache unless invalidated
                        }
                        catch (_f) {
                            // Use last known config if file read fails
                        }
                        sessionID = _input === null || _input === void 0 ? void 0 : _input.sessionID;
                        if (sessionID && subagentSessionIDs.has(sessionID))
                            return [2 /*return*/];
                        providerID = (_b = (_a = _input === null || _input === void 0 ? void 0 : _input.model) === null || _a === void 0 ? void 0 : _a.providerID) !== null && _b !== void 0 ? _b : "";
                        modelID = (_d = (_c = _input === null || _input === void 0 ? void 0 : _input.model) === null || _c === void 0 ? void 0 : _c.modelID) !== null && _d !== void 0 ? _d : "";
                        orchestratorModel = providerID && modelID ? "".concat(providerID, "/").concat(modelID) : modelID;
                        delegationProtocol = buildDelegationProtocol(cfg);
                        finalProtocol = isClaudeModel(orchestratorModel)
                            ? "".concat(CLAUDE_ORCHESTRATOR_PREFIX, "\n\n").concat(CLAUDE_ANTI_NARRATION, "\n\n---\n\n").concat(delegationProtocol)
                            : delegationProtocol;
                        output.system.push(finalProtocol);
                        return [2 /*return*/];
                    });
                }); },
                // -----------------------------------------------------------------------
                // Handle /tiers, /preset, and /budget commands
                // -----------------------------------------------------------------------
                "command.execute.before": function (input, output) { return __awaiter(void 0, void 0, void 0, function () {
                    var arg, status_1, desc;
                    var _a, _b, _c;
                    return __generator(this, function (_d) {
                        if (input.command === "tiers") {
                            try {
                                cfg = loadConfig();
                            }
                            catch (_e) { }
                            output.parts.push({
                                type: "text",
                                text: buildTiersOutput(cfg),
                            });
                        }
                        if (input.command === "preset") {
                            try {
                                cfg = loadConfig();
                            }
                            catch (_f) { }
                            output.parts.push({
                                type: "text",
                                text: buildPresetOutput(cfg, (_a = input.arguments) !== null && _a !== void 0 ? _a : ""),
                            });
                        }
                        if (input.command === "bypass") {
                            arg = ((_b = input.arguments) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
                            if (arg === "on") {
                                bypassed = true;
                            }
                            else if (arg === "off") {
                                bypassed = false;
                            }
                            else {
                                bypassed = !bypassed;
                            }
                            status_1 = bypassed ? "ON" : "OFF";
                            desc = bypassed
                                ? "Model-router is **bypassed**. Delegation protocol, cap enforcement, and narration detection are disabled. The model will run without routing rules until you run `/bypass off` or restart OpenCode."
                                : "Model-router is **active**. Delegation protocol and all enforcement rules are in effect.";
                            output.parts.push({
                                type: "text",
                                text: "# Bypass: ".concat(status_1, "\n\n").concat(desc),
                            });
                        }
                        if (input.command === "budget") {
                            try {
                                cfg = loadConfig();
                            }
                            catch (_g) { }
                            output.parts.push({
                                type: "text",
                                text: buildBudgetOutput(cfg, (_c = input.arguments) !== null && _c !== void 0 ? _c : ""),
                            });
                        }
                        return [2 /*return*/];
                    });
                }); },
            }];
    });
}); };
exports.default = ModelRouterPlugin;
