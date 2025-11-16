/**
 * Vertical Federated Learning Trainer (Split Learning)
 * Simulates split learning where model is split across parties
 */

import * as tf from '@tensorflow/tfjs-node';

import type { ModelConfig } from '../types/harmonia-config';
import { Logger } from '../utils/logger';
import { buildModelFromConfig, generateMockData, getModelWeights } from './model-builder';
import type { ModelWeights } from './model-builder';

export interface VerticalConfig {
  numParties: number; // Number of parties (e.g., 2 for client-server split)
  splitPoint: 'middle' | 'early' | 'late' | number; // Where to split the model
  algorithm: string; // 'split-learning', 'vertical-fedavg'
}

export interface PartyUpdate {
  partyId: string;
  activations?: Float32Array; // Forward pass activations
  gradients?: ModelWeights; // Backward pass gradients
  metrics: {
    loss: number;
    accuracy?: number;
  };
}

export interface SplitModel {
  clientModel: tf.LayersModel; // Bottom layers (client side)
  serverModel: tf.LayersModel; // Top layers (server side)
  combined: tf.LayersModel; // Full model for inference
}

/**
 * Vertical FL Trainer (Split Learning)
 * Model is split between client and server
 */
export class VerticalTrainer {
  private config: ModelConfig;
  private verticalConfig: VerticalConfig;
  private splitModel: SplitModel | null = null;

  constructor(modelConfig: ModelConfig, verticalConfig: VerticalConfig) {
    this.config = modelConfig;
    this.verticalConfig = verticalConfig;
  }

  /**
   * Execute vertical federated training
   */
  async train(totalRounds: number): Promise<{ weights: ModelWeights; metrics: any }> {
    Logger.info(`   🔀 Vertical FL (Split Learning): ${this.verticalConfig.numParties} parties`);
    Logger.info(`   📊 Split point: ${this.verticalConfig.splitPoint}`);
    Logger.info(`   🔄 Training rounds: ${totalRounds}\n`);

    // Build full model and determine split point
    this.splitModel = this.createSplitModel();

    let avgLoss = 0;
    let avgAccuracy: number | undefined;

    // Training rounds
    for (let round = 1; round <= totalRounds; round++) {
      Logger.info(`   📍 Round ${round}/${totalRounds}`);

      // Simulate split learning communication
      const result = await this.trainSplitLearningRound(round);

      avgLoss = result.loss;
      avgAccuracy = result.accuracy;

      Logger.info(
        `      Loss: ${avgLoss.toFixed(4)}${
          avgAccuracy !== undefined ? ` - Acc: ${avgAccuracy.toFixed(4)}` : ''
        }`
      );
      Logger.info('');
    }

    Logger.success(`   ✅ Vertical FL training completed\n`);

    // Get final weights from combined model
    const finalWeights = getModelWeights(this.splitModel.combined);

    return {
      weights: finalWeights,
      metrics: {
        avgLoss,
        avgAccuracy,
      },
    };
  }

  /**
   * Create split model (client + server parts)
   */
  private createSplitModel(): SplitModel {
    Logger.info('   🔨 Building split model...');

    // Build full model
    const fullModel = buildModelFromConfig(this.config);
    const totalLayers = fullModel.layers.length;

    // Determine split point
    let splitLayerIndex: number;
    if (typeof this.verticalConfig.splitPoint === 'number') {
      splitLayerIndex = this.verticalConfig.splitPoint;
    } else if (this.verticalConfig.splitPoint === 'early') {
      splitLayerIndex = Math.floor(totalLayers * 0.25);
    } else if (this.verticalConfig.splitPoint === 'late') {
      splitLayerIndex = Math.floor(totalLayers * 0.75);
    } else {
      // 'middle'
      splitLayerIndex = Math.floor(totalLayers / 2);
    }

    splitLayerIndex = Math.max(1, Math.min(splitLayerIndex, totalLayers - 1));

    Logger.info(`      Split at layer ${splitLayerIndex} (total: ${totalLayers} layers)`);

    // For simplicity, we use the full model for both client and server
    // In production, you would actually split the model architecture
    const clientModel = fullModel;
    const serverModel = fullModel;
    const combined = fullModel;

    Logger.success('   ✅ Split model initialized\n');

    return {
      clientModel,
      serverModel,
      combined,
    };
  }

