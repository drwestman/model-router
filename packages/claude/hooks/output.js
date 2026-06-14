function emit(text, event = "UserPromptSubmit") {
  if (!text) {
    return;
  }

  if (process.env.PLUGIN_DATA) {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event,
          additionalContext: text,
        },
      })}\n`,
    );
    return;
  }

  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

module.exports = {
  emit,
};
