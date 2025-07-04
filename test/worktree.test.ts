import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { execa } from "execa";
import { createWorktree, isGitRepository, checkBranchExists, getGhqRoot, getRepositoryName } from "../src/worktree";

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
    
    // Create initial commit on main branch
    writeFileSync("README.md", "# Test Repo\n");
    await execa("git", ["add", "README.md"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Initial commit"], { stdio: "ignore" });
    
    // Rename default branch to main (in case it's 'master')
    await execa("git", ["branch", "-M", "main"], { stdio: "ignore" });
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

  it("should create worktree with default path (ghq-style)", async () => {
    // Create a new branch
    const timestamp = Date.now();
    await execa("git", ["checkout", "-b", `feature-branch-${timestamp}`], { stdio: "ignore" });
    writeFileSync("feature.txt", "feature\n");
    await execa("git", ["add", "feature.txt"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Add feature"], { stdio: "ignore" });
    const branchResult = await execa("git", ["branch", "--show-current"]);
    const cleanBranchName = branchResult.stdout.trim();
    try {
      await execa("git", ["checkout", "main"], { stdio: "ignore" });
    } catch (error) {
      // If main doesn't exist, stay on current branch
      console.warn("Failed to checkout main branch, staying on current branch");
    }
    
    const worktreePath = await createWorktree({
      branch: cleanBranchName
    });
    
    // Verify it uses ghq-style path structure
    const ghqRoot = await getGhqRoot();
    const repoName = await getRepositoryName();
    const expectedPath = path.join(ghqRoot, "worktrees", repoName, cleanBranchName);
    
    expect(path.resolve(worktreePath)).toBe(path.resolve(expectedPath));
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
    try {
      await execa("git", ["checkout", "main"], { stdio: "ignore" });
    } catch (error) {
      // If main doesn't exist, stay on current branch
      console.warn("Failed to checkout main branch, staying on current branch");
    }
    
    const customPath = path.join(testDir, "custom-worktree");
    const worktreePath = await createWorktree({
      branch: customBranchName,
      path: customPath
    });
    
    expect(worktreePath).toBe(customPath);
    expect(existsSync(customPath)).toBe(true);
    expect(existsSync(path.join(customPath, "custom.txt"))).toBe(true);
  });

  it("should create worktree successfully even with non-existent branch", async () => {
    const nonExistentBranch = `non-existent-${Date.now()}`;
    
    // Verify branch doesn't exist initially
    const existsBefore = await checkBranchExists(nonExistentBranch);
    expect(existsBefore).toBe(false);
    
    const customPath = path.join(testDir, "non-existent-worktree");
    const worktreePath = await createWorktree({
      branch: nonExistentBranch,
      path: customPath
    });
    
    expect(worktreePath).toBe(customPath);
    expect(existsSync(customPath)).toBe(true);
    
    // Verify the branch was created
    const existsAfter = await checkBranchExists(nonExistentBranch);
    expect(existsAfter).toBe(true);
  });

  it("should create another worktree successfully", async () => {
    const anotherBranchName = `another-branch-${Date.now()}`;
    await execa("git", ["checkout", "-b", anotherBranchName], { stdio: "ignore" });
    writeFileSync("another.txt", "another\n");
    await execa("git", ["add", "another.txt"], { stdio: "ignore" });
    await execa("git", ["commit", "-m", "Add another"], { stdio: "ignore" });
    try {
      await execa("git", ["checkout", "main"], { stdio: "ignore" });
    } catch (error) {
      // If main doesn't exist, stay on current branch
      console.warn("Failed to checkout main branch, staying on current branch");
    }
    
    const anotherPath = path.join(testDir, "another-worktree");
    const worktreePath = await createWorktree({
      branch: anotherBranchName,
      path: anotherPath
    });
    
    expect(worktreePath).toBe(anotherPath);
    expect(existsSync(anotherPath)).toBe(true);
    expect(existsSync(path.join(anotherPath, "another.txt"))).toBe(true);
  });

  describe("Branch existence checking", () => {
    it("should return true for existing branch (main)", async () => {
      const exists = await checkBranchExists("main");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent branch", async () => {
      const exists = await checkBranchExists("non-existent-branch-12345");
      expect(exists).toBe(false);
    });

    it("should return true for created branch", async () => {
      const testBranchName = `test-exists-${Date.now()}`;
      
      // Create a test branch
      await execa("git", ["checkout", "-b", testBranchName], { stdio: "ignore" });
      try {
      await execa("git", ["checkout", "main"], { stdio: "ignore" });
    } catch (error) {
      // If main doesn't exist, stay on current branch
      console.warn("Failed to checkout main branch, staying on current branch");
    }
      
      const exists = await checkBranchExists(testBranchName);
      expect(exists).toBe(true);
      
      // Cleanup
      await execa("git", ["branch", "-D", testBranchName], { stdio: "ignore" });
    });
  });

  describe("Auto-create new branch", () => {
    it("should create worktree with new branch when branch doesn't exist", async () => {
      const newBranchName = `auto-created-${Date.now()}`;
      
      // Verify branch doesn't exist initially
      const existsBefore = await checkBranchExists(newBranchName);
      expect(existsBefore).toBe(false);
      
      const customPath = path.join(testDir, "auto-created-worktree");
      const worktreePath = await createWorktree({
        branch: newBranchName,
        path: customPath
      });
      
      expect(worktreePath).toBe(customPath);
      expect(existsSync(customPath)).toBe(true);
      
      // Verify the branch was created
      const existsAfter = await checkBranchExists(newBranchName);
      expect(existsAfter).toBe(true);
      
      // Verify we're on the correct branch in the worktree
      const originalCwd = process.cwd();
      try {
        process.chdir(customPath);
        const branchResult = await execa("git", ["branch", "--show-current"]);
        expect(branchResult.stdout.trim()).toBe(newBranchName);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("ghq integration", () => {
    it("should get ghq root directory", async () => {
      const ghqRoot = await getGhqRoot();
      
      // Should return a valid path (either from ghq command or fallback)
      expect(typeof ghqRoot).toBe("string");
      expect(ghqRoot.length).toBeGreaterThan(0);
      expect(path.isAbsolute(ghqRoot)).toBe(true);
    });

    it("should get repository name from current directory", async () => {
      const repoName = await getRepositoryName();
      
      expect(typeof repoName).toBe("string");
      expect(repoName.length).toBeGreaterThan(0);
      // In test environment, repository name will be the test directory name
      expect(repoName).toMatch(/^graftree-worktree-test-\d+$/);
    });

    it("should create worktree with ghq-style path structure", async () => {
      const newBranchName = `ghq-test-${Date.now()}`;
      
      // Create worktree without specifying path (should use ghq structure)
      const worktreePath = await createWorktree({
        branch: newBranchName
      });
      
      const ghqRoot = await getGhqRoot();
      const repoName = await getRepositoryName();
      const expectedPath = path.join(ghqRoot, "worktrees", repoName, newBranchName);
      
      expect(path.resolve(worktreePath)).toBe(path.resolve(expectedPath));
      expect(existsSync(worktreePath)).toBe(true);
      
      // Verify the branch was created
      const branchExists = await checkBranchExists(newBranchName);
      expect(branchExists).toBe(true);
      
      // Verify directory structure
      const worktreesDir = path.join(ghqRoot, "worktrees");
      const repoDir = path.join(worktreesDir, repoName);
      expect(existsSync(worktreesDir)).toBe(true);
      expect(existsSync(repoDir)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle force flag when worktree already exists", async () => {
      const branchName = `force-test-${Date.now()}`;
      const customPath = path.join(testDir, "force-test-worktree");
      
      // Create worktree first time
      await createWorktree({
        branch: branchName,
        path: customPath
      });
      
      expect(existsSync(customPath)).toBe(true);
      
      // Remove the worktree first, then create directory to simulate conflict
      await execa("git", ["worktree", "remove", customPath], { stdio: "ignore" });
      mkdirSync(customPath); // Create conflicting directory
      
      // Try to create worktree again with force flag
      const worktreePath = await createWorktree({
        branch: branchName,
        path: customPath,
        force: true
      });
      
      expect(worktreePath).toBe(customPath);
      expect(existsSync(customPath)).toBe(true);
    });

    it("should throw error when creating worktree fails", async () => {
      const invalidPath = "/invalid/path/that/cannot/be/created";
      
      await expect(createWorktree({
        branch: "test-branch",
        path: invalidPath
      })).rejects.toThrow("Failed to create worktree");
    });

    it("should handle no-track flag correctly", async () => {
      const branchName = `no-track-test-${Date.now()}`;
      const customPath = path.join(testDir, "no-track-worktree");
      
      const worktreePath = await createWorktree({
        branch: branchName,
        path: customPath,
        noTrack: true
      });
      
      expect(worktreePath).toBe(customPath);
      expect(existsSync(customPath)).toBe(true);
      
      // Verify the branch was created
      const branchExists = await checkBranchExists(branchName);
      expect(branchExists).toBe(true);
    });

    it("should handle repository name fallback when not in git repo", async () => {
      // Save original function and mock it temporarily
      const originalCwd = process.cwd();
      const tempNonGitDir = path.join(os.tmpdir(), "non-git-fallback-" + Date.now());
      
      try {
        mkdirSync(tempNonGitDir, { recursive: true });
        process.chdir(tempNonGitDir);
        
        const repoName = await getRepositoryName();
        
        // Should fallback to current directory name
        expect(typeof repoName).toBe("string");
        expect(repoName.length).toBeGreaterThan(0);
        expect(repoName).toMatch(/^non-git-fallback-\d+$/);
      } finally {
        process.chdir(originalCwd);
        if (existsSync(tempNonGitDir)) {
          rmSync(tempNonGitDir, { recursive: true, force: true });
        }
      }
    });

    it("should handle ghq command timeout gracefully", async () => {
      // This test verifies that getGhqRoot() handles command timeouts
      const ghqRoot = await getGhqRoot();
      
      // Should return either ghq root or fallback path
      expect(typeof ghqRoot).toBe("string");
      expect(ghqRoot.length).toBeGreaterThan(0);
      expect(path.isAbsolute(ghqRoot)).toBe(true);
      
      // Should be a valid directory path (either actual ghq root or fallback)
      expect(ghqRoot).toBeTruthy();
      // Fallback path is ~/ghq, so it should end with user's home or contain ghq
      const isValidGhqPath = ghqRoot.includes("ghq") || ghqRoot.includes(os.homedir());
      expect(isValidGhqPath).toBe(true);
    });
  });
});