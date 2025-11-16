/**
 * Hybrid Federated Learning Trainer
 * Combines multiple FL architectures (e.g., Horizontal + Vertical)
 * Useful for hierarchical and multi-tier federated systems
 */

import * as tf from '@tensorflow/tfjs-node';

import type { ModelConfig } from '../types/harmonia-config';
import { Logger } from '../utils/logger';
import {
  buildModelFromConfig,
  generateMockData,
  getModelWeights,
  setModelWeights,
} from './model-builder';
import type { ModelWeights } from './model-builder';

export interface HybridConfig {
  primaryArchitecture: 'horizontal' | 'vertical' | 'hierarchical';
  secondaryArchitecture?: 'horizontal' | 'vertical';
  numTiers?: number; // For hierarchical FL
  clientsPerTier?: number[];
  aggregationStrategy: 'weighted' | 'uniform' | 'tiered';
  algorithm: string; // 'hierarchical-fedavg', 'hybrid-split'
}

export interface TierUpdate {
  tierId: string;
  tierLevel: number;
  weights: ModelWeights;
  sampleCount: number;
  metrics: {
    loss: number;
    accuracy?: number;
  };
}

/**
 * Hybrid FL Trainer
 * Supports hierarchical and multi-architecture federated learning
 */
export class HybridTrainer {
  private config: ModelConfig;
  private hybridConfig: HybridConfig;
  private globalModel: { weights: ModelWeights; metrics: any } | null = null;

  constructor(modelConfig: ModelConfig, hybridConfig: HybridConfig) {
    this.config = modelConfig;
    this.hybridConfig = hybridConfig;
  }

  /**
   * Execute hybrid federated training
   */
  async train(totalRounds: number): Promise<{ weights: ModelWeights; metrics: any }> {
    Logger.info(`   🔀 Hybrid FL: ${this.hybridConfig.algorithm}`);
    Logger.info(`   🏗️  Primary: ${this.hybridConfig.primaryArchitecture}`);
    if (this.hybridConfig.secondaryArchitecture) {
      Logger.info(`   🏗️  Secondary: ${this.hybridConfig.secondaryArchitecture}`);
    }
    if (this.hybridConfig.numTiers) {
      Logger.info(`   📊 Tiers: ${this.hybridConfig.numTiers}`);
    }
    Logger.info('');

    // Initialize global model
    await this.initializeGlobalModel();

    let avgLoss = 0;
    let avgAccuracy: number | undefined;

    // Training rounds
    for (let round = 1; round <= totalRounds; round++) {
      Logger.info(`   📍 Round ${round}/${totalRounds}`);

      if (this.hybridConfig.primaryArchitecture === 'hierarchical') {
        const result = await this.trainHierarchicalRound(round);
        avgLoss = result.loss;
        avgAccuracy = result.accuracy;
      } else {
        // Hybrid horizontal + vertical
        const result = await this.trainHybridRound(round);
        avgLoss = result.loss;
        avgAccuracy = result.accuracy;
      }

      Logger.info(
        `      Global - Loss: ${avgLoss.toFixed(4)}${
          avgAccuracy !== undefined ? ` - Acc: ${avgAccuracy.toFixed(4)}` : ''
        }`
      );
      Logger.info('');
    }

    Logger.success(`   ✅ Hybrid FL training completed\n`);

    return {
      weights: this.globalModel!.weights,
      metrics: {
        avgLoss,
        avgAccuracy,
      },
    };
  }

  /**
   * Initialize global model
   */
  private async initializeGlobalModel(): Promise<void> {
    Logger.info('   🔨 Building initial global model...');

    const model = buildModelFromConfig(this.config);
    const weights = getModelWeights(model);

    this.globalModel = {
      weights,
      metrics: {
        avgLoss: 0,
        avgAccuracy: 0,
      },
    };

    model.dispose();

    Logger.success('   ✅ Global model initialized\n');
  }

  /**
   * Train one hierarchical round
   * Multi-tier aggregation: edge -> fog -> cloud
   */
  private async trainHierarchicalRound(
    _round: number
  ): Promise<{ loss: number; accuracy?: number }> {
    const numTiers = this.hybridConfig.numTiers || 3;
    const clientsPerTier = this.hybridConfig.clientsPerTier || [10, 5, 1];

    Logger.info(`      Hierarchical aggregation across ${numTiers} tiers`);

    // Simulate tier-by-tier training
    const tierUpdates: TierUpdate[] = [];

    for (let tier = 0; tier < numTiers; tier++) {
      const tierClients = clientsPerTier[tier] || 5;
      Logger.info(`      Tier ${tier + 1}: ${tierClients} nodes`);

      // Train on this tier
      for (let client = 0; client < tierClients; client++) {
        const update = await this.trainTierNode(tier, client);
        tierUpdates.push(update);
      }

      // Aggregate within tier before moving up
      if (tier < numTiers - 1) {
        this.aggregateTier(tierUpdates.filter((u) => u.tierLevel === tier));
      }
    }

    // Final global aggregation
    const result = this.aggregateAllTiers(tierUpdates);
    this.globalModel!.weights = result.weights;

    return {
      loss: result.metrics.loss,
      accuracy: result.metrics.accuracy,
    };
  }