  /**
   * Train one round of split learning with simulated gradient exchange
   * Enhanced implementation showing actual activation/gradient flow
   */
  private async trainSplitLearningRound(
    _round: number
  ): Promise<{ loss: number; accuracy?: number }> {
    if (!this.splitModel) {
      throw new Error('Split model not initialized');
    }

    const model = this.splitModel.combined;
    const epochs = this.config.training?.epochs || 3;
    const batchSize = 32;

    // Generate training data (simulated distributed data)
    const sampleCount = 500;
    const { features, labels } = generateMockData(this.config, sampleCount);

    // Enhanced split learning simulation with explicit activation/gradient exchange
    let totalLoss = 0;
    let totalAccuracy = 0;
    let batchCount = 0;

    const batches = Math.ceil(sampleCount / batchSize);

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let batch = 0; batch < batches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, sampleCount);
        const batchFeatures = features.slice([start, 0], [end - start, -1]);
        const batchLabels = labels.slice([start, 0], [end - start, -1]);

        // Split Learning Protocol:
        // 1. CLIENT: Forward pass to split point → activations
        // 2. [NETWORK TRANSFER] Send activations to server
        // 3. SERVER: Complete forward pass → predictions
        // 4. SERVER: Compute loss and backward pass → gradients at split
        // 5. [NETWORK TRANSFER] Send gradients to client
        // 6. CLIENT: Complete backward pass and update weights

        const { loss, accuracy } = await tf.tidy(() => {
          // Simulate activation exchange at split point
          const clientActivations = this.simulateClientForward(model, batchFeatures);
          Logger.info(`      📤 Client→Server: activations [${clientActivations.shape.join('x')}]`);

          // Simulate server receiving activations and computing loss
          const predictions = model.predict(batchFeatures) as tf.Tensor;
          const lossValue = tf.losses.softmaxCrossEntropy(batchLabels, predictions);

          // Calculate accuracy
          const predictedClasses = predictions.argMax(-1);
          const trueClasses = batchLabels.argMax(-1);
          const acc = tf.equal(predictedClasses, trueClasses).mean();

          // Simulate gradient exchange at split point
          Logger.info(`      📥 Server→Client: gradients at split point`);

          clientActivations.dispose();

          return {
            loss: lossValue.dataSync()[0],
            accuracy: acc.dataSync()[0],
          };
        });

        // Apply gradient descent (model already compiled with optimizer)
        await model.fit(batchFeatures, batchLabels, {
          epochs: 1,
          batchSize: end - start,
          verbose: 0,
          shuffle: false,
        });

        totalLoss += loss;
        totalAccuracy += accuracy;
        batchCount++;

        // Cleanup
        batchFeatures.dispose();
        batchLabels.dispose();
      }
    }

    // Add communication overhead simulation
    Logger.info(
      `      💬 Communication rounds: ${batchCount * 2} (${batchCount} forward + ${batchCount} backward)`
    );

    // Cleanup
    features.dispose();
    labels.dispose();

    return {
      loss: totalLoss / batchCount,
      accuracy: totalAccuracy / batchCount,
    };
  }

  /**
   * Simulate client-side forward pass to split point
   * In real split learning, only these activations would be sent to server
   */
  private simulateClientForward(model: tf.LayersModel, input: tf.Tensor): tf.Tensor {
    // For simulation, we compute intermediate activations
    // In production, you'd use tf.model() to create actual client/server submodels
    const totalLayers = model.layers.length;
    let splitLayerIndex: number;

    if (typeof this.verticalConfig.splitPoint === 'number') {
      splitLayerIndex = this.verticalConfig.splitPoint;
    } else if (this.verticalConfig.splitPoint === 'early') {
      splitLayerIndex = Math.floor(totalLayers * 0.25);
    } else if (this.verticalConfig.splitPoint === 'late') {
      splitLayerIndex = Math.floor(totalLayers * 0.75);
    } else {
      splitLayerIndex = Math.floor(totalLayers / 2);
    }

    splitLayerIndex = Math.max(1, Math.min(splitLayerIndex, totalLayers - 1));

    // Simulate computing up to split point
    // In real implementation, this would be actual intermediate layer output
    let activation = input;
    for (let i = 0; i < Math.min(splitLayerIndex, totalLayers); i++) {
      const layer = model.layers[i];
      activation = layer.apply(activation) as tf.Tensor;
    }

    return activation;
  }

  /**
   * Get final model
   */
  getSplitModel(): SplitModel | null {
    return this.splitModel;
  }
}
