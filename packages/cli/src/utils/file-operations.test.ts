/**
 * Tests for FileOperations utility
 */

import { FileOperations } from './../utils/file-operations';
import * as path from 'path';

describe('FileOperations', () => {
  const testDir = path.join(__dirname, '__test-files__');

  beforeAll(async () => {
    await FileOperations.ensureDirectoryExists(testDir);
  });

  afterAll(async () => {
    await FileOperations.delete(testDir);
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'new-directory');
      await FileOperations.ensureDirectoryExists(newDir);
      expect(await FileOperations.exists(newDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await FileOperations.ensureDirectoryExists(testDir);
      await FileOperations.ensureDirectoryExists(testDir);
      expect(await FileOperations.exists(testDir)).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');
      await FileOperations.ensureDirectoryExists(nestedDir);
      expect(await FileOperations.exists(nestedDir)).toBe(true);
    });
  });

  describe('writeJSON and readJSON', () => {
    it('should write and read JSON data', async () => {
      const filePath = path.join(testDir, 'test.json');
      const data = { name: 'test', value: 123 };

      await FileOperations.writeJSON(filePath, data);
      const result = await FileOperations.readJSON(filePath);

      expect(result).toEqual(data);
    });

    it('should format JSON with indentation', async () => {
      const filePath = path.join(testDir, 'formatted.json');
      const data = { nested: { value: 'test' } };

      await FileOperations.writeJSON(filePath, data);
      const content = await FileOperations.readText(filePath);

      expect(content).toContain('  '); // Check for indentation
    });

    it('should handle complex objects', async () => {
      const filePath = path.join(testDir, 'complex.json');
      const data = {
        array: [1, 2, 3],
        nested: { key: 'value' },
        null: null,
        boolean: true,
      };

      await FileOperations.writeJSON(filePath, data);
      const result = await FileOperations.readJSON(filePath);

      expect(result).toEqual(data);
    });
  });

  describe('writeText and readText', () => {
    it('should write and read text', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const text = 'Hello, World!';

      await FileOperations.writeText(filePath, text);
      const result = await FileOperations.readText(filePath);

      expect(result).toBe(text);
    });

    it('should handle multiline text', async () => {
      const filePath = path.join(testDir, 'multiline.txt');
      const text = 'Line 1\nLine 2\nLine 3';

      await FileOperations.writeText(filePath, text);
      const result = await FileOperations.readText(filePath);

      expect(result).toBe(text);
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      const filePath = path.join(testDir, 'exists.txt');
      await FileOperations.writeText(filePath, 'content');

      expect(await FileOperations.exists(filePath)).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const filePath = path.join(testDir, 'does-not-exist.txt');
      expect(await FileOperations.exists(filePath)).toBe(false);
    });

    it('should return true for existing directories', async () => {
      expect(await FileOperations.exists(testDir)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete files', async () => {
      const filePath = path.join(testDir, 'to-delete.txt');
      await FileOperations.writeText(filePath, 'content');

      await FileOperations.delete(filePath);
      expect(await FileOperations.exists(filePath)).toBe(false);
    });

    it('should delete directories recursively', async () => {
      const dirPath = path.join(testDir, 'to-delete-dir');
      const filePath = path.join(dirPath, 'file.txt');

      await FileOperations.ensureDirectoryExists(dirPath);
      await FileOperations.writeText(filePath, 'content');

      await FileOperations.delete(dirPath);
      expect(await FileOperations.exists(dirPath)).toBe(false);
    });

    it('should not throw if file does not exist', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      await expect(FileOperations.delete(filePath)).resolves.not.toThrow();
    });
  });

  describe('copyFile', () => {
    it('should copy files', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const destPath = path.join(testDir, 'destination.txt');
      const content = 'File content';

      await FileOperations.writeText(sourcePath, content);
      await FileOperations.copyFile(sourcePath, destPath);

      const result = await FileOperations.readText(destPath);
      expect(result).toBe(content);
    });

    it('should create destination directory if needed', async () => {
      const sourcePath = path.join(testDir, 'source2.txt');
      const destPath = path.join(testDir, 'subdir', 'destination.txt');

      await FileOperations.writeText(sourcePath, 'content');
      await FileOperations.copyFile(sourcePath, destPath);

      expect(await FileOperations.exists(destPath)).toBe(true);
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      const dirPath = path.join(testDir, 'list-test');
      await FileOperations.ensureDirectoryExists(dirPath);
      await FileOperations.writeText(path.join(dirPath, 'file1.txt'), 'content1');
      await FileOperations.writeText(path.join(dirPath, 'file2.txt'), 'content2');

      const files = await FileOperations.listDirectory(dirPath);

      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for non-existent directory', async () => {
      const dirPath = path.join(testDir, 'non-existent-dir');
      const files = await FileOperations.listDirectory(dirPath);

      expect(files).toEqual([]);
    });
  });

  describe('resolve and join', () => {
    it('should resolve absolute paths', () => {
      const result = FileOperations.resolve('test', 'path');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should join paths correctly', () => {
      const result = FileOperations.join('dir1', 'dir2', 'file.txt');
      expect(result).toBe(path.join('dir1', 'dir2', 'file.txt'));
    });
  });
});
