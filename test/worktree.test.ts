import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { execa } from "execa";
import { createWorktree, isGitRepository } from "../src/worktree";

describe("Worktree", () => {
  const testDir = path.join(os.tmpdir(), "graftree-worktree-test-" + Date.now());
  const originalCwd = process.cwd();
  
  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Initialize git repository
    await execa("git", ["init"], { stdio: "ignore" });
    await execa("git", ["config", "user.name", "Test User"], { stdio: "ignore" });
    await execa("git", ["config", "user.email", "test@example.com"], { stdio: "ignore" });
    
    // Create initial commit
    writeFileSync("README.md", "# Test Repo\n");
    await execa("git", ["add", "README.md"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Initial commit"], { stdio: "ignore" });
  });
  
  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("should detect git repository correctly", async () => {
    const isRepo = await isGitRepository();
    expect(isRepo).toBe(true);
    
    // Test non-git directory in a separate location
    const tempNonGitDir = path.join(os.tmpdir(), "non-git-test-" + Date.now());
    mkdirSync(tempNonGitDir, { recursive: true });
    const originalCwd2 = process.cwd();
    
    try {
      process.chdir(tempNonGitDir);
      const isNotRepo = await isGitRepository();
      expect(isNotRepo).toBe(false);
    } finally {
      process.chdir(originalCwd2);
      rmSync(tempNonGitDir, { recursive: true, force: true });
    }
  });

  it("should create worktree with default path", async () => {
    // Create a new branch
    const timestamp = Date.now();
    await execa("git", ["checkout", "-b", `feature-branch-${timestamp}`], { stdio: "ignore" });
    writeFileSync("feature.txt", "feature\n");
    await execa("git", ["add", "feature.txt"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Add feature"], { stdio: "ignore" });
    const branchResult = await execa("git", ["branch", "--show-current"]);
    const cleanBranchName = branchResult.stdout.trim();
    await execa("git", ["checkout", "main"], { stdio: "ignore" });
    
    const worktreePath = await createWorktree({
      branch: cleanBranchName
    });
    
    const expectedPath = path.resolve(testDir, `../${cleanBranchName}`);
    // Use fs.realpathSync to resolve symlinks like /private/var -> /var on macOS
    expect(require("fs").realpathSync(worktreePath)).toBe(require("fs").realpathSync(expectedPath));
    expect(existsSync(worktreePath)).toBe(true);
    expect(existsSync(path.join(worktreePath, "feature.txt"))).toBe(true);
  });

  it("should create worktree with custom path", async () => {
    // Create a new branch  
    const customBranchName = `custom-branch-${Date.now()}`;
    await execa("git", ["checkout", "-b", customBranchName], { stdio: "ignore" });
    writeFileSync("custom.txt", "custom\n");
    await execa("git", ["add", "custom.txt"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Add custom"], { stdio: "ignore" });
    await execa("git", ["checkout", "main"], { stdio: "ignore" });
    
    const customPath = path.join(testDir, "custom-worktree");
    const worktreePath = await createWorktree({
      branch: customBranchName,
      path: customPath
    });
    
    expect(worktreePath).toBe(customPath);
    expect(existsSync(customPath)).toBe(true);
    expect(existsSync(path.join(customPath, "custom.txt"))).toBe(true);
  });

  it("should handle non-existent branch", async () => {
    await expect(createWorktree({
      branch: "non-existent-branch"
    })).rejects.toThrow("Failed to create worktree");
  });

  it("should create another worktree successfully", async () => {
    const anotherBranchName = `another-branch-${Date.now()}`;
    await execa("git", ["checkout", "-b", anotherBranchName], { stdio: "ignore" });
    writeFileSync("another.txt", "another\n");
    await execa("git", ["add", "another.txt"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Add another"], { stdio: "ignore" });
    await execa("git", ["checkout", "main"], { stdio: "ignore" });
    
    const anotherPath = path.join(testDir, "another-worktree");
    const worktreePath = await createWorktree({
      branch: anotherBranchName,
      path: anotherPath
    });
    
    expect(worktreePath).toBe(anotherPath);
    expect(existsSync(anotherPath)).toBe(true);
    expect(existsSync(path.join(anotherPath, "another.txt"))).toBe(true);
  });
});