/**
 * Model Trainer
 * Handles training of individual models
 */

import * as tf from '@tensorflow/tfjs-node';

import type { HarmoniaConfig, ModelConfig } from '../types/harmonia-config';
import type { ExportManager } from './export-manager';
import { FederatedTrainer } from './federated-trainer';
import type { FederatedConfig } from './federated-trainer';
import { HybridTrainer } from './hybrid-trainer';
import type { HybridConfig } from './hybrid-trainer';
import type { ImportResolver } from './import-resolver';
import { buildModelFromConfig, generateMockData, getModelWeights } from './model-builder';
import type { PipelineExecutor } from './pipeline-executor';
import { TransferTrainer } from './transfer-trainer';
import type { TransferConfig } from './transfer-trainer';
import type { TrainingLogger } from './training-logger';
import type { TrainingState } from './training-state';
import { VerticalTrainer } from './vertical-trainer';
import type { VerticalConfig } from './vertical-trainer';

export interface TrainingOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Trains individual models with import/export support
 */
export class ModelTrainer {
  private config: HarmoniaConfig;
  private state: TrainingState;
  private options: TrainingOptions;
  private logger: TrainingLogger;
  private importResolver: ImportResolver;
  private pipelineExecutor: PipelineExecutor;
  private exportManager: ExportManager;

  constructor(
    config: HarmoniaConfig,
    state: TrainingState,
    options: TrainingOptions,
    logger: TrainingLogger,
    importResolver: ImportResolver,
    pipelineExecutor: PipelineExecutor,
    exportManager: ExportManager
  ) {
    this.config = config;
    this.state = state;
    this.options = options;
    this.logger = logger;
    this.importResolver = importResolver;
    this.pipelineExecutor = pipelineExecutor;
    this.exportManager = exportManager;
  }

  /**
   * Train a single model
   */
  async trainModel(modelId: string, rounds: number): Promise<void> {
    const modelConfig = this.config.models[modelId];

    this.logger.logModelTrainingStart(modelId, modelConfig, rounds);

    this.state.setModelStatus(modelId, 'training');
    this.state.setCurrentModel(modelId);

    // Check for imports and pipeline
    const hasImports = modelConfig.imports && Object.keys(modelConfig.imports).length > 0;
    const hasPipeline = modelConfig.pipeline !== undefined;

    // Resolve imports before training
    if (hasImports) {
      if (!this.resolveImports(modelId)) {
        return; // Failed, state already updated
      }
    }

    // Handle dry run mode
    if (this.options.dryRun) {
      this.handleDryRun(modelId, modelConfig, rounds);
      return;
    }

    // Execute pipeline if present
    if (hasPipeline && hasImports) {
      if (!this.executePipeline(modelId, modelConfig)) {
        return; // Failed, state already updated
      }
    }

    // Build and train actual model
    try {
      await this.trainModelActual(modelId, modelConfig, rounds);
    } catch (error) {
      this.logger.logTrainingFailure((error as Error).message);
      this.state.markModelFailed(modelId, (error as Error).message);
      return;
    }

    // Store exports after training
    if (modelConfig.exports) {
      this.exportManager.storeModelExports(modelId, modelConfig);
      this.logger.logExportsStored(Object.keys(modelConfig.exports).length);
    }

    this.state.markModelCompleted(modelId, rounds);
    this.logger.logModelCompletion(modelId);
  }

  /**
   * Resolve imports for a model
   */
  private resolveImports(modelId: string): boolean {
    this.logger.logImportResolution();

    const validation = this.importResolver.validateImports(modelId);
    if (!validation.valid) {
      this.logger.logImportResolutionFailure(validation.errors);
      this.state.markModelFailed(modelId, 'Import resolution failed');
      return false;
    }

    this.logger.logImportResolutionSuccess();
    return true;
  }

  /**
   * Handle dry run mode
   */
  private handleDryRun(modelId: string, modelConfig: ModelConfig, rounds: number): void {
    this.logger.logDryRunSkip();

    // In dry run, generate mock exports
    if (modelConfig.exports) {
      this.exportManager.generateMockExports(modelId, modelConfig);
      this.logger.logDryRunExports(Object.keys(modelConfig.exports).length);
    }

    this.state.markModelCompleted(modelId, rounds);
  }

