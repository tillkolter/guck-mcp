import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadConfig, resolveStoreDir } from "../../guck-core/dist/config.js";

const CONFIG_FILENAME = ".guck.json";

const writeConfig = (configPath, config) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

test("loadConfig accepts a directory config_path", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-config-dir-"));
  const configPath = path.join(tempDir, CONFIG_FILENAME);
  writeConfig(configPath, {});

  const { rootDir, config } = loadConfig({ configPath: tempDir });
  assert.equal(rootDir, tempDir);
  assert.equal(resolveStoreDir(config, rootDir), path.join(os.homedir(), ".guck", "logs"));
});

test("loadConfig resolves relative config_path against cwd", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-config-cwd-"));
  const configDir = path.join(tempDir, "config");
  fs.mkdirSync(configDir);
  const configPath = path.join(configDir, CONFIG_FILENAME);
  writeConfig(configPath, {});

  const { rootDir, config } = loadConfig({
    cwd: tempDir,
    configPath: path.join("config", CONFIG_FILENAME),
  });
  assert.equal(rootDir, configDir);
  assert.equal(resolveStoreDir(config, rootDir), path.join(os.homedir(), ".guck", "logs"));
});

test("loadConfig merges .guck.local.json on top of .guck.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-config-local-"));
  const configPath = path.join(tempDir, ".guck.json");
  const localConfigPath = path.join(tempDir, ".guck.local.json");
  writeConfig(configPath, { default_service: "base" });
  writeConfig(localConfigPath, { default_service: "local" });

  const { rootDir, config, localConfigPath: resolvedLocalPath } = loadConfig({
    configPath: tempDir,
  });
  assert.equal(rootDir, tempDir);
  assert.equal(config.default_service, "local");
  assert.equal(resolvedLocalPath, localConfigPath);
});

test("env overrides win over .guck.local.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-config-env-"));
  const configPath = path.join(tempDir, ".guck.json");
  const localConfigPath = path.join(tempDir, ".guck.local.json");
  writeConfig(configPath, {});
  writeConfig(localConfigPath, { enabled: true });

  const prevEnabled = process.env.GUCK_ENABLED;
  process.env.GUCK_ENABLED = "false";
  try {
    const { config } = loadConfig({ configPath: tempDir });
    assert.equal(config.enabled, false);
  } finally {
    if (prevEnabled === undefined) {
      delete process.env.GUCK_ENABLED;
    } else {
      process.env.GUCK_ENABLED = prevEnabled;
    }
  }
});