  /**
   * Train one hybrid round (combining architectures)
   */
  private async trainHybridRound(_round: number): Promise<{ loss: number; accuracy?: number }> {
    Logger.info(
      `      Hybrid training: ${this.hybridConfig.primaryArchitecture} + ${this.hybridConfig.secondaryArchitecture}`
    );

    // Simulate hybrid training
    // For example: horizontal aggregation followed by vertical split learning
    const model = buildModelFromConfig(this.config);
    setModelWeights(model, this.globalModel!.weights);

    const epochs = this.config.training?.epochs || 3;
    const { features, labels } = generateMockData(this.config, 500);

    const history = await model.fit(features, labels, {
      epochs,
      batchSize: 32,
      verbose: 0,
    });

    const finalEpoch = history.history.loss.length - 1;
    const loss = history.history.loss[finalEpoch] as number;
    const accuracy = history.history.acc ? (history.history.acc[finalEpoch] as number) : undefined;

    // Update global model
    this.globalModel!.weights = getModelWeights(model);

    // Cleanup
    features.dispose();
    labels.dispose();
    model.dispose();

    return { loss, accuracy };
  }

  /**
   * Train a single node in a tier
   */
  private async trainTierNode(tier: number, nodeId: number): Promise<TierUpdate> {
    const model = buildModelFromConfig(this.config);
    setModelWeights(model, this.globalModel!.weights);

    const sampleCount = 100 + Math.floor(Math.random() * 100);
    const { features, labels } = generateMockData(this.config, sampleCount);

    const epochs = this.config.training?.epochs || 3;
    const history = await model.fit(features, labels, {
      epochs,
      batchSize: 32,
      verbose: 0,
    });

    const finalEpoch = history.history.loss.length - 1;
    const loss = history.history.loss[finalEpoch] as number;
    const accuracy = history.history.acc ? (history.history.acc[finalEpoch] as number) : undefined;

    const weights = getModelWeights(model);

    features.dispose();
    labels.dispose();
    model.dispose();

    return {
      tierId: `tier${tier}-node${nodeId}`,
      tierLevel: tier,
      weights,
      sampleCount,
      metrics: { loss, accuracy },
    };
  }

  /**
   * Aggregate updates within a tier
   */
  private aggregateTier(updates: TierUpdate[]): void {
    if (updates.length === 0) return;

    // Weighted averaging within tier
    const totalSamples = updates.reduce((sum, u) => sum + u.sampleCount, 0);
    const aggregated = updates[0].weights.shapes.map((shape) => tf.zeros(shape));

    for (const update of updates) {
      const weight = update.sampleCount / totalSamples;

      for (let i = 0; i < aggregated.length; i++) {
        const tensor = tf.tensor(update.weights.data[i], update.weights.shapes[i]);
        const weighted = tf.mul(tensor, weight);
        const newAgg = tf.add(aggregated[i], weighted);

        aggregated[i].dispose();
        aggregated[i] = newAgg;

        tensor.dispose();
        weighted.dispose();
      }
    }

    // Store tier-aggregated weights (could be used for fog computing)
    aggregated.forEach((t) => t.dispose());
  }

  /**
   * Aggregate all tiers to global model
   */
  private aggregateAllTiers(updates: TierUpdate[]): {
    weights: ModelWeights;
    metrics: { loss: number; accuracy?: number };
  } {
    const strategy = this.hybridConfig.aggregationStrategy;

    // For tiered strategy, weight by tier level
    let totalWeight = 0;
    const weights = updates.map((u) => {
      if (strategy === 'tiered') {
        // Higher tiers have more weight
        return (u.tierLevel + 1) * u.sampleCount;
      } else if (strategy === 'weighted') {
        return u.sampleCount;
      } else {
        return 1;
      }
    });

    totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Aggregate
    const aggregated = updates[0].weights.shapes.map((shape) => tf.zeros(shape));

    for (let j = 0; j < updates.length; j++) {
      const update = updates[j];
      const weight = weights[j] / totalWeight;

      for (let i = 0; i < aggregated.length; i++) {
        const tensor = tf.tensor(update.weights.data[i], update.weights.shapes[i]);
        const weighted = tf.mul(tensor, weight);
        const newAgg = tf.add(aggregated[i], weighted);

        aggregated[i].dispose();
        aggregated[i] = newAgg;

        tensor.dispose();
        weighted.dispose();
      }
    }

    const finalWeights: ModelWeights = {
      data: aggregated.map((t) => t.dataSync() as Float32Array),
      shapes: aggregated.map((t) => t.shape),
    };

    aggregated.forEach((t) => t.dispose());

    // Calculate metrics
    const avgLoss = updates.reduce((sum, u) => sum + u.metrics.loss, 0) / updates.length;
    const avgAccuracy = updates[0].metrics.accuracy
      ? updates.reduce((sum, u) => sum + (u.metrics.accuracy || 0), 0) / updates.length
      : undefined;

    return {
      weights: finalWeights,
      metrics: {
        loss: avgLoss,
        accuracy: avgAccuracy,
      },
    };
  }
}
