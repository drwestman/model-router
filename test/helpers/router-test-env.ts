import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface TestRouterEnv {
  rootDir: string;
  configPath: string;
  statePath: string;
  cleanup: () => void;
}

export interface FixtureState {
  activePreset?: string;
  activeMode?: string;
}

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const fixturePath = join(repoRoot, "test", "fixtures", "tiers.fixture.json");

export function loadFixtureConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, "utf-8")) as Record<string, unknown>;
}

export function readJSONFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

export function createRouterTestEnv(state: FixtureState = {}): TestRouterEnv {
  const tmpRoot = join(repoRoot, "tmp");
  mkdirSync(tmpRoot, { recursive: true });

  const rootDir = mkdtempSync(join(tmpRoot, "router-tests-"));
  const configPath = join(rootDir, "tiers.json");
  const statePath = join(rootDir, "opencode-model-router.state.json");

  copyFileSync(fixturePath, configPath);

  if (state.activePreset || state.activeMode) {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  }

  const previousConfigPath = process.env.OPENCODE_MODEL_ROUTER_CONFIG_PATH;
  const previousStatePath = process.env.OPENCODE_MODEL_ROUTER_STATE_PATH;

  process.env.OPENCODE_MODEL_ROUTER_CONFIG_PATH = configPath;
  process.env.OPENCODE_MODEL_ROUTER_STATE_PATH = statePath;

  return {
    rootDir,
    configPath,
    statePath,
    cleanup: () => {
      if (previousConfigPath === undefined) {
        delete process.env.OPENCODE_MODEL_ROUTER_CONFIG_PATH;
      } else {
        process.env.OPENCODE_MODEL_ROUTER_CONFIG_PATH = previousConfigPath;
      }

      if (previousStatePath === undefined) {
        delete process.env.OPENCODE_MODEL_ROUTER_STATE_PATH;
      } else {
        process.env.OPENCODE_MODEL_ROUTER_STATE_PATH = previousStatePath;
      }

      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}
