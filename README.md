# git-graftree

Extend `git worktree` to automatically copy or symlink ignored files (like `.env`) into new worktree directories.

## Installation

### Option 1: Install from npm (Recommended)

**Requirements:** Node.js 20+

```bash
npm install -g git-graftree
```

### Option 2: Build from source

```bash
# Clone and build
git clone <repository-url>
cd git-graftree
bun install
bun run build

# Make executable and add to PATH
chmod +x dist/git-graftree.js
mv dist/git-graftree.js ~/bin/git-graftree  # or any directory in your PATH
```

Now you can use it as `git graftree` thanks to Git's command discovery.

## Usage

```bash
# Create worktree and copy .env (default)
git graftree feature-branch

# Create worktree with symlinks instead of copying
git graftree feature-branch --symlink

# Specify custom worktree path
git graftree feature-branch --path ../my-feature

# Force creation even if directory exists
git graftree feature-branch --force
```

## Configuration

Create `.graftreerc` in your project root or home directory:

```json
{
  "mode": "copy",
  "paths": [".env", "config/local.json", "storage/**"],
  "exclude": ["storage/tmp/**"]
}
```

- **mode**: `"copy"` or `"symlink"` (default: `"copy"`)
- **paths**: Files/patterns to copy (default: `[".env"]`)
- **exclude**: Patterns to exclude (optional)

Local `.graftreerc` overrides global `~/.graftreerc`.

## Features

- 🌳 Creates git worktree for specified branch
- 📁 Copies or symlinks configured files/directories
- 🔍 Supports glob patterns for flexible file matching
- 🚫 Automatically adds paths to `.git/info/exclude`
- ⚙️ JSON configuration with global/local settings