  /**
   * Execute pipeline
   */
  private executePipeline(modelId: string, modelConfig: ModelConfig): boolean {
    this.logger.logPipelineExecution();

    const importData = this.importResolver.getImportData(modelId);
    const pipelineResult = this.pipelineExecutor.executePipeline(modelConfig.pipeline!, importData);

    if (!pipelineResult.success) {
      this.logger.logPipelineFailure(pipelineResult.errors);
      this.state.markModelFailed(modelId, 'Pipeline execution failed');
      return false;
    }

    this.logger.logPipelineSuccess();
    return true;
  }

  /**
   * Train model with appropriate trainer based on architecture
   */
  private async trainModelActual(
    modelId: string,
    modelConfig: ModelConfig,
    rounds: number
  ): Promise<void> {
    const architecture = modelConfig.federation.architecture;
    const algorithm = modelConfig.federation.algorithm;

    // Select trainer based on architecture
    if (architecture === 'horizontal') {
      await this.trainHorizontal(modelId, modelConfig, rounds);
    } else if (architecture === 'vertical') {
      await this.trainVertical(modelId, modelConfig, rounds);
    } else if (architecture === 'transfer') {
      await this.trainTransfer(modelId, modelConfig, rounds);
    } else if (algorithm === 'hierarchical-fedavg' || algorithm === 'hybrid-split') {
      await this.trainHybrid(modelId, modelConfig, rounds);
    } else {
      await this.trainCentralized(modelId, modelConfig, rounds);
    }
  }

  /**
   * Train with horizontal federated learning (FedAvg, FedProx)
   */
  private async trainHorizontal(
    modelId: string,
    modelConfig: ModelConfig,
    rounds: number
  ): Promise<void> {
    // Get config from modelConfig.federation.config or use defaults
    const fedConfig: FederatedConfig = {
      numClients: (modelConfig.federation.config?.numClients as number) || 5,
      clientsPerRound: (modelConfig.federation.config?.clientsPerRound as number) || 3,
      algorithm: modelConfig.federation.algorithm,
      aggregationStrategy:
        (modelConfig.federation.config?.aggregationStrategy as 'weighted' | 'uniform') ||
        'weighted',
    };

    // Create federated trainer
    const trainer = new FederatedTrainer(modelConfig, fedConfig);

    // Execute federated training
    const globalModel = await trainer.train(rounds);

    // Store global model
    const model = buildModelFromConfig(modelConfig);
    model.setWeights(
      globalModel.weights.shapes.map((shape, i) => tf.tensor(globalModel.weights.data[i], shape))
    );

    this.state.storeTrainedModel(modelId, model);
    this.state.storeModelWeights(modelId, globalModel.weights);

    // Store metrics
    this.state.storeModelMetrics(modelId, {
      loss: globalModel.metrics.avgLoss,
      accuracy: globalModel.metrics.avgAccuracy,
    });

    this.logger.logFederatedTrainingComplete(
      globalModel.metrics.avgLoss,
      globalModel.metrics.avgAccuracy
    );
  }

  /**
   * Train with vertical federated learning (Split Learning)
   */
  private async trainVertical(
    modelId: string,
    modelConfig: ModelConfig,
    rounds: number
  ): Promise<void> {
    const verticalConfig: VerticalConfig = {
      numParties: (modelConfig.federation.config?.numParties as number) || 2,
      splitPoint:
        (modelConfig.federation.config?.splitPoint as 'middle' | 'early' | 'late' | number) ||
        'middle',
      algorithm: modelConfig.federation.algorithm,
    };

    const trainer = new VerticalTrainer(modelConfig, verticalConfig);
    const result = await trainer.train(rounds);

    // Store model
    const model = buildModelFromConfig(modelConfig);
    model.setWeights(
      result.weights.shapes.map((shape, i) => tf.tensor(result.weights.data[i], shape))
    );

    this.state.storeTrainedModel(modelId, model);
    this.state.storeModelWeights(modelId, result.weights);

    // Store metrics
    this.state.storeModelMetrics(modelId, {
      loss: result.metrics.avgLoss,
      accuracy: result.metrics.avgAccuracy,
    });

    this.logger.logFederatedTrainingComplete(result.metrics.avgLoss, result.metrics.avgAccuracy);
  }

