import { existsSync, lstatSync, mkdirSync } from "fs";
import { copyFile, symlink, readdir } from "fs/promises";
import path from "path";

export interface FileOperationOptions {
  sourcePath: string;
  targetPath: string;
  useSymlinks: boolean;
}

export async function copyOrLinkFile(options: FileOperationOptions): Promise<void> {
  const { sourcePath, targetPath, useSymlinks } = options;
  
  if (!existsSync(sourcePath)) {
    return;
  }

  // Skip if target already exists
  if (existsSync(targetPath)) {
    return;
  }
  
  // Ensure target directory exists
  const targetDir = path.dirname(targetPath);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  
  if (useSymlinks) {
    await symlink(sourcePath, targetPath);
  } else {
    await copyFile(sourcePath, targetPath);
  }
}

export async function copyOrLinkDirectory(options: FileOperationOptions): Promise<void> {
  const { sourcePath, targetPath, useSymlinks } = options;
  
  if (!existsSync(sourcePath)) {
    return;
  }
  
  const stat = lstatSync(sourcePath);
  if (!stat.isDirectory()) {
    throw new Error(`${sourcePath} is not a directory`);
  }
  
  // Create target directory if it doesn't exist
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true });
  }
  
  // Copy/link all files in the directory
  const entries = await readdir(sourcePath, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);
    
    if (entry.isFile()) {
      await copyOrLinkFile({
        sourcePath: sourceEntryPath,
        targetPath: targetEntryPath,
        useSymlinks
      });
    } else if (entry.isDirectory()) {
      await copyOrLinkDirectory({
        sourcePath: sourceEntryPath,
        targetPath: targetEntryPath,
        useSymlinks
      });
    }
  }
}

export async function processPath(
  patternPath: string,
  sourceBase: string,
  targetBase: string,
  useSymlinks: boolean
): Promise<void> {
  const sourcePath = path.resolve(sourceBase, patternPath);
  const targetPath = path.resolve(targetBase, patternPath);
  
  if (!existsSync(sourcePath)) {
    return;
  }
  
  const stat = lstatSync(sourcePath);
  
  if (stat.isFile()) {
    await copyOrLinkFile({
      sourcePath,
      targetPath,
      useSymlinks
    });
  } else if (stat.isDirectory()) {
    await copyOrLinkDirectory({
      sourcePath,
      targetPath,
      useSymlinks
    });
  }
}