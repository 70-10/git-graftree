#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";

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
    console.log("git-graftree starting...");
    console.log("Branch:", args.branch);
    console.log("Options:", {
      symlink: args.symlink,
      path: args.path,
      noTrack: args["no-track"],
      force: args.force
    });
    
    // TODO: Implement the main logic
    console.log("Implementation coming soon...");
  }
});

runMain(main);