  /**
   * Train with transfer learning
   */
  private async trainTransfer(
    modelId: string,
    modelConfig: ModelConfig,
    rounds: number
  ): Promise<void> {
    const transferConfig: TransferConfig = {
      pretrainedBase: (modelConfig.federation.config?.pretrainedBase as boolean) || true,
      freezeBase: (modelConfig.federation.config?.freezeBase as boolean) || false,
      fineTuneEpochs: (modelConfig.federation.config?.fineTuneEpochs as number) || undefined,
      algorithm: modelConfig.federation.algorithm,
    };

    // Get imported weights
    const importedWeights = this.importResolver.getImportData(modelId);

    const trainer = new TransferTrainer(modelConfig, transferConfig, importedWeights);
    const result = await trainer.train(rounds);

    // Store model
    const model = buildModelFromConfig(modelConfig);
    model.setWeights(
      result.weights.shapes.map((shape, i) => tf.tensor(result.weights.data[i], shape))
    );

    this.state.storeTrainedModel(modelId, model);
    this.state.storeModelWeights(modelId, result.weights);

    // Store metrics
    this.state.storeModelMetrics(modelId, {
      loss: result.metrics.avgLoss,
      accuracy: result.metrics.avgAccuracy,
    });

    this.logger.logFederatedTrainingComplete(result.metrics.avgLoss, result.metrics.avgAccuracy);
  }

  /**
   * Train with hybrid/hierarchical federated learning
   */
  private async trainHybrid(
    modelId: string,
    modelConfig: ModelConfig,
    rounds: number
  ): Promise<void> {
    const hybridConfig: HybridConfig = {
      primaryArchitecture:
        (modelConfig.federation.config?.primaryArchitecture as
          | 'horizontal'
          | 'vertical'
          | 'hierarchical') || 'hierarchical',
      secondaryArchitecture: modelConfig.federation.config?.secondaryArchitecture as
        | 'horizontal'
        | 'vertical'
        | undefined,
      numTiers: (modelConfig.federation.config?.numTiers as number) || undefined,
      clientsPerTier: (modelConfig.federation.config?.clientsPerTier as number[]) || undefined,
      aggregationStrategy:
        (modelConfig.federation.config?.aggregationStrategy as 'weighted' | 'uniform' | 'tiered') ||
        'weighted',
      algorithm: modelConfig.federation.algorithm,
    };

    const trainer = new HybridTrainer(modelConfig, hybridConfig);
    const result = await trainer.train(rounds);

    // Store model
    const model = buildModelFromConfig(modelConfig);
    model.setWeights(
      result.weights.shapes.map((shape, i) => tf.tensor(result.weights.data[i], shape))
    );

    this.state.storeTrainedModel(modelId, model);
    this.state.storeModelWeights(modelId, result.weights);

    // Store metrics
    this.state.storeModelMetrics(modelId, {
      loss: result.metrics.avgLoss,
      accuracy: result.metrics.avgAccuracy,
    });

    this.logger.logFederatedTrainingComplete(result.metrics.avgLoss, result.metrics.avgAccuracy);
  }

  /**
   * Train with centralized learning (single model)
   */
  private async trainCentralized(
    modelId: string,
    modelConfig: ModelConfig,
    rounds: number
  ): Promise<void> {
    // Build model
    this.logger.logModelBuilding();
    const model = buildModelFromConfig(modelConfig);
    this.logger.logModelBuilt(model.layers.length);

    // Generate mock training data
    this.logger.logDataGeneration();
    const { features, labels } = generateMockData(modelConfig, 1000);
    this.logger.logDataReady();

    // Train model
    this.logger.logCentralizedTrainingStart(rounds);
    const history = await model.fit(features, labels, {
      epochs: rounds,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (logs) {
            this.logger.logEpochProgress(epoch, rounds, {
              loss: logs.loss as number,
              val_loss: logs.val_loss as number | undefined,
              acc: logs.acc as number | undefined,
              val_acc: logs.val_acc as number | undefined,
            });
          }
        },
      },
    });

    process.stdout.write('\n');

    // Store model and weights
    this.state.storeTrainedModel(modelId, model);
    this.state.storeModelWeights(modelId, getModelWeights(model));

    // Get final metrics
    const finalEpoch = history.history.loss.length - 1;
    const loss = history.history.loss[finalEpoch] as number;
    const accuracy = history.history.acc ? (history.history.acc[finalEpoch] as number) : undefined;

    this.state.storeModelMetrics(modelId, { loss, accuracy });

    // Cleanup
    features.dispose();
    labels.dispose();

    this.logger.logCentralizedTrainingComplete(loss, accuracy);
  }
}
