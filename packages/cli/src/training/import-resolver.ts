/**
 * Import Resolver
 * Resolves model imports by fetching required exports from storage
 */

import type { HarmoniaConfig, ModelConfig, ModelImport } from '../types/harmonia-config';
import type { ExportData, ExportQuery } from './export-storage';
import { ExportStorage } from './export-storage';

export interface ResolvedImport {
  localName: string;
  import: ModelImport;
  data: ExportData;
}

export interface ImportResolutionResult {
  modelId: string;
  imports: Map<string, ResolvedImport>;
  success: boolean;
  errors: string[];
}

/**
 * Helper to get model imports (supports both ES Module and legacy)
 */
function getModelImports(modelConfig: ModelConfig): Record<string, ModelImport> {
  // ES Module style imports
  if (modelConfig.imports) {
    return modelConfig.imports;
  }

  // Legacy dependencies - convert to imports
  if (modelConfig.dependencies) {
    const imports: Record<string, ModelImport> = {};
    for (const [depId] of Object.entries(modelConfig.dependencies)) {
      imports[depId] = {
        from: depId,
        export: 'default',
      };
    }
    return imports;
  }

  return {};
}

/**
 * Resolves imports for a model
 */
export class ImportResolver {
  private storage: ExportStorage;
  private config: HarmoniaConfig;

  constructor(config: HarmoniaConfig, storage: ExportStorage) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Resolve all imports for a model
   */
  resolveImports(modelId: string): ImportResolutionResult {
    const modelConfig = this.config.models[modelId];
    if (!modelConfig) {
      return {
        modelId,
        imports: new Map(),
        success: false,
        errors: [`Model ${modelId} not found in configuration`],
      };
    }

    const imports = getModelImports(modelConfig);
    const resolved = new Map<string, ResolvedImport>();
    const errors: string[] = [];

    for (const [localName, importSpec] of Object.entries(imports)) {
      const query: ExportQuery = {
        modelId: importSpec.from,
        exportName: importSpec.export,
      };

      // Check if export exists
      if (!this.storage.hasExport(query)) {
        errors.push(
          `Import '${localName}' in model '${modelId}' references missing export '${importSpec.export}' from model '${importSpec.from}'`
        );
        continue;
      }

      // Retrieve export data
      const exportData = this.storage.getExport(query);
      if (!exportData) {
        errors.push(
          `Failed to retrieve export '${importSpec.export}' from model '${importSpec.from}'`
        );
        continue;
      }

      resolved.set(localName, {
        localName,
        import: importSpec,
        data: exportData,
      });
    }

    return {
      modelId,
      imports: resolved,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if all imports for a model can be resolved
   */
  canResolveImports(modelId: string): boolean {
    const result = this.resolveImports(modelId);
    return result.success;
  }

  /**
   * Get list of missing imports for a model
   */
  getMissingImports(modelId: string): ExportQuery[] {
    const modelConfig = this.config.models[modelId];
    if (!modelConfig) {
      return [];
    }

    const imports = getModelImports(modelConfig);
    const missing: ExportQuery[] = [];

    for (const importSpec of Object.values(imports)) {
      const query: ExportQuery = {
        modelId: importSpec.from,
        exportName: importSpec.export,
      };

      if (!this.storage.hasExport(query)) {
        missing.push(query);
      }
    }

    return missing;
  }

  /**
   * Get import data as a dictionary for easy access
   */
  getImportData(modelId: string): Map<string, Float32Array | number | Record<string, unknown>> {
    const result = this.resolveImports(modelId);
    const data = new Map<string, Float32Array | number | Record<string, unknown>>();

    for (const [localName, resolved] of result.imports) {
      data.set(localName, resolved.data.data);
    }

    return data;
  }

  /**
   * Validate that all required imports are available
   */
  validateImports(modelId: string): { valid: boolean; errors: string[] } {
    const result = this.resolveImports(modelId);
    return {
      valid: result.success,
      errors: result.errors,
    };
  }
}
