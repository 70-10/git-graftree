import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { addToGitExclude } from "../src/git-exclude";

describe("git-exclude", () => {
  let tempDir: string;
  let gitDir: string;
  let excludeFile: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "graftree-test-"));
    gitDir = join(tempDir, ".git");
    excludeFile = join(gitDir, "info", "exclude");
    originalCwd = process.cwd();
    
    // Change to temp directory to simulate being in a git repo
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("addToGitExclude", () => {
    it("should create .git/info/exclude file if it doesn't exist", async () => {
      await mkdir(gitDir);
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      expect(existsSync(excludeFile)).toBe(true);
      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain(".env");
      expect(content).toContain("config.json");
      expect(content).toContain("# Added by git-graftree");
    });

    it("should create .git/info directory if it doesn't exist", async () => {
      await mkdir(gitDir);
      const patterns = [".env"];

      await addToGitExclude(patterns);

      expect(existsSync(join(gitDir, "info"))).toBe(true);
      expect(existsSync(excludeFile)).toBe(true);
    });

    it("should append patterns to existing exclude file", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, "# Existing content\n*.log\n");
      
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain("# Existing content");
      expect(content).toContain("*.log");
      expect(content).toContain(".env");
      expect(content).toContain("config.json");
    });

    it("should not add duplicate patterns", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, ".env\nconfig.json\n");
      
      const patterns = [".env", "new-file.txt"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      const lines = content.split('\n');
      const envCount = lines.filter(line => line.trim() === ".env").length;
      expect(envCount).toBe(1);
      expect(content).toContain("new-file.txt");
    });

    it("should ignore comment lines when checking duplicates", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, "# Comment about .env\n.env\n# Another comment\n");
      
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      const lines = content.split('\n');
      const envCount = lines.filter(line => line.trim() === ".env").length;
      expect(envCount).toBe(1);
      expect(content).toContain("config.json");
    });

    it("should handle empty patterns array", async () => {
      await mkdir(gitDir);
      const patterns: string[] = [];

      await addToGitExclude(patterns);

      expect(existsSync(excludeFile)).toBe(false);
    });

    it("should handle patterns with whitespace", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, "  .env  \n  \n");
      
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain("config.json");
      
      // Should not duplicate .env even with whitespace
      const lines = content.split('\n');
      const envCount = lines.filter(line => line.trim() === ".env").length;
      expect(envCount).toBe(1);
    });

    it("should do nothing if not in a git repository", async () => {
      // Change to a directory without .git
      const nonGitDir = join(tempDir, "non-git");
      await mkdir(nonGitDir);
      process.chdir(nonGitDir);
      
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      expect(existsSync(join(nonGitDir, ".git"))).toBe(false);
    });

    it("should handle nested git repositories", async () => {
      // Create nested structure
      const nestedDir = join(tempDir, "nested", "project");
      await mkdir(nestedDir, { recursive: true });
      process.chdir(nestedDir);
      
      // .git is in parent directory
      await mkdir(gitDir);
      const patterns = [".env"];

      await addToGitExclude(patterns);

      expect(existsSync(excludeFile)).toBe(true);
      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain(".env");
    });

    it("should handle multiple patterns efficiently", async () => {
      await mkdir(gitDir);
      const patterns = [".env", ".env.local", ".env.production", "config.json", "secrets.yml"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      patterns.forEach(pattern => {
        expect(content).toContain(pattern);
      });
      expect(content).toContain("# Added by git-graftree");
    });

    it("should skip adding patterns if all patterns already exist", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      const existingContent = ".env\nconfig.json\n";
      await writeFile(excludeFile, existingContent);
      
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      expect(content).toBe(existingContent);
    });

    it("should handle mixed existing and new patterns", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, ".env\n");
      
      const patterns = [".env", "config.json", "secrets.yml"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain("config.json");
      expect(content).toContain("secrets.yml");
      
      // Should not duplicate .env
      const lines = content.split('\n');
      const envCount = lines.filter(line => line.trim() === ".env").length;
      expect(envCount).toBe(1);
    });

    it("should handle empty exclude file", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, "");
      
      const patterns = [".env", "config.json"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain(".env");
      expect(content).toContain("config.json");
    });

    it("should handle exclude file with only comments", async () => {
      await mkdir(join(gitDir, "info"), { recursive: true });
      await writeFile(excludeFile, "# Just comments\n# Another comment\n");
      
      const patterns = [".env"];

      await addToGitExclude(patterns);

      const content = await readFile(excludeFile, "utf-8");
      expect(content).toContain("# Just comments");
      expect(content).toContain(".env");
    });
  });
});