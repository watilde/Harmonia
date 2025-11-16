/**
 * Type definitions for Harmonia core
 */

import * as tf from '@tensorflow/tfjs-node';

/**
 * Model weights representation
 */
export type ModelWeights = tf.Tensor[];

/**
 * Serialized model weights for transmission
 */
export interface SerializedWeights {
  shapes: number[][];
  data: Float32Array[];
}

/**
 * Federated learning round information
 */
export interface FederatedRound {
  roundNumber: number;
  totalRounds: number;
  participantCount: number;
  timestamp: Date;
}

/**
 * Client update from a single site
 */
export interface ClientUpdate {
  siteId: string;
  weights: SerializedWeights;
  sampleCount: number;
  metrics?: Record<string, number>;
  roundNumber: number;
}

/**
 * Global model state
 */
export interface GlobalModel {
  weights: SerializedWeights;
  round: FederatedRound;
  aggregatedSamples: number;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit?: number;
}

/**
 * Federated averaging configuration
 */
export interface FedAvgConfig {
  totalRounds: number;
  minParticipants: number;
  aggregationStrategy: 'weighted' | 'uniform';
}
