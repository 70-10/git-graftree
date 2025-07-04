import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { expandGlobPatterns, isExcluded, filterPaths } from "../src/pattern-matching";

describe("pattern-matching", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "graftree-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("expandGlobPatterns", () => {
    it("should handle simple file paths without wildcards", async () => {
      const patterns = [".env", "config.json"];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result).toEqual([".env", "config.json"]);
    });

    it("should expand glob patterns", async () => {
      // Create test files
      await writeFile(join(tempDir, ".env"), "test");
      await writeFile(join(tempDir, ".env.local"), "test");
      await writeFile(join(tempDir, "config.json"), "test");
      
      const patterns = [".env*"];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result).toContain(".env");
      expect(result).toContain(".env.local");
      expect(result).not.toContain("config.json");
    });

    it("should handle multiple patterns", async () => {
      // Create test files
      await writeFile(join(tempDir, ".env"), "test");
      await writeFile(join(tempDir, "config.json"), "test");
      await writeFile(join(tempDir, "package.json"), "test");
      
      const patterns = [".env", "*.json"];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result).toContain(".env");
      expect(result).toContain("config.json");
      expect(result).toContain("package.json");
    });

    it("should remove duplicates", async () => {
      await writeFile(join(tempDir, ".env"), "test");
      
      const patterns = [".env", ".env*"];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result.filter(p => p === ".env")).toHaveLength(1);
    });

    it("should handle nested directories", async () => {
      await mkdir(join(tempDir, "config"), { recursive: true });
      await writeFile(join(tempDir, "config", "app.json"), "test");
      
      const patterns = ["config/**/*.json"];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result).toContain("config/app.json");
    });

    it("should handle patterns with no matches", async () => {
      const patterns = ["*.nonexistent"];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result).toEqual([]);
    });

    it("should handle empty patterns array", async () => {
      const patterns: string[] = [];
      const result = await expandGlobPatterns(patterns, tempDir);
      expect(result).toEqual([]);
    });
  });

  describe("isExcluded", () => {
    it("should exclude exact matches", () => {
      const excludePatterns = ["node_modules", ".git"];
      expect(isExcluded("node_modules", excludePatterns)).toBe(true);
      expect(isExcluded(".git", excludePatterns)).toBe(true);
      expect(isExcluded("src", excludePatterns)).toBe(false);
    });

    it("should exclude files in excluded directories", () => {
      const excludePatterns = ["node_modules"];
      expect(isExcluded("node_modules/package.json", excludePatterns)).toBe(true);
      expect(isExcluded("src/node_modules/test.js", excludePatterns)).toBe(true);
      expect(isExcluded("src/test.js", excludePatterns)).toBe(false);
    });

    it("should handle wildcard patterns", () => {
      const excludePatterns = ["*.log", "temp*"];
      expect(isExcluded("error.log", excludePatterns)).toBe(true);
      expect(isExcluded("temp.txt", excludePatterns)).toBe(true);
      expect(isExcluded("temporary", excludePatterns)).toBe(true);
      expect(isExcluded("test.txt", excludePatterns)).toBe(false);
    });

    it("should handle complex wildcard patterns", () => {
      const excludePatterns = ["**/node_modules/**"];
      expect(isExcluded("project/node_modules/package.json", excludePatterns)).toBe(true);
      expect(isExcluded("deep/path/node_modules/lib/test.js", excludePatterns)).toBe(true);
      expect(isExcluded("project/src/test.js", excludePatterns)).toBe(false);
    });

    it("should handle empty exclude patterns", () => {
      const excludePatterns: string[] = [];
      expect(isExcluded("any-file.txt", excludePatterns)).toBe(false);
    });

    it("should handle paths with leading slash", () => {
      const excludePatterns = ["node_modules"];
      expect(isExcluded("./node_modules/package.json", excludePatterns)).toBe(true);
      expect(isExcluded("/node_modules", excludePatterns)).toBe(true);
    });
  });

  describe("filterPaths", () => {
    it("should filter out excluded paths", async () => {
      const paths = [".env", "node_modules/package.json", "src/main.ts", ".git/config"];
      const excludePatterns = ["node_modules", ".git"];
      const result = await filterPaths(paths, excludePatterns);
      expect(result).toEqual([".env", "src/main.ts"]);
    });

    it("should handle empty paths array", async () => {
      const paths: string[] = [];
      const excludePatterns = ["node_modules"];
      const result = await filterPaths(paths, excludePatterns);
      expect(result).toEqual([]);
    });

    it("should handle empty exclude patterns", async () => {
      const paths = [".env", "config.json"];
      const excludePatterns: string[] = [];
      const result = await filterPaths(paths, excludePatterns);
      expect(result).toEqual([".env", "config.json"]);
    });

    it("should handle wildcard exclude patterns", async () => {
      const paths = ["app.log", "error.log", "config.json", "temp.txt"];
      const excludePatterns = ["*.log"];
      const result = await filterPaths(paths, excludePatterns);
      expect(result).toEqual(["config.json", "temp.txt"]);
    });

    it("should preserve order of non-excluded paths", async () => {
      const paths = ["a.txt", "node_modules/b.txt", "c.txt", "d.txt"];
      const excludePatterns = ["node_modules"];
      const result = await filterPaths(paths, excludePatterns);
      expect(result).toEqual(["a.txt", "c.txt", "d.txt"]);
    });
  });
});