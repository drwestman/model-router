const additionalContext = "[model-router-codex] Routing guidance is available via the model-router-routing skill. Codex app integration remains deferred.";

process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  })}\n`,
);
