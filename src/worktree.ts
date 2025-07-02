import { execa } from "execa";
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
  const worktreePath = targetPath || path.join(process.cwd(), `../${branch}`);
  
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
    console.log(`Branch '${branch}' does not exist. Creating new branch...`);
    args.push("-b");
    args.push(branch);
    args.push(worktreePath);
  } else {
    // Use existing branch
    args.push(worktreePath);
    args.push(branch);
  }
  
  try {
    console.log(`Creating worktree at ${worktreePath} for branch ${branch}...`);
    
    // Execute git worktree add command
    await execa("git", args);
    
    console.log("Worktree created successfully");
    return worktreePath;
  } catch (error) {
    console.error("Failed to create worktree:", error);
    throw new Error(`Failed to create worktree: ${error}`);
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