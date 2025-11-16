/**
 * Federated Averaging (FedAvg) Algorithm
 * McMahan et al., 2017: Communication-Efficient Learning of Deep Networks from Decentralized Data
 */

import * as tf from '@tensorflow/tfjs-node';

import { ClientUpdate, FedAvgConfig, GlobalModel, ModelWeights, SerializedWeights } from '../types';

/**
 * Serialize TensorFlow.js model weights for transmission
 */
export function serializeWeights(weights: ModelWeights): SerializedWeights {
  return {
    shapes: weights.map((w) => w.shape),
    data: weights.map((w) => w.dataSync() as Float32Array),
  };
}

/**
 * Deserialize weights back to TensorFlow.js tensors
 */
export function deserializeWeights(serialized: SerializedWeights): ModelWeights {
  return serialized.shapes.map((shape, i) => tf.tensor(serialized.data[i], shape));
}

/**
 * Aggregate client updates using weighted averaging
 */
export function aggregateWeights(updates: ClientUpdate[], config: FedAvgConfig): SerializedWeights {
  if (updates.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${updates.length} < ${config.minParticipants}`);
  }

  const totalSamples =
    config.aggregationStrategy === 'weighted'
      ? updates.reduce((sum, update) => sum + update.sampleCount, 0)
      : updates.length;

  // Deserialize all client weights
  const clientWeights = updates.map((update) => deserializeWeights(update.weights));

  // Initialize aggregated weights with zeros
  const aggregated = clientWeights[0].map((w) => tf.zerosLike(w));

  // Weighted sum of all client weights
  for (let i = 0; i < updates.length; i++) {
    const weight =
      config.aggregationStrategy === 'weighted'
        ? updates[i].sampleCount / totalSamples
        : 1 / updates.length;

    for (let j = 0; j < aggregated.length; j++) {
      const weighted = tf.mul(clientWeights[i][j], weight);
      const newAgg = tf.add(aggregated[j], weighted);
      aggregated[j].dispose();
      aggregated[j] = newAgg;
      weighted.dispose();
    }
  }

  // Serialize aggregated weights
  const result = serializeWeights(aggregated);

  // Clean up tensors
  aggregated.forEach((t) => t.dispose());
  clientWeights.forEach((weights) => weights.forEach((w) => w.dispose()));

  return result;
}

/**
 * Create initial global model
 */
export function initializeGlobalModel(
  initialWeights: SerializedWeights,
  totalRounds: number
): GlobalModel {
  return {
    weights: initialWeights,
    round: {
      roundNumber: 0,
      totalRounds,
      participantCount: 0,
      timestamp: new Date(),
    },
    aggregatedSamples: 0,
  };
}

/**
 * Update global model with aggregated weights
 */
export function updateGlobalModel(
  currentModel: GlobalModel,
  updates: ClientUpdate[],
  config: FedAvgConfig
): GlobalModel {
  const aggregatedWeights = aggregateWeights(updates, config);
  const totalSamples = updates.reduce((sum, update) => sum + update.sampleCount, 0);

  return {
    weights: aggregatedWeights,
    round: {
      roundNumber: currentModel.round.roundNumber + 1,
      totalRounds: currentModel.round.totalRounds,
      participantCount: updates.length,
      timestamp: new Date(),
    },
    aggregatedSamples: currentModel.aggregatedSamples + totalSamples,
  };
}
