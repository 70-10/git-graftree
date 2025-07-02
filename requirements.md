# git‑graftree – Requirements

## 1. Project Overview

- **Purpose** : Extend `git worktree` so that ignored files (e.g. `.env`) are automatically copied or symlinked into the new worktree directory.
- **Scope** : Personal‑use CLI; minimal hardening now, extensible later.

---

## 2. CLI Name & Invocation

- Executable **file name** : `git-graftree` ➜ callable as `git graftree` thanks to Git’s `git‑<cmd>` discovery.
- **Usage**

  ```bash
  git graftree <branch_name> [--symlink] [--path <dir>] [--no-track] [--force]
  ```

  | Option       | Effect                                                                                        |
  | ------------ | --------------------------------------------------------------------------------------------- |
  | `--symlink`  | Place ignored files as symbolic links (default follows `mode` in config).                     |
  | `--path`     | Override destination dir (defaults to `<repo_root>/../<branch>` or `worktreeRoot` in config). |
  | `--no-track` | Create local branch without tracking remote.                                                  |
  | `--force`    | Overwrite existing targets without prompt.                                                    |

---

## 3. Functional Requirements

1. **Worktree Creation** : Internally run `git worktree add -B <branch> <dir>`.
2. **Config Load** : Merge settings in order → global `~/.wtcopyrc` → repo `./.wtcopyrc` → ENV → CLI opts.
3. **File Provisioning**

   - Iterate over `paths` list.
   - Respect `exclude` patterns.
   - If mode is `symlink` (or `--symlink`), create links; else copy (hard‑link when same FS, cp otherwise).

4. **Safety** : Append affected paths to `.git/info/exclude` (opt‑out TBD) to prevent accidental commits.
5. **Logging** : Simple stdout; verbose flag later.
6. **Error Handling** :

   - Abort on worktree failure.
   - Warn on missing source or failed link → fallback to copy.

---

## 4. Configuration File – `.wtcopyrc` (JSON)

```json
{
  "mode": "symlink", // "copy" | "symlink"
  "paths": [".env", "config/local/*.yml", "storage/uploads/**"],
  "exclude": ["storage/uploads/tmp/**"],
  "worktreeRoot": "../" // optional base dir for new worktrees
}
```

- **All keys optional**; defaults → `mode:"copy"`, `paths:[".env"]`, `exclude:[]`, dynamic `worktreeRoot`.

---

## 5. Minimal Directory Layout

```
git-graftree/
├─ src/cli.ts          # Entry
├─ tsconfig.json
└─ package.json        # bin = git-graftree
```

### `package.json` essentials

```jsonc
{
  "bin": { "git-graftree": "./dist/git-graftree" },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --compile --outfile dist/git-graftree"
  },
  "dependencies": { "commander": "^12" }
}
```

---

## 6. Implementation Notes (Bun + TypeScript)

- Use **Bun’s `$`** for shelling to `git`.
- CLI parsing via **Commander**.
- Shebang `#!/usr/bin/env bun`.
- Build single‑file binary:

  ```bash
  bun run build   # ⇒ dist/git-graftree (≈45–80 MB)
  ```

---

## 7. Installation & Usage (Self‑hosted)

```bash
# Build & place in PATH
bun run build
chmod +x dist/git-graftree
mv dist/git-graftree ~/bin/

# Create worktree with symlinked ignored files
git graftree feature/login --symlink
```

No global npm publication needed while tool remains personal.

---

## 8. Future Considerations

- **Distribution**: optional npm meta‑package with per‑OS binaries.
- **Language Migration**: Go (go‑git) or Rust (git2‑rs) rewrite if performance/size become concerns.
- **Extended Commands**: `sync`, auto‑cleanup, shell completion, CI temp mode.
