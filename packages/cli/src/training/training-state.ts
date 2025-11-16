/**
 * Training State Management
 * Manages the state of multi-model training execution
 */

import * as tf from '@tensorflow/tfjs-node';

import type { HarmoniaConfig } from '../types/harmonia-config';
import type { ModelWeights } from './model-builder';

export interface ModelResult {
  modelId: string;
  rounds: number;
  status: 'pending' | 'training' | 'completed' | 'failed';
  metrics?: {
    loss?: number;
    accuracy?: number;
    [key: string]: unknown;
  };
  error?: string;
}

export interface TrainingStateData {
  currentRound: number;
  currentLayer: number;
  currentModel: string | null;
  completedModels: Set<string>;
  modelResults: Map<string, ModelResult>;
  trainedModels: Map<string, tf.LayersModel>;
  modelWeights: Map<string, ModelWeights>;
}

/**
 * Manages training state across multiple models
 */
export class TrainingState {
  private state: TrainingStateData;

  constructor(config: HarmoniaConfig) {
    this.state = {
      currentRound: 0,
      currentLayer: 1,
      currentModel: null,
      completedModels: new Set(),
      modelResults: new Map(),
      trainedModels: new Map(),
      modelWeights: new Map(),
    };

    // Initialize model results
    for (const modelId of Object.keys(config.models)) {
      this.state.modelResults.set(modelId, {
        modelId,
        rounds: 0,
        status: 'pending',
      });
    }
  }

  /**
   * Get current state data
   */
  getData(): TrainingStateData {
    return this.state;
  }

  /**
   * Get model result
   */
  getModelResult(modelId: string): ModelResult | undefined {
    return this.state.modelResults.get(modelId);
  }

  /**
   * Update model result
   */
  updateModelResult(modelId: string, updates: Partial<ModelResult>): void {
    const current = this.state.modelResults.get(modelId);
    if (current) {
      this.state.modelResults.set(modelId, { ...current, ...updates });
    }
  }

  /**
   * Set model status
   */
  setModelStatus(modelId: string, status: 'pending' | 'training' | 'completed' | 'failed'): void {
    this.updateModelResult(modelId, { status });
  }

  /**
   * Mark model as completed
   */
  markModelCompleted(modelId: string, rounds: number): void {
    this.state.completedModels.add(modelId);
    this.updateModelResult(modelId, {
      status: 'completed',
      rounds,
    });
  }

  /**
   * Mark model as failed
   */
  markModelFailed(modelId: string, error: string): void {
    this.updateModelResult(modelId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Store trained model
   */
  storeTrainedModel(modelId: string, model: tf.LayersModel): void {
    this.state.trainedModels.set(modelId, model);
  }

  /**
   * Store model weights
   */
  storeModelWeights(modelId: string, weights: ModelWeights): void {
    this.state.modelWeights.set(modelId, weights);
  }

  /**
   * Get trained model
   */
  getTrainedModel(modelId: string): tf.LayersModel | undefined {
    return this.state.trainedModels.get(modelId);
  }

  /**
   * Get model weights
   */
  getModelWeights(modelId: string): ModelWeights | undefined {
    return this.state.modelWeights.get(modelId);
  }

  /**
   * Update current layer
   */
  setCurrentLayer(layer: number): void {
    this.state.currentLayer = layer;
  }

  /**
   * Update current model
   */
  setCurrentModel(modelId: string | null): void {
    this.state.currentModel = modelId;
  }

  /**
   * Update current round
   */
  setCurrentRound(round: number): void {
    this.state.currentRound = round;
  }

  /**
   * Get total models
   */
  getTotalModels(): number {
    return this.state.modelResults.size;
  }

  /**
   * Get completed models count
   */
  getCompletedCount(): number {
    return this.state.completedModels.size;
  }

  /**
   * Check if all models completed
   */
  isAllCompleted(): boolean {
    return this.state.completedModels.size === this.state.modelResults.size;
  }

  /**
   * Get all model results
   */
  getAllResults(): Map<string, ModelResult> {
    return this.state.modelResults;
  }

  /**
   * Store model metrics
   */
  storeModelMetrics(
    modelId: string,
    metrics: { loss?: number; accuracy?: number; [key: string]: unknown }
  ): void {
    this.updateModelResult(modelId, { metrics });
  }
}
