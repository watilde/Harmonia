/**
 * Configuration Loader
 * Loads and validates harmonia.json configuration
 */

import { FileOperations } from './file-operations';
import { validateHarmoniaConfig } from './dependency-resolver';
import type { HarmoniaConfig } from '../types/harmonia-config';

export interface ConfigLoadResult {
  success: boolean;
  config?: HarmoniaConfig;
  configPath?: string;
  error?: string;
}

/**
 * Load harmonia.json from the specified directory
 */
export async function loadHarmoniaConfig(
  directory: string = process.cwd()
): Promise<ConfigLoadResult> {
  // Look for harmonia.json
  const configPath = FileOperations.join(directory, 'harmonia.json');

  const exists = await FileOperations.exists(configPath);
  if (!exists) {
    return {
      success: false,
      error: `Configuration file not found: ${configPath}`,
    };
  }

  // Read configuration
  let config: HarmoniaConfig;
  try {
    config = await FileOperations.readJSON<HarmoniaConfig>(configPath);
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse configuration: ${(error as Error).message}`,
    };
  }

  // Validate configuration
  const validation = validateHarmoniaConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid configuration: ${validation.reason}`,
    };
  }

  return {
    success: true,
    config,
    configPath,
  };
}

/**
 * Load package.json from the specified directory
 */
export async function loadPackageJson(
  directory: string = process.cwd()
): Promise<Record<string, unknown> | null> {
  const packagePath = FileOperations.join(directory, 'package.json');

  const exists = await FileOperations.exists(packagePath);
  if (!exists) {
    return null;
  }

  try {
    return await FileOperations.readJSON<Record<string, unknown>>(packagePath);
  } catch {
    return null;
  }
}

/**
 * Check if directory is a Harmonia study
 */
export async function isHarmoniaStudy(directory: string = process.cwd()): Promise<boolean> {
  const harmoniaExists = await FileOperations.exists(
    FileOperations.join(directory, 'harmonia.json')
  );
  const packageExists = await FileOperations.exists(FileOperations.join(directory, 'package.json'));

  return harmoniaExists && packageExists;
}

/**
 * Get study metadata
 */
export async function getStudyMetadata(directory: string = process.cwd()): Promise<{
  name: string;
  version: string;
  description: string;
} | null> {
  const result = await loadHarmoniaConfig(directory);

  if (!result.success || !result.config) {
    return null;
  }

  return {
    name: result.config.name,
    version: result.config.version,
    description: result.config.description,
  };
}
