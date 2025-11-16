/**
 * File system operations utility
 * Provides safe, consistent file I/O operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from './logger';

export class FileOperations {
  /**
   * Create a directory if it doesn't exist
   */
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Write JSON data to file with pretty formatting
   */
  static async writeJSON(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDirectoryExists(dir);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Read and parse JSON file
   */
  static async readJSON<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * Write text file
   */
  static async writeText(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDirectoryExists(dir);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Read text file
   */
  static async readText(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy file
   */
  static async copyFile(src: string, dest: string): Promise<void> {
    const dir = path.dirname(dest);
    await this.ensureDirectoryExists(dir);
    await fs.copyFile(src, dest);
  }

  /**
   * Delete file or directory
   */
  static async delete(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    } catch (error) {
      Logger.debug(`Failed to delete ${filePath}: ${error}`);
    }
  }

  /**
   * List directory contents
   */
  static async listDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }

  /**
   * Get absolute path
   */
  static resolve(...paths: string[]): string {
    return path.resolve(...paths);
  }

  /**
   * Join paths
   */
  static join(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Create a write stream for file
   */
  static async createWriteStream(
    filePath: string,
    options?: { flags?: string }
  ): Promise<NodeJS.WritableStream> {
    const fsSync = await import('fs');
    const dir = path.dirname(filePath);
    await this.ensureDirectoryExists(dir);
    return fsSync.createWriteStream(filePath, options);
  }
}
