import { existsSync, mkdirSync } from "fs";
import { appendFile, readFile } from "fs/promises";
import path from "path";

export async function addToGitExclude(patterns: string[]): Promise<void> {
  const gitDir = await findGitDir();
  if (!gitDir) {
    console.warn("Warning: Not in a git repository, skipping .git/info/exclude update");
    return;
  }
  
  const excludeFile = path.join(gitDir, "info", "exclude");
  const infoDir = path.dirname(excludeFile);
  
  // Ensure info directory exists
  if (!existsSync(infoDir)) {
    mkdirSync(infoDir, { recursive: true });
  }
  
  // Read existing exclude file if it exists
  let existingContent = "";
  if (existsSync(excludeFile)) {
    existingContent = await readFile(excludeFile, "utf-8");
  }
  
  // Filter out patterns that already exist
  const existingPatterns = new Set(
    existingContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
  );
  
  const newPatterns = patterns.filter(pattern => !existingPatterns.has(pattern));
  
  if (newPatterns.length === 0) {
    console.log("All patterns already exist in .git/info/exclude");
    return;
  }
  
  // Add new patterns
  const linesToAdd = [
    "",
    "# Added by git-graftree",
    ...newPatterns,
    ""
  ].join('\n');
  
  await appendFile(excludeFile, linesToAdd);
  console.log(`Added ${newPatterns.length} patterns to .git/info/exclude:`, newPatterns);
}

async function findGitDir(): Promise<string | null> {
  let currentDir = process.cwd();
  
  while (currentDir !== path.dirname(currentDir)) {
    const gitDir = path.join(currentDir, ".git");
    if (existsSync(gitDir)) {
      return gitDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}