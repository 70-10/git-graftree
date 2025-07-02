#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { loadConfig } from "./config";
import { createWorktree, isGitRepository } from "./worktree";
import { expandGlobPatterns, filterPaths } from "./pattern-matching";
import { processPath } from "./file-operations";
import { addToGitExclude } from "./git-exclude";

const main = defineCommand({
  meta: {
    name: "git-graftree",
    version: "0.1.0",
    description: "Create git worktree and copy/symlink files from base directory"
  },
  args: {
    branch: {
      type: "positional",
      description: "Branch name for the worktree",
      required: true
    },
    symlink: {
      type: "boolean",
      description: "Create symbolic links instead of copying files",
      alias: "s"
    },
    path: {
      type: "string",
      description: "Path where to create the worktree",
      alias: "p"
    },
    "no-track": {
      type: "boolean",
      description: "Do not track the branch"
    },
    force: {
      type: "boolean",
      description: "Force creation even if worktree directory exists",
      alias: "f"
    }
  },
  async run({ args }) {
    try {
      // Check if we're in a git repository
      if (!(await isGitRepository())) {
        console.error("Error: Not in a git repository");
        process.exit(1);
      }

      // Load configuration
      const config = await loadConfig();
      const useSymlinks = args.symlink ?? (config.mode === "symlink");

      // Create worktree
      console.log(`git-graftree: Creating worktree '${args.branch}'...`);
      const worktreePath = await createWorktree({
        branch: args.branch,
        path: args.path,
        noTrack: args["no-track"],
        force: args.force
      });

      // Expand and filter paths
      const sourceDir = process.cwd();
      const expandedPaths = await expandGlobPatterns(config.include, sourceDir);
      const filteredPaths = await filterPaths(expandedPaths, config.exclude);
      
      if (filteredPaths.length === 0) {
        console.log(`✓ Worktree created at ${worktreePath}`);
        console.log("No files to process");
        return;
      }

      // Process each path
      const errors: string[] = [];
      for (const filePath of filteredPaths) {
        try {
          await processPath(filePath, sourceDir, worktreePath, useSymlinks);
        } catch (error) {
          const errorMsg = `Failed to process ${filePath}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Add paths to .git/info/exclude
      if (filteredPaths.length > 0) {
        await addToGitExclude(filteredPaths);
      }

      // Summary
      console.log(`✓ Worktree created at ${worktreePath}`);
      if (errors.length > 0) {
        console.log(`✗ Failed to ${useSymlinks ? 'link' : 'copy'} ${errors.length}/${filteredPaths.length} files:`);
        errors.forEach(error => {
          const match = error.match(/Failed to process (.+): (.+)/);
          if (match) {
            console.log(`  • ${match[1]}: ${match[2]}`);
          } else {
            console.log(`  • ${error}`);
          }
        });
        process.exit(1);
      } else {
        const mode = useSymlinks ? 'symlink' : 'copy';
        const fileDesc = filteredPaths.length === 1 ? 'file' : 'files';
        const patterns = config.include.join(', ');
        console.log(`${useSymlinks ? 'Linked' : 'Copied'} ${patterns} (${filteredPaths.length} ${fileDesc}, ${mode} mode)`);
      }

    } catch (error) {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    }
  }
});

runMain(main);