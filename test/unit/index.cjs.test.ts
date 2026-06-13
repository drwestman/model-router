import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("index.cjs skips built-in function properties when copying CommonJS exports", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "model-router-index-cjs-"));

  try {
    writeFileSync(
      join(tempDir, "index.bundle.cjs"),
      `"use strict";
function plugin() {
  return "ok";
}
module.exports = { default: plugin, helper: "value", name: "bad", length: 99 };
`,
      "utf8",
    );
    writeFileSync(
      join(tempDir, "index.cjs"),
      readFileSync("packages/opencode/src/index.cjs", "utf8"),
      "utf8",
    );

    const exported = require(join(tempDir, "index.cjs"));

    assert.equal(typeof exported, "function");
    assert.equal(exported(), "ok");
    assert.equal(exported.helper, "value");
    assert.equal(exported.name, "plugin");
    assert.equal(exported.length, 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
