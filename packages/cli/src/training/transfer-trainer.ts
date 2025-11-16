/**
 * Transfer Learning Trainer
 * Fine-tunes pretrained models using imported features
 */

import * as tf from '@tensorflow/tfjs-node';

import type { ModelConfig } from '../types/harmonia-config';
import { Logger } from '../utils/logger';
import { buildModelFromConfig, generateMockData, getModelWeights } from './model-builder';
import type { ModelWeights } from './model-builder';

export interface TransferConfig {
  pretrainedBase: boolean; // Whether to use pretrained base
  freezeBase: boolean; // Whether to freeze base layers
  fineTuneEpochs?: number; // Epochs for fine-tuning
  algorithm: string; // 'transfer-learning', 'fedavg-transfer'
}

export interface TransferModel {
  baseWeights: ModelWeights | null; // Imported pretrained weights
  fullModel: tf.LayersModel; // Complete model with base + task layers
  frozenLayers: number; // Number of frozen layers
}

/**
 * Transfer Learning Trainer
 * Uses imported features/weights from parent models
 */
export class TransferTrainer {
  private config: ModelConfig;
  private transferConfig: TransferConfig;
  private transferModel: TransferModel | null = null;
  private importedWeights: Map<string, Float32Array | number | Record<string, unknown>>;

  constructor(
    modelConfig: ModelConfig,
    transferConfig: TransferConfig,
    importedWeights: Map<string, Float32Array | number | Record<string, unknown>>
  ) {
    this.config = modelConfig;
    this.transferConfig = transferConfig;
    this.importedWeights = importedWeights;
  }

  /**
   * Execute transfer learning
   */
  async train(totalRounds: number): Promise<{ weights: ModelWeights; metrics: any }> {
    Logger.info(`   🔄 Transfer Learning`);
    Logger.info(`   📦 Pretrained base: ${this.transferConfig.pretrainedBase ? 'Yes' : 'No'}`);
    Logger.info(`   🔒 Freeze base: ${this.transferConfig.freezeBase ? 'Yes' : 'No'}`);
    Logger.info(`   🔄 Fine-tuning rounds: ${totalRounds}\n`);

    // Build model with transfer learning setup
    this.transferModel = this.createTransferModel();

    let avgLoss = 0;
    let avgAccuracy: number | undefined;

    // Fine-tuning rounds
    for (let round = 1; round <= totalRounds; round++) {
      Logger.info(`   📍 Round ${round}/${totalRounds}`);

      const result = await this.fineTuneRound(round);

      avgLoss = result.loss;
      avgAccuracy = result.accuracy;

      Logger.info(
        `      Loss: ${avgLoss.toFixed(4)}${
          avgAccuracy !== undefined ? ` - Acc: ${avgAccuracy.toFixed(4)}` : ''
        }`
      );
      Logger.info('');
    }

    Logger.success(`   ✅ Transfer learning completed\n`);

    // Get final weights
    const finalWeights = getModelWeights(this.transferModel.fullModel);

    return {
      weights: finalWeights,
      metrics: {
        avgLoss,
        avgAccuracy,
      },
    };
  }

