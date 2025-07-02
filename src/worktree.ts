import { $ } from "bun";
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
  
  // Build git worktree command
  const args = ["worktree", "add"];
  
  if (force) {
    args.push("--force");
  }
  
  if (noTrack) {
    args.push("--no-track");
  }
  
  args.push(worktreePath);
  args.push(branch);
  
  try {
    console.log(`Creating worktree at ${worktreePath} for branch ${branch}...`);
    
    // Execute git worktree add command
    await $`git ${args}`.text();
    
    console.log("Worktree created successfully");
    return worktreePath;
  } catch (error) {
    console.error("Failed to create worktree:", error);
    throw new Error(`Failed to create worktree: ${error}`);
  }
}

export async function isGitRepository(): Promise<boolean> {
  try {
    const result = await $`git rev-parse --is-inside-work-tree`.quiet();
    return result.text().trim() === "true";
  } catch {
    return false;
  }
}