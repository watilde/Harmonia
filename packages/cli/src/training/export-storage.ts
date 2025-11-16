/**
 * Export Storage System
 * Manages model outputs (exports) for import by dependent models
 */

import type { ModelExport } from '../types/harmonia-config';

export interface ExportData {
  modelId: string;
  exportName: string;
  data: Float32Array | number | Record<string, unknown>;
  metadata: ModelExport;
  timestamp: Date;
}

export interface ExportQuery {
  modelId: string;
  exportName: string;
}

/**
 * Storage for model exports
 * Stores outputs from trained models for use by dependent models
 */
export class ExportStorage {
  private storage: Map<string, Map<string, ExportData>>;

  constructor() {
    this.storage = new Map();
  }

  /**
   * Store an export from a model
   */
  storeExport(data: ExportData): void {
    const key = this.getStorageKey(data.modelId);

    if (!this.storage.has(key)) {
      this.storage.set(key, new Map());
    }

    const modelExports = this.storage.get(key)!;
    modelExports.set(data.exportName, data);
  }

  /**
   * Retrieve an export
   */
  getExport(query: ExportQuery): ExportData | undefined {
    const key = this.getStorageKey(query.modelId);
    const modelExports = this.storage.get(key);

    if (!modelExports) {
      return undefined;
    }

    return modelExports.get(query.exportName);
  }

  /**
   * Check if an export exists
   */
  hasExport(query: ExportQuery): boolean {
    const key = this.getStorageKey(query.modelId);
    const modelExports = this.storage.get(key);

    if (!modelExports) {
      return false;
    }

    return modelExports.has(query.exportName);
  }

  /**
   * Get all exports from a model
   */
  getModelExports(modelId: string): Map<string, ExportData> {
    const key = this.getStorageKey(modelId);
    return this.storage.get(key) || new Map();
  }

  /**
   * Get all export names from a model
   */
  getExportNames(modelId: string): string[] {
    const key = this.getStorageKey(modelId);
    const modelExports = this.storage.get(key);

    if (!modelExports) {
      return [];
    }

    return Array.from(modelExports.keys());
  }

  /**
   * Clear all exports from a model
   */
  clearModelExports(modelId: string): void {
    const key = this.getStorageKey(modelId);
    this.storage.delete(key);
  }

  /**
   * Clear all exports
   */
  clearAll(): void {
    this.storage.clear();
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalModels: number;
    totalExports: number;
    modelCounts: Map<string, number>;
  } {
    let totalExports = 0;
    const modelCounts = new Map<string, number>();

    for (const [modelId, exports] of this.storage.entries()) {
      const count = exports.size;
      totalExports += count;
      modelCounts.set(modelId, count);
    }

    return {
      totalModels: this.storage.size,
      totalExports,
      modelCounts,
    };
  }

  private getStorageKey(modelId: string): string {
    return modelId;
  }
}
