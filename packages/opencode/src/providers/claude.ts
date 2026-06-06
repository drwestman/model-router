// ---------------------------------------------------------------------------
// Claude-model adversarial prefixes
//
// Claude models (direct or proxied through another provider) are often served
// with a large cached signature prompt that biases them toward broad
// reconnaissance. These provider-level helpers prepend a scoped override for
// Claude-backed tiers and orchestrators while leaving non-Claude models alone.
// ---------------------------------------------------------------------------

/** Detect Claude by model identifier, independent of preset or provider. */
export function isClaudeModel(modelID: string | undefined): boolean {
  if (!modelID) return false;
  const s = modelID.toLowerCase();
  if (s.startsWith("anthropic/")) return true;
  return /(^|[\/\.\-])claude-/.test(s);
}

/** Per-tier adversarial openers. @fast/@medium use Tom 2 (scoping); @heavy uses Tom 1 (override). */
const CLAUDE_TIER_PREFIX: Record<string, string> = {
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
const CLAUDE_ORCHESTRATOR_PREFIX = [
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

/** Anti-narration clause appended to every Claude-model prefix (tier + orchestrator). */
const CLAUDE_ANTI_NARRATION = [
  "ANTI-NARRATION — do NOT write progress commentary in your response or",
  "thinking output. Forbidden phrasings include:",
  '  - "Still writing the X function..."',
  '  - "Now I\'ll implement Y..."',
  '  - "Let me add Z..."',
  '  - "Continuing with W..."',
  '  - "Going to fix V..."',
  "",
  "Each of these signals planning without production. If you write one, the",
  "NEXT tokens MUST contain the actual artifact (the code, the edit, the",
  "concrete output). Otherwise, stop and return with status.",
  "",
  "Exception: when the user explicitly asks for an explanation, plan, or",
  "walkthrough, prose is welcome — this rule targets unsolicited progress",
  "narration during code and implementation tasks.",
].join("\n");

export function buildClaudeTierPromptPrefix(
  tierName: string,
  model: string,
): string | undefined {
  if (!isClaudeModel(model)) return undefined;
  return [CLAUDE_TIER_PREFIX[tierName], CLAUDE_ANTI_NARRATION]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export function buildClaudeOrchestratorPromptPrefix(
  model: string,
): string | undefined {
  if (!isClaudeModel(model)) return undefined;
  return `${CLAUDE_ORCHESTRATOR_PREFIX}\n\n${CLAUDE_ANTI_NARRATION}`;
}
