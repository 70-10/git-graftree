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

      console.log("🌳 Starting git-graftree...");
      
      // Load configuration
      const config = await loadConfig();
      console.log("📋 Configuration loaded:", {
        mode: config.mode,
        include: config.include,
        exclude: config.exclude || []
      });

      // Determine operation mode
      const useSymlinks = args.symlink ?? (config.mode === "symlink");
      console.log(`🔧 Mode: ${useSymlinks ? "symlink" : "copy"}`);

      // Create worktree
      console.log(`🚀 Creating worktree for branch: ${args.branch}`);
      const worktreePath = await createWorktree({
        branch: args.branch,
        path: args.path,
        noTrack: args["no-track"],
        force: args.force
      });

      // Expand glob patterns
      const sourceDir = process.cwd();
      console.log("🔍 Expanding path patterns...");
      const expandedPaths = await expandGlobPatterns(config.include, sourceDir);
      
      // Filter out excluded paths
      const filteredPaths = await filterPaths(expandedPaths, config.exclude);
      
      if (filteredPaths.length === 0) {
        console.log("⚠️  No files to copy/link after filtering");
        return;
      }

      console.log(`📁 Processing ${filteredPaths.length} paths:`, filteredPaths);

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
        console.log("📝 Adding paths to .git/info/exclude...");
        await addToGitExclude(filteredPaths);
      }

      // Summary
      console.log(`\n✅ git-graftree completed successfully!`);
      console.log(`📍 Worktree created at: ${worktreePath}`);
      console.log(`📦 Processed ${filteredPaths.length - errors.length}/${filteredPaths.length} paths`);
      
      if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} errors occurred:`);
        errors.forEach(error => console.log(`   • ${error}`));
        process.exit(1);
      }

    } catch (error) {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    }
  }
});

runMain(main);