/**
 * Federated Training Manager
 * Simulates federated learning with multiple clients and coordinator
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

export interface FederatedConfig {
  numClients: number; // Number of simulated clients
  clientsPerRound: number; // Clients participating per round
  algorithm: string; // fedavg, fedprox, scaffold, etc.
  aggregationStrategy: 'weighted' | 'uniform';
}

export interface ClientUpdate {
  clientId: string;
  weights: ModelWeights;
  sampleCount: number;
  metrics: {
    loss: number;
    accuracy?: number;
  };
}

export interface GlobalModel {
  weights: ModelWeights;
  round: number;
  metrics: {
    avgLoss: number;
    avgAccuracy?: number;
  };
}

/**
 * Federated Learning Trainer
 * Simulates coordinator + multiple clients
 */
export class FederatedTrainer {
  private config: ModelConfig;
  private fedConfig: FederatedConfig;
  private globalModel: GlobalModel | null = null;

  constructor(modelConfig: ModelConfig, fedConfig: FederatedConfig) {
    this.config = modelConfig;
    this.fedConfig = fedConfig;
  }

  /**
   * Execute federated training
   */
  async train(totalRounds: number): Promise<GlobalModel> {
    Logger.info(`   🌐 Federated Learning: ${this.fedConfig.numClients} clients`);
    Logger.info(`   📊 Algorithm: ${this.fedConfig.algorithm}`);
    Logger.info(`   🔄 Clients per round: ${this.fedConfig.clientsPerRound}\n`);

    // Initialize global model
    await this.initializeGlobalModel();

    // Training rounds
    for (let round = 1; round <= totalRounds; round++) {
      Logger.info(`   📍 Round ${round}/${totalRounds}`);

      // Select clients for this round
      const selectedClients = this.selectClients();
      Logger.info(`      Selected clients: ${selectedClients.join(', ')}`);

      // Train on each client
      const updates = await this.trainClients(selectedClients, round);

      // Aggregate updates
      this.globalModel = await this.aggregateUpdates(updates, round);

      // Log metrics
      Logger.info(
        `      Global - Loss: ${this.globalModel.metrics.avgLoss.toFixed(4)}${
          this.globalModel.metrics.avgAccuracy
            ? ` - Acc: ${this.globalModel.metrics.avgAccuracy.toFixed(4)}`
            : ''
        }`
      );
      Logger.info('');
    }

    Logger.success(`   ✅ Federated training completed\n`);
    return this.globalModel!;
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
      round: 0,
      metrics: {
        avgLoss: 0,
        avgAccuracy: 0,
      },
    };

    // Cleanup
    model.dispose();

