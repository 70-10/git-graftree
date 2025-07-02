import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import os from "os";
import { $ } from "bun";
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
    await $`git init`.quiet();
    await $`git config user.name "Test User"`.quiet();
    await $`git config user.email "test@example.com"`.quiet();
    
    // Create initial commit
    await $`echo "# Test Repo" > README.md`.quiet();
    await $`git add README.md`.quiet();
    await $`git commit -m "Initial commit"`.quiet();
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
    await $`git checkout -b feature-branch-${Date.now()}`.quiet();
    await $`echo "feature" > feature.txt`.quiet();
    await $`git add feature.txt`.quiet();
    await $`git commit -m "Add feature"`.quiet();
    const branchName = await $`git branch --show-current`.text();
    const cleanBranchName = branchName.trim();
    await $`git checkout main`.quiet();
    
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
    await $`git checkout -b ${customBranchName}`.quiet();
    await $`echo "custom" > custom.txt`.quiet();
    await $`git add custom.txt`.quiet();
    await $`git commit -m "Add custom"`.quiet();
    await $`git checkout main`.quiet();
    
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
    await $`git checkout -b ${anotherBranchName}`.quiet();
    await $`echo "another" > another.txt`.quiet();
    await $`git add another.txt`.quiet();
    await $`git commit -m "Add another"`.quiet();
    await $`git checkout main`.quiet();
    
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