import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { loadConfig } from "../src/config";

describe("Config", () => {
  const testDir = path.join(os.tmpdir(), "graftree-test-" + Date.now());
  const originalCwd = process.cwd();
  
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });
  
  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("should return default config when no config files exist", async () => {
    const config = await loadConfig();
    
    expect(config).toEqual({
      mode: "copy",
      paths: [".env"]
    });
  });

  it("should load local config from .graftreerc", async () => {
    const localConfig = {
      mode: "symlink",
      paths: [".env", ".env.local"]
    };
    
    writeFileSync(".graftreerc", JSON.stringify(localConfig));
    
    const config = await loadConfig();
    
    expect(config).toEqual(localConfig);
  });

  it("should merge global and local configs with local taking precedence", async () => {
    const globalConfig = {
      mode: "copy",
      paths: [".env", "config.json"],
      exclude: ["node_modules"]
    };
    
    const localConfig = {
      mode: "symlink",
      paths: [".env.local"]
    };
    
    // Create mock global config
    const globalConfigPath = path.join(os.homedir(), ".graftreerc");
    const hasExistingGlobalConfig = existsSync(globalConfigPath);
    let existingGlobalContent = "";
    
    if (hasExistingGlobalConfig) {
      existingGlobalContent = require("fs").readFileSync(globalConfigPath, "utf-8");
    }
    
    try {
      writeFileSync(globalConfigPath, JSON.stringify(globalConfig));
      writeFileSync(".graftreerc", JSON.stringify(localConfig));
      
      const config = await loadConfig();
      
      expect(config).toEqual({
        mode: "symlink", // local overrides global
        paths: [".env.local"], // local overrides global
        exclude: ["node_modules"] // global value preserved
      });
    } finally {
      // Restore original global config or remove test config
      if (hasExistingGlobalConfig) {
        writeFileSync(globalConfigPath, existingGlobalContent);
      } else if (existsSync(globalConfigPath)) {
        rmSync(globalConfigPath);
      }
    }
  });

  it("should handle invalid JSON gracefully", async () => {
    writeFileSync(".graftreerc", "invalid json");
    
    const config = await loadConfig();
    
    // Should fall back to default config
    expect(config).toEqual({
      mode: "copy",
      paths: [".env"]
    });
  });
});