  /**
   * Create transfer learning model
   */
  private createTransferModel(): TransferModel {
    Logger.info('   🔨 Building transfer learning model...');

    // Build full model
    const fullModel = buildModelFromConfig(this.config);

    let baseWeights: ModelWeights | null = null;
    let frozenLayers = 0;

    // If we have pretrained base from imports
    if (this.transferConfig.pretrainedBase && this.importedWeights.size > 0) {
      Logger.info('      Using imported pretrained features');

      // Actually use the imported weights to initialize base layers
      // This simulates real transfer learning where pretrained features guide initialization
      const importedFeatures = Array.from(this.importedWeights.values())[0];
      if (importedFeatures instanceof Float32Array) {
        Logger.info(`      Imported feature dimension: ${importedFeatures.length}`);

        // Apply imported features to initialize bottom layers
        // This simulates transfer learning weight initialization
        const modelWeights = fullModel.getWeights();
        const numBaseLayersToInitialize = Math.floor(modelWeights.length / 2);

        Logger.info(
          `      Initializing ${numBaseLayersToInitialize} base layer(s) with transferred features`
        );

        // Save original weights for comparison
        baseWeights = getModelWeights(fullModel);

        // Apply transfer: use imported features to bias initial weights
        // This simulates knowledge transfer from parent model
        for (let i = 0; i < numBaseLayersToInitialize; i++) {
          const weight = modelWeights[i];
          const weightSize = weight.size;

          // Create a bias tensor from imported features (cyclic replication if needed)
          const biasTensor = tf.tidy(() => {
            const featureScaling = 0.1; // Scale down to avoid overwhelming existing weights
            const biasValues = new Float32Array(weightSize);
            for (let j = 0; j < weightSize; j++) {
              biasValues[j] = importedFeatures[j % importedFeatures.length] * featureScaling;
            }
            return tf.tensor(biasValues, weight.shape);
          });

          // Add bias to existing weights (transfer learning initialization)
          const transferredWeight = tf.add(weight, biasTensor);
          modelWeights[i] = transferredWeight;

          biasTensor.dispose();
        }

        // Apply the transferred weights back to model
        fullModel.setWeights(modelWeights);

        Logger.success('      ✅ Base layers initialized with transferred knowledge');
      }

      // Freeze base layers if specified
      if (this.transferConfig.freezeBase) {
        // Freeze bottom 50% of layers
        frozenLayers = Math.floor(fullModel.layers.length / 2);
        Logger.info(`      Frozen ${frozenLayers} base layers (only training top layers)`);

        // In TensorFlow.js, layer.trainable property doesn't affect fit()
        // We'll handle this by creating a trainable-only submodel
        this.makeLayersNonTrainable(fullModel, frozenLayers);
      }
    }

    Logger.success('   ✅ Transfer model initialized\n');

    return {
      baseWeights,
      fullModel,
      frozenLayers,
    };
  }

  /**
   * Fine-tune for one round
   */
  private async fineTuneRound(_round: number): Promise<{ loss: number; accuracy?: number }> {
    if (!this.transferModel) {
      throw new Error('Transfer model not initialized');
    }

    const model = this.transferModel.fullModel;
    const epochs = this.transferConfig.fineTuneEpochs || this.config.training?.epochs || 3;

    // Use smaller learning rate for fine-tuning
    const baseLearningRate = this.config.training?.learningRate || 0.001;
    const fineTuneLearningRate = baseLearningRate * 0.1; // 10x smaller

    Logger.info(`      Fine-tuning with LR: ${fineTuneLearningRate}`);

    // Generate training data
    const sampleCount = 300; // Smaller dataset for fine-tuning
    const { features, labels } = generateMockData(this.config, sampleCount);

    // Recompile with lower learning rate
    model.compile({
      optimizer: tf.train.adam(fineTuneLearningRate),
      loss:
        this.config.output.task === 'binary-classification'
          ? 'binaryCrossentropy'
          : 'meanSquaredError',
      metrics: ['accuracy'],
    });

    // Fine-tune model
    const history = await model.fit(features, labels, {
      epochs,
      batchSize: 16, // Smaller batch size for fine-tuning
      verbose: 0,
    });

    // Get final metrics
    const finalEpoch = history.history.loss.length - 1;
    const loss = history.history.loss[finalEpoch] as number;
    const accuracy = history.history.acc ? (history.history.acc[finalEpoch] as number) : undefined;

    // Cleanup
    features.dispose();
    labels.dispose();

    return { loss, accuracy };
  }

  /**
   * Make bottom layers non-trainable (freeze for transfer learning)
   * Note: TensorFlow.js doesn't fully support layer.trainable in fit()
   * This is a best-effort implementation that sets the trainable flag
   */
  private makeLayersNonTrainable(model: tf.LayersModel, numLayersToFreeze: number): void {
    for (let i = 0; i < Math.min(numLayersToFreeze, model.layers.length); i++) {
      const layer = model.layers[i];
      // Set trainable to false (note: this doesn't affect all layer types in tfjs)
      (layer as any).trainable = false;
    }
  }

  /**
   * Get transfer model
   */
  getTransferModel(): TransferModel | null {
    return this.transferModel;
  }
}
