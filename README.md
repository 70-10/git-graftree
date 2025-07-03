# git-graftree

Extend `git worktree` to automatically copy or symlink ignored files (like `.env`) into new worktree directories.

## Installation

**Requirements:** Node.js 20+

```bash
npm install -g git-graftree
```

Now you can use it as `git graftree` thanks to Git's command discovery.

## Prerequisites

This tool is designed to work with [ghq](https://github.com/x-motemen/ghq) for repository management. While ghq is recommended for the best experience, git-graftree will work without it by using fallback paths.

- **With ghq**: Worktrees are created in `${ghq.root}/worktrees/${repo}/${branch}`
- **Without ghq**: Falls back to `~/ghq/worktrees/${repo}/${branch}`

## Usage

```bash
# Create worktree and copy .env (default)
git graftree feature-branch
# → Creates: ${ghq.root}/worktrees/my-repo/feature-branch/

# Create worktree with symlinks instead of copying
git graftree feature-branch --symlink

# Specify custom worktree path
git graftree feature-branch --path ../my-feature
# → Creates: ../my-feature/

# Force creation even if directory exists
git graftree feature-branch --force

# Automatically creates new branch if it doesn't exist
git graftree new-feature
# → Creates branch 'new-feature' and worktree

# Specify files directly with CLI arguments (no config file needed)
git graftree feature-branch --include .env --include .env.local
git graftree feature-branch -i .env -i .env.local

# Include and exclude patterns
git graftree feature-branch -i ".env*" -e ".env.prod"

# Combine with config file (CLI args append to config)
git graftree feature-branch -i .custom-config
```

## Configuration

Create `.graftreerc` in your project root or home directory:

```json
{
  "mode": "copy",
  "include": [".env", "config/local.json", "storage/**"],
  "exclude": ["storage/tmp/**"]
}
```

- **mode**: `"copy"` or `"symlink"` (default: `"copy"`)
- **include**: Files/patterns to copy (default: `[]`)
- **exclude**: Patterns to exclude (optional)

Local `.graftreerc` overrides global `~/.graftreerc`.

### CLI Arguments

You can also specify files directly using command-line arguments:

```bash
# Include specific files
git graftree branch-name --include .env --include config.json
git graftree branch-name -i .env -i config.json

# Exclude patterns  
git graftree branch-name --include ".env*" --exclude ".env.prod"
git graftree branch-name -i ".env*" -e ".env.prod"
```

**Behavior:**
- CLI arguments **append** to config file settings (don't override them)
- You can use CLI arguments without any config file
- Perfect for one-off worktree creation with specific files

**Priority:** `Default config < Global config < Local config < CLI arguments (appended)`

## Path Structure

git-graftree creates worktrees with the following path structure:

**Default behavior:**
```
${ghq.root}/worktrees/${repository-name}/${branch-name}/
```

**Examples:**
```bash
# If ghq root is ~/src and repository is "my-project"
git graftree feature-branch
# Creates: ~/src/worktrees/my-project/feature-branch/

# Custom path (overrides default structure)
git graftree feature-branch --path ../custom-location
# Creates: ../custom-location/
```

The tool automatically:
- Detects your ghq root directory
- Creates necessary parent directories
- Creates new branches if they don't exist

## Features

- 🌳 Creates git worktree for specified branch
- 📁 Copies or symlinks configured files/directories
- 🔍 Supports glob patterns for flexible file matching
- 🚫 Automatically adds paths to `.git/info/exclude`
- ⚙️ JSON configuration with global/local settings
- 🏠 ghq integration for organized worktree paths
- 🔧 Automatic branch creation for non-existent branches
- 📂 Smart directory structure management
- 🎯 CLI arguments for direct file specification
- 📝 Works without configuration files
- 🔄 Flexible config file and CLI argument combination
