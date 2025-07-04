import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, readFile, lstat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { copyOrLinkFile, copyOrLinkDirectory, processPath } from "../src/file-operations";

describe("file-operations", () => {
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "graftree-test-"));
    sourceDir = join(tempDir, "source");
    targetDir = join(tempDir, "target");
    await mkdir(sourceDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("copyOrLinkFile", () => {
    it("should copy a file when useSymlinks is false", async () => {
      const sourceFile = join(sourceDir, "test.txt");
      const targetFile = join(targetDir, "test.txt");
      await writeFile(sourceFile, "test content");

      await copyOrLinkFile({
        sourcePath: sourceFile,
        targetPath: targetFile,
        useSymlinks: false
      });

      expect(existsSync(targetFile)).toBe(true);
      const content = await readFile(targetFile, "utf8");
      expect(content).toBe("test content");
      
      const stat = await lstat(targetFile);
      expect(stat.isFile()).toBe(true);
      expect(stat.isSymbolicLink()).toBe(false);
    });

    it("should create a symlink when useSymlinks is true", async () => {
      const sourceFile = join(sourceDir, "test.txt");
      const targetFile = join(targetDir, "test.txt");
      await writeFile(sourceFile, "test content");

      await copyOrLinkFile({
        sourcePath: sourceFile,
        targetPath: targetFile,
        useSymlinks: true
      });

      expect(existsSync(targetFile)).toBe(true);
      const content = await readFile(targetFile, "utf8");
      expect(content).toBe("test content");
      
      const stat = await lstat(targetFile);
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("should create target directory if it doesn't exist", async () => {
      const sourceFile = join(sourceDir, "test.txt");
      const targetFile = join(targetDir, "nested", "deep", "test.txt");
      await writeFile(sourceFile, "test content");

      await copyOrLinkFile({
        sourcePath: sourceFile,
        targetPath: targetFile,
        useSymlinks: false
      });

      expect(existsSync(targetFile)).toBe(true);
      const content = await readFile(targetFile, "utf8");
      expect(content).toBe("test content");
    });

    it("should skip if source file doesn't exist", async () => {
      const sourceFile = join(sourceDir, "nonexistent.txt");
      const targetFile = join(targetDir, "test.txt");

      await copyOrLinkFile({
        sourcePath: sourceFile,
        targetPath: targetFile,
        useSymlinks: false
      });

      expect(existsSync(targetFile)).toBe(false);
    });

    it("should skip if target file already exists", async () => {
      const sourceFile = join(sourceDir, "test.txt");
      const targetFile = join(targetDir, "test.txt");
      await writeFile(sourceFile, "source content");
      await writeFile(targetFile, "existing content");

      await copyOrLinkFile({
        sourcePath: sourceFile,
        targetPath: targetFile,
        useSymlinks: false
      });

      const content = await readFile(targetFile, "utf8");
      expect(content).toBe("existing content");
    });

    it("should handle errors gracefully", async () => {
      const sourceFile = join(sourceDir, "test.txt");
      const targetFile = "/invalid/path/test.txt";
      await writeFile(sourceFile, "test content");

      await expect(copyOrLinkFile({
        sourcePath: sourceFile,
        targetPath: targetFile,
        useSymlinks: false
      })).rejects.toThrow();
    });
  });

  describe("copyOrLinkDirectory", () => {
    it("should copy a directory when useSymlinks is false", async () => {
      const sourceSubDir = join(sourceDir, "subdir");
      const targetSubDir = join(targetDir, "subdir");
      await mkdir(sourceSubDir);
      await writeFile(join(sourceSubDir, "file1.txt"), "content1");
      await writeFile(join(sourceSubDir, "file2.txt"), "content2");

      await copyOrLinkDirectory({
        sourcePath: sourceSubDir,
        targetPath: targetSubDir,
        useSymlinks: false
      });

      expect(existsSync(join(targetSubDir, "file1.txt"))).toBe(true);
      expect(existsSync(join(targetSubDir, "file2.txt"))).toBe(true);
      
      const content1 = await readFile(join(targetSubDir, "file1.txt"), "utf8");
      const content2 = await readFile(join(targetSubDir, "file2.txt"), "utf8");
      expect(content1).toBe("content1");
      expect(content2).toBe("content2");
    });

    it("should create symlinks for files when useSymlinks is true", async () => {
      const sourceSubDir = join(sourceDir, "subdir");
      const targetSubDir = join(targetDir, "subdir");
      await mkdir(sourceSubDir);
      await writeFile(join(sourceSubDir, "file1.txt"), "content1");

      await copyOrLinkDirectory({
        sourcePath: sourceSubDir,
        targetPath: targetSubDir,
        useSymlinks: true
      });

      expect(existsSync(join(targetSubDir, "file1.txt"))).toBe(true);
      const stat = await lstat(join(targetSubDir, "file1.txt"));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("should handle nested directories recursively", async () => {
      const sourceSubDir = join(sourceDir, "subdir");
      const sourceNestedDir = join(sourceSubDir, "nested");
      const targetSubDir = join(targetDir, "subdir");
      
      await mkdir(sourceNestedDir, { recursive: true });
      await writeFile(join(sourceNestedDir, "deep.txt"), "deep content");

      await copyOrLinkDirectory({
        sourcePath: sourceSubDir,
        targetPath: targetSubDir,
        useSymlinks: false
      });

      expect(existsSync(join(targetSubDir, "nested", "deep.txt"))).toBe(true);
      const content = await readFile(join(targetSubDir, "nested", "deep.txt"), "utf8");
      expect(content).toBe("deep content");
    });

    it("should skip if source directory doesn't exist", async () => {
      const sourceSubDir = join(sourceDir, "nonexistent");
      const targetSubDir = join(targetDir, "subdir");

      await copyOrLinkDirectory({
        sourcePath: sourceSubDir,
        targetPath: targetSubDir,
        useSymlinks: false
      });

      expect(existsSync(targetSubDir)).toBe(false);
    });

    it("should throw error if source is not a directory", async () => {
      const sourceFile = join(sourceDir, "test.txt");
      const targetSubDir = join(targetDir, "subdir");
      await writeFile(sourceFile, "test content");

      await expect(copyOrLinkDirectory({
        sourcePath: sourceFile,
        targetPath: targetSubDir,
        useSymlinks: false
      })).rejects.toThrow("is not a directory");
    });

    it("should create target directory if it doesn't exist", async () => {
      const sourceSubDir = join(sourceDir, "subdir");
      const targetSubDir = join(targetDir, "new", "nested", "subdir");
      await mkdir(sourceSubDir);
      await writeFile(join(sourceSubDir, "file.txt"), "content");

      await copyOrLinkDirectory({
        sourcePath: sourceSubDir,
        targetPath: targetSubDir,
        useSymlinks: false
      });

      expect(existsSync(join(targetSubDir, "file.txt"))).toBe(true);
    });
  });

  describe("processPath", () => {
    it("should process a file path", async () => {
      await writeFile(join(sourceDir, "test.txt"), "content");

      await processPath("test.txt", sourceDir, targetDir, false);

      expect(existsSync(join(targetDir, "test.txt"))).toBe(true);
      const content = await readFile(join(targetDir, "test.txt"), "utf8");
      expect(content).toBe("content");
    });

    it("should process a directory path", async () => {
      const subDir = join(sourceDir, "subdir");
      await mkdir(subDir);
      await writeFile(join(subDir, "file.txt"), "content");

      await processPath("subdir", sourceDir, targetDir, false);

      expect(existsSync(join(targetDir, "subdir", "file.txt"))).toBe(true);
      const content = await readFile(join(targetDir, "subdir", "file.txt"), "utf8");
      expect(content).toBe("content");
    });

    it("should create symlinks when useSymlinks is true", async () => {
      await writeFile(join(sourceDir, "test.txt"), "content");

      await processPath("test.txt", sourceDir, targetDir, true);

      expect(existsSync(join(targetDir, "test.txt"))).toBe(true);
      const stat = await lstat(join(targetDir, "test.txt"));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("should skip if source path doesn't exist", async () => {
      await processPath("nonexistent.txt", sourceDir, targetDir, false);

      expect(existsSync(join(targetDir, "nonexistent.txt"))).toBe(false);
    });

    it("should handle relative paths correctly", async () => {
      const nestedDir = join(sourceDir, "nested");
      await mkdir(nestedDir);
      await writeFile(join(nestedDir, "file.txt"), "content");

      await processPath("nested/file.txt", sourceDir, targetDir, false);

      expect(existsSync(join(targetDir, "nested", "file.txt"))).toBe(true);
      const content = await readFile(join(targetDir, "nested", "file.txt"), "utf8");
      expect(content).toBe("content");
    });
  });
});