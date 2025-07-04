import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execa } from "execa";

describe("integration", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "graftree-integration-"));
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Module integration", () => {
    it("should load and use config correctly", async () => {
      // Change to temp directory
      process.chdir(tempDir);
      
      // Create config file
      await writeFile(join(tempDir, ".graftreerc"), JSON.stringify({
        mode: "copy",
        include: [".env", "config.json"],
        exclude: ["secret.json"]
      }));

      // Test config loading
      const { loadConfig } = await import("../src/config");
      const config = await loadConfig();
      
      expect(config.mode).toBe("copy");
      expect(config.include).toEqual([".env", "config.json"]);
      expect(config.exclude).toEqual(["secret.json"]);
    });

    it("should integrate pattern matching with file operations", async () => {
      // Change to temp directory
      process.chdir(tempDir);
      
      // Create test files
      await writeFile(join(tempDir, ".env"), "NODE_ENV=test");
      await writeFile(join(tempDir, "config.json"), '{"test": true}');
      await writeFile(join(tempDir, "secret.json"), '{"secret": true}');

      // Test the integration
      const { expandGlobPatterns, filterPaths } = await import("../src/pattern-matching");
      const { processPath } = await import("../src/file-operations");
      
      // Expand patterns
      const expandedPaths = await expandGlobPatterns([".env", "*.json"], tempDir);
      expect(expandedPaths).toContain(".env");
      expect(expandedPaths).toContain("config.json");
      expect(expandedPaths).toContain("secret.json");
      
      // Filter paths
      const filteredPaths = await filterPaths(expandedPaths, ["secret.json"]);
      expect(filteredPaths).toContain(".env");
      expect(filteredPaths).toContain("config.json");
      expect(filteredPaths).not.toContain("secret.json");
      
      // Process paths (copy to a subdirectory)
      const targetDir = join(tempDir, "target");
      await mkdir(targetDir);
      
      for (const filePath of filteredPaths) {
        await processPath(filePath, tempDir, targetDir, false);
      }
      
      // Verify results
      const { existsSync } = await import("fs");
      expect(existsSync(join(targetDir, ".env"))).toBe(true);
      expect(existsSync(join(targetDir, "config.json"))).toBe(true);
      expect(existsSync(join(targetDir, "secret.json"))).toBe(false);
    });

    it("should handle git exclude operations", async () => {
      // Change to temp directory and initialize git
      process.chdir(tempDir);
      await execa("git", ["init"]);

      const { addToGitExclude } = await import("../src/git-exclude");
      
      // Add patterns to git exclude
      await addToGitExclude([".env", "config.json"]);
      
      // Verify exclude file was created
      const { existsSync } = await import("fs");
      const { readFile } = await import("fs/promises");
      
      const excludeFile = join(tempDir, ".git", "info", "exclude");
      expect(existsSync(excludeFile)).toBe(true);
      
      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain(".env");
      expect(content).toContain("config.json");
      expect(content).toContain("# Added by git-graftree");
    });
  });
});