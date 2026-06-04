import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

const rootDir = process.cwd();
const sourcePath = join(rootDir, "src", "index.ts");
const outputPath = join(rootDir, "src", "index.js");

const source = readFileSync(sourcePath, "utf8");

const result = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    sourceMap: false,
    removeComments: false,
  },
});

writeFileSync(outputPath, result.outputText, "utf8");
