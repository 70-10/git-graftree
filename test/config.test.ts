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
      include: []
    });
  });

  it("should load local config from .graftreerc", async () => {
    const localConfig = {
      mode: "symlink" as const,
      include: [".env", ".env.local"]
    };
    
    writeFileSync(".graftreerc", JSON.stringify(localConfig));
    
    const config = await loadConfig();
    
    expect(config).toEqual(localConfig);
  });

  it("should merge global and local configs with local taking precedence", async () => {
    const globalConfig = {
      mode: "copy" as const,
      include: [".env", "config.json"],
      exclude: ["node_modules"]
    };
    
    const localConfig = {
      mode: "symlink" as const,
      include: [".env.local"]
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
        include: [".env.local"], // local overrides global
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
      include: []
    });
  });

  it("should append CLI arguments to config", async () => {
    const localConfig = {
      mode: "copy",
      include: [".env", "config.json"],
      exclude: ["node_modules"]
    };
    
    writeFileSync(".graftreerc", JSON.stringify(localConfig));
    
    const cliArgs = {
      include: [".env.local", ".env.test"],
      exclude: ["*.log"]
    };
    
    const config = await loadConfig(cliArgs);
    
    expect(config).toEqual({
      mode: "copy",
      include: [".env", "config.json", ".env.local", ".env.test"], // CLI args appended to config
      exclude: ["node_modules", "*.log"] // CLI args appended to config
    });
  });

  it("should use config file when no CLI arguments provided", async () => {
    const localConfig = {
      mode: "symlink",
      include: [".env", "config.json"]
    };
    
    writeFileSync(".graftreerc", JSON.stringify(localConfig));
    
    const config = await loadConfig();
    
    expect(config).toEqual(localConfig);
  });

  it("should append CLI arguments with config when partial CLI args provided", async () => {
    const localConfig = {
      mode: "copy",
      include: [".env", "config.json"],
      exclude: ["node_modules"]
    };
    
    writeFileSync(".graftreerc", JSON.stringify(localConfig));
    
    const cliArgs = {
      include: [".env.local"] // Only include provided
    };
    
    const config = await loadConfig(cliArgs);
    
    expect(config).toEqual({
      mode: "copy",
      include: [".env", "config.json", ".env.local"], // CLI args appended to config
      exclude: ["node_modules"] // Config value preserved
    });
  });

  it("should handle config with missing mode field", async () => {
    const incompleteConfig = {
      include: [".env"]
      // mode field missing
    };
    
    writeFileSync(".graftreerc", JSON.stringify(incompleteConfig));
    
    const config = await loadConfig();
    
    expect(config).toEqual({
      mode: "copy", // Should use default
      include: [".env"]
    });
  });

  it("should handle config with invalid mode value", async () => {
    const invalidConfig = {
      mode: "invalid-mode",
      include: [".env"]
    };
    
    writeFileSync(".graftreerc", JSON.stringify(invalidConfig));
    
    const config = await loadConfig();
    
    // Current implementation preserves invalid values (no validation)
    expect(config).toEqual({
      mode: "invalid-mode", // Preserved as-is
      include: [".env"]
    });
  });

  it("should handle empty config file", async () => {
    writeFileSync(".graftreerc", "{}");
    
    const config = await loadConfig();
    
    expect(config).toEqual({
      mode: "copy", // Default mode
      include: [] // Default include
    });
  });

  it("should handle config with non-array include field", async () => {
    const invalidConfig = {
      mode: "copy",
      include: ".env" // Should be array
    };
    
    writeFileSync(".graftreerc", JSON.stringify(invalidConfig));
    
    const config = await loadConfig();
    
    // Current implementation preserves non-array values (no validation)
    expect(config).toEqual({
      mode: "copy",
      include: ".env" // Preserved as-is
    });
  });

  it("should preserve unknown fields in config", async () => {
    const configWithExtra = {
      mode: "copy",
      include: [".env"],
      customField: "custom-value"
    };
    
    writeFileSync(".graftreerc", JSON.stringify(configWithExtra));
    
    const config = await loadConfig();
    
    expect(config).toEqual({
      mode: "copy",
      include: [".env"],
      customField: "custom-value"
    });
  });
});