    Logger.success('   ✅ Global model initialized\n');
  }

  /**
   * Select clients for this round
   */
  private selectClients(): string[] {
    const clients: string[] = [];
    const numToSelect = Math.min(this.fedConfig.clientsPerRound, this.fedConfig.numClients);

    // Random selection without replacement
    const availableClients = Array.from(
      { length: this.fedConfig.numClients },
      (_, i) => `client-${i + 1}`
    );

    for (let i = 0; i < numToSelect; i++) {
      const idx = Math.floor(Math.random() * availableClients.length);
      clients.push(availableClients[idx]);
      availableClients.splice(idx, 1);
    }

    return clients.sort();
  }

  /**
   * Train on selected clients
   */
  private async trainClients(clientIds: string[], round: number): Promise<ClientUpdate[]> {
    const updates: ClientUpdate[] = [];

    for (const clientId of clientIds) {
      const update = await this.trainSingleClient(clientId, round);
      updates.push(update);
    }

    return updates;
  }

  /**
   * Train on a single client
   */
  private async trainSingleClient(clientId: string, _round: number): Promise<ClientUpdate> {
    // Build model and initialize with global weights
    const model = buildModelFromConfig(this.config);
    setModelWeights(model, this.globalModel!.weights);

    // Generate client-specific data
    const sampleCount = 100 + Math.floor(Math.random() * 100); // 100-200 samples per client
    const { features, labels } = generateMockData(this.config, sampleCount);

    // Local training - FedProx uses custom training loop with proximal term
    let loss: number;
    let accuracy: number | undefined;

    if (this.fedConfig.algorithm === 'fedprox') {
      const result = await this.trainWithProximalTerm(model, features, labels);
      loss = result.loss;
      accuracy = result.accuracy;
    } else {
      // Standard training (FedAvg)
      const epochs = this.config.training?.epochs || 5;
      const history = await model.fit(features, labels, {
        epochs,
        batchSize: 32,
        verbose: 0,
      });

      // Get final metrics
      const finalEpoch = history.history.loss.length - 1;
      loss = history.history.loss[finalEpoch] as number;
      accuracy = history.history.acc ? (history.history.acc[finalEpoch] as number) : undefined;
    }

    // Get updated weights
    const weights = getModelWeights(model);

    // Cleanup
    features.dispose();
    labels.dispose();
    model.dispose();

    return {
      clientId,
      weights,
      sampleCount,
      metrics: {
        loss,
        accuracy,
      },
    };
  }

  /**
   * Train with FedProx proximal term
   * FedProx adds a regularization term: loss = original_loss + (mu/2) * ||w - w_global||^2
   */
  private async trainWithProximalTerm(
    model: tf.LayersModel,
    features: tf.Tensor,
    labels: tf.Tensor
  ): Promise<{ loss: number; accuracy?: number }> {
    const epochs = this.config.training?.epochs || 5;
    const mu = (this.config.federation.config?.mu as number) || 0.01; // Default μ = 0.01
    const learningRate = this.config.training?.learningRate || 0.001;

    // Save global weights for proximal term
    const globalWeights = this.globalModel!.weights;
    const globalTensors = globalWeights.data.map((data, i) =>
      tf.tensor(data, globalWeights.shapes[i])
    );

    // Custom loss function with proximal term
    const proximalLoss = (yTrue: tf.Tensor, yPred: tf.Tensor): tf.Tensor => {
      return tf.tidy(() => {
        // Original loss
        const originalLoss = tf.losses.softmaxCrossEntropy(yTrue, yPred);

        // Proximal term: (mu/2) * ||w - w_global||^2
        let proximalTerm = tf.scalar(0);
        const currentWeights = model.getWeights();

        for (let i = 0; i < currentWeights.length; i++) {
          const diff = tf.sub(currentWeights[i], globalTensors[i]);
          const squaredNorm = tf.sum(tf.square(diff));
          proximalTerm = tf.add(proximalTerm, squaredNorm);
        }

        const proximalLoss = tf.mul(tf.scalar(mu / 2), proximalTerm);
        return tf.add(originalLoss, proximalLoss);
      });
    };

    // Compile model with custom loss
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: proximalLoss,
      metrics: ['accuracy'],
    });

    // Train
    const history = await model.fit(features, labels, {
      epochs,
      batchSize: 32,
      verbose: 0,
    });

    // Cleanup global tensors
    globalTensors.forEach((t) => t.dispose());

    // Get final metrics
    const finalEpoch = history.history.loss.length - 1;
    const loss = history.history.loss[finalEpoch] as number;
    const accuracy = history.history.acc ? (history.history.acc[finalEpoch] as number) : undefined;

    return {
      loss,
      accuracy,
    };
  }

  /**
   * Aggregate client updates
   */
  private async aggregateUpdates(updates: ClientUpdate[], round: number): Promise<GlobalModel> {
    if (this.fedConfig.algorithm === 'fedavg') {
      return this.fedAvgAggregate(updates, round);
    } else if (this.fedConfig.algorithm === 'fedprox') {
      // FedProx uses same aggregation as FedAvg, but differs in local training
      // The proximal term is applied during client training (see trainWithProximalTerm)
      return this.fedProxAggregate(updates, round);
    } else {
      // Default to FedAvg
      return this.fedAvgAggregate(updates, round);
    }
  }

  /**
   * FedAvg aggregation
   */
  private async fedAvgAggregate(updates: ClientUpdate[], round: number): Promise<GlobalModel> {
    const strategy = this.fedConfig.aggregationStrategy;

    // Calculate total samples or uniform weight
    const totalSamples =
      strategy === 'weighted' ? updates.reduce((sum, u) => sum + u.sampleCount, 0) : updates.length;

    // Initialize aggregated weights
    const firstUpdate = updates[0];
    const aggregated = firstUpdate.weights.shapes.map((shape) => tf.zeros(shape));

    // Aggregate weights
    for (const update of updates) {
      const weight =
        strategy === 'weighted' ? update.sampleCount / totalSamples : 1 / updates.length;

      for (let i = 0; i < aggregated.length; i++) {
        const clientTensor = tf.tensor(update.weights.data[i], update.weights.shapes[i]);
        const weighted = tf.mul(clientTensor, weight);
        const newAgg = tf.add(aggregated[i], weighted);

        aggregated[i].dispose();
        aggregated[i] = newAgg;

        clientTensor.dispose();
        weighted.dispose();
      }
    }

    // Serialize aggregated weights
    const weights: ModelWeights = {
      data: aggregated.map((t) => t.dataSync() as Float32Array),
      shapes: aggregated.map((t) => t.shape),
    };

    // Cleanup
    aggregated.forEach((t) => t.dispose());

    // Calculate average metrics
    const avgLoss = updates.reduce((sum, u) => sum + u.metrics.loss, 0) / updates.length;
    const avgAccuracy = updates[0].metrics.accuracy
      ? updates.reduce((sum, u) => sum + (u.metrics.accuracy || 0), 0) / updates.length
      : undefined;

    return {
      weights,
      round,
      metrics: {
        avgLoss,
        avgAccuracy,
      },
    };
  }

  /**
   * FedProx aggregation
   * Aggregation is identical to FedAvg - the proximal term is applied during local training
   * Reference: "Federated Optimization in Heterogeneous Networks" (Li et al., 2020)
   */
  private async fedProxAggregate(updates: ClientUpdate[], round: number): Promise<GlobalModel> {
    // FedProx aggregation is the same as FedAvg
    // The key difference is in local training where proximal term (mu/2)||w - w_global||^2 is added
    const mu = (this.config.federation.config?.mu as number) || 0.01;
    Logger.info(`      Using FedProx with μ = ${mu}`);

    return this.fedAvgAggregate(updates, round);
  }

  /**
   * Get final global model
   */
  getGlobalModel(): GlobalModel | null {
    return this.globalModel;
  }
}
