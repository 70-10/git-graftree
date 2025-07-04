import { glob } from "glob";
import path from "path";

export async function expandGlobPatterns(
  patterns: string[],
  baseDir: string = process.cwd()
): Promise<string[]> {
  const expandedPaths: string[] = [];
  
  for (const pattern of patterns) {
    // If pattern is a simple path without wildcards, add it directly
    if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
      expandedPaths.push(pattern);
      continue;
    }
    
    // Use glob to expand pattern
    const matches = await glob(pattern, { cwd: baseDir });
    
    for (const match of matches) {
      expandedPaths.push(match);
    }
  }
  
  return [...new Set(expandedPaths)]; // Remove duplicates
}

export function isExcluded(filePath: string, excludePatterns: string[]): boolean {
  for (const pattern of excludePatterns) {
    // Simple pattern matching - can be enhanced with full glob support
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(filePath)) {
        return true;
      }
    } else if (filePath === pattern || filePath.endsWith(`/${pattern}`) || filePath.includes(`/${pattern}/`) || filePath.startsWith(`${pattern}/`)) {
      return true;
    }
  }
  return false;
}

export async function filterPaths(
  paths: string[],
  excludePatterns: string[] = []
): Promise<string[]> {
  return paths.filter(path => !isExcluded(path, excludePatterns));
}