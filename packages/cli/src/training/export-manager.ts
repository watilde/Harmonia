/**
 * Export Manager
 * Manages export data generation from trained models
 */

import * as tf from '@tensorflow/tfjs-node';

import type { ModelConfig } from '../types/harmonia-config';
import type { ExportData, ExportStorage } from './export-storage';
import type { TrainingState } from './training-state';

/**
 * Manages export generation and storage
 */
export class ExportManager {
  private exportStorage: ExportStorage;
  private state: TrainingState;

  constructor(exportStorage: ExportStorage, state: TrainingState) {
    this.exportStorage = exportStorage;
    this.state = state;
  }

  /**
   * Store exports from a trained model
   */
  storeModelExports(modelId: string, modelConfig: ModelConfig): void {
    if (!modelConfig.exports) {
      return;
    }

    const model = this.state.getTrainedModel(modelId);
    if (!model) {
      // Fallback to mock data if model not available
      this.generateMockExports(modelId, modelConfig);
      return;
    }

    for (const [exportName, exportSpec] of Object.entries(modelConfig.exports)) {
      let data: Float32Array | number | Record<string, unknown>;

      if (exportSpec.type === 'tensor') {
        // Get model output for this export
        data = this.getModelOutput(model, exportSpec);
      } else if (exportSpec.type === 'scalar') {
        // Extract scalar metric (e.g., loss, accuracy)
        const modelResult = this.state.getModelResult(modelId);
        data = modelResult?.metrics?.loss || 0;
      } else {
        data = { value: 'model-output' };
      }

      const exportData: ExportData = {
        modelId,
        exportName,
        data,
        metadata: exportSpec,
        timestamp: new Date(),
      };

      this.exportStorage.storeExport(exportData);
    }
  }

  /**
   * Generate mock exports for dry run mode
   */
  generateMockExports(modelId: string, modelConfig: ModelConfig): void {
    if (!modelConfig.exports) {
      return;
    }

    for (const [exportName, exportSpec] of Object.entries(modelConfig.exports)) {
      let data: Float32Array | number | Record<string, unknown>;

      if (exportSpec.type === 'tensor') {
        const size = exportSpec.shape ? exportSpec.shape.reduce((a, b) => a * b, 1) : 128;
        data = new Float32Array(size);
      } else if (exportSpec.type === 'scalar') {
        data = 0;
      } else {
        data = { mock: true };
      }

      const exportData: ExportData = {
        modelId,
        exportName,
        data,
        metadata: exportSpec,
        timestamp: new Date(),
      };

      this.exportStorage.storeExport(exportData);
    }
  }

  /**
   * Get model output for export
   */
  private getModelOutput(model: tf.LayersModel, _exportSpec: any): Float32Array {
    // Get model's expected input shape
    const inputShape = model.inputs[0].shape;
    const inputSize = inputShape[inputShape.length - 1]; // Get last dimension

    // Generate sample input with correct size
    const sampleInput = tf.randomNormal([1, inputSize as number]);

    // Get model prediction
    const prediction = model.predict(sampleInput) as tf.Tensor;
    const data = prediction.dataSync() as Float32Array;

    // Cleanup
    sampleInput.dispose();
    prediction.dispose();

    return data;
  }

  /**
   * Get export storage
   */
  getStorage(): ExportStorage {
    return this.exportStorage;
  }
}
