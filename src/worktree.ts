import { execa } from "execa";
import { mkdir } from "fs/promises";
import path from "path";

export interface WorktreeOptions {
  branch: string;
  path?: string;
  noTrack?: boolean;
  force?: boolean;
}

export async function createWorktree(options: WorktreeOptions): Promise<string> {
  const { branch, path: targetPath, noTrack, force } = options;
  
  // Determine the worktree path
  let worktreePath: string;
  if (targetPath) {
    worktreePath = targetPath;
  } else {
    // Use ghq-style path structure: ${ghq.root}/worktrees/${repo}/${branch}
    const ghqRoot = await getGhqRoot();
    const repoName = await getRepositoryName();
    worktreePath = path.join(ghqRoot, "worktrees", repoName, branch);
  }
  
  // Check if branch exists
  const branchExists = await checkBranchExists(branch);
  
  // Build git worktree command
  const args = ["worktree", "add"];
  
  if (force) {
    args.push("--force");
  }
  
  if (noTrack) {
    args.push("--no-track");
  }
  
  if (!branchExists) {
    // Create new branch
    args.push("-b");
    args.push(branch);
    args.push(worktreePath);
  } else {
    // Use existing branch
    args.push(worktreePath);
    args.push(branch);
  }
  
  try {
    // Ensure the parent directory exists
    const parentDir = path.dirname(worktreePath);
    await mkdir(parentDir, { recursive: true });
    
    // Execute git worktree add command
    await execa("git", args);
    
    return worktreePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create worktree for branch '${branch}': ${errorMessage}`);
  }
}

export async function isGitRepository(): Promise<boolean> {
  try {
    const result = await execa("git", ["rev-parse", "--is-inside-work-tree"]);
    return result.stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function checkBranchExists(branch: string): Promise<boolean> {
  try {
    await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

export async function getGhqRoot(): Promise<string> {
  try {
    const result = await execa("ghq", ["root"]);
    return result.stdout.trim();
  } catch (error) {
    // Fallback to default ghq root if ghq command is not available
    const fallbackPath = path.join(process.env.HOME || process.cwd(), "ghq");
    return fallbackPath;
  }
}

export async function getRepositoryName(): Promise<string> {
  try {
    const result = await execa("git", ["rev-parse", "--show-toplevel"]);
    const repoRoot = result.stdout.trim();
    return path.basename(repoRoot);
  } catch (error) {
    // Fallback to current directory name if not in a git repository
    const fallbackName = path.basename(process.cwd());
    return fallbackName;
  }
}