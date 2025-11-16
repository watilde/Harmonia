/**
 * Training Orchestrator
 * Manages multi-model federated learning execution with import/export support
 */

import type { HarmoniaConfig } from '../types/harmonia-config';
import { generateTrainingPlan, getModelsByLayer } from '../utils/dependency-resolver';
import { ExportManager } from './export-manager';
import { ExportStorage } from './export-storage';
import { ImportResolver } from './import-resolver';
import { ModelTrainer } from './model-trainer';
import type { TrainingOptions } from './model-trainer';
import { PipelineExecutor } from './pipeline-executor';
import { TrainingLogger } from './training-logger';
import { TrainingState } from './training-state';
import type { TrainingStateData } from './training-state';

export type { TrainingOptions } from './model-trainer';
export type { TrainingStateData as TrainingState } from './training-state';
export type { ModelResult } from './training-state';

/**
 * Orchestrates multi-model training with dependency management
 */
export class TrainingOrchestrator {
  private config: HarmoniaConfig;
  private options: TrainingOptions;

  // Component instances
  private state: TrainingState;
  private logger: TrainingLogger;
  private exportStorage: ExportStorage;
  private importResolver: ImportResolver;
  private pipelineExecutor: PipelineExecutor;
  private exportManager: ExportManager;
  private modelTrainer: ModelTrainer;

  constructor(config: HarmoniaConfig, options: TrainingOptions = {}) {
    this.config = config;
    this.options = options;

    // Initialize components
    this.state = new TrainingState(config);
    this.logger = new TrainingLogger(config, options.verbose || false);
    this.exportStorage = new ExportStorage();
    this.importResolver = new ImportResolver(config, this.exportStorage);
    this.pipelineExecutor = new PipelineExecutor();
    this.exportManager = new ExportManager(this.exportStorage, this.state);
    this.modelTrainer = new ModelTrainer(
      config,
      this.state,
      options,
      this.logger,
      this.importResolver,
      this.pipelineExecutor,
      this.exportManager
    );
  }

  /**
   * Execute training
   */
  async execute(): Promise<void> {
    this.logger.logTrainingStart(this.options.dryRun || false);

    // Generate training plan
    const trainingPlan = generateTrainingPlan(this.config);
    const modelsByLayer = getModelsByLayer(this.config);

    this.logger.logTrainingPlan(
      trainingPlan.totalLayers,
      this.config.training.totalRounds,
      this.config.training.strategy
    );

    // Execute layer by layer
    for (let layer = 1; layer <= trainingPlan.totalLayers; layer++) {
      this.state.setCurrentLayer(layer);
      const modelsInLayer = modelsByLayer.get(layer) || [];

      this.logger.logLayerStart(layer, trainingPlan.totalLayers, modelsInLayer);

      // Get rounds for this layer
      const layerPlan = trainingPlan.layers.find((l) => l.layer === layer);
      const roundsPerModel = layerPlan?.roundsPerModel || 1;

      // Train models in this layer
      if (layerPlan?.parallelizable && modelsInLayer.length > 1) {
        this.logger.logParallelTraining();
        await this.trainModelsInParallel(modelsInLayer, roundsPerModel);
      } else {
        await this.trainModelsSequentially(modelsInLayer, roundsPerModel);
      }
    }

    // Print final summary
    this.logger.printSummary(this.state, this.exportStorage);
  }

  /**
   * Train models sequentially
   */
  private async trainModelsSequentially(modelIds: string[], rounds: number): Promise<void> {
    for (const modelId of modelIds) {
      await this.modelTrainer.trainModel(modelId, rounds);
    }
  }

  /**
   * Train models in parallel
   * Executes multiple independent models concurrently using Promise.all
   */
  private async trainModelsInParallel(modelIds: string[], rounds: number): Promise<void> {
    // Execute all models in parallel
    const trainingPromises = modelIds.map(async (modelId) => {
      try {
        await this.modelTrainer.trainModel(modelId, rounds);
      } catch (error) {
        // Re-throw with model context for better error handling
        throw new Error(`Failed to train model '${modelId}': ${(error as Error).message}`);
      }
    });

    // Wait for all models to complete
    await Promise.all(trainingPromises);
  }

  /**
   * Get export storage (for testing/debugging)
   */
  getExportStorage(): ExportStorage {
    return this.exportStorage;
  }

  /**
   * Get current state
   */
  getState(): TrainingStateData {
    return this.state.getData();
  }
}
