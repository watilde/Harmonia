/**
 * Integration utilities for Vertical Federated Learning
 *
 * This module provides helper functions and utilities for setting up
 * and managing end-to-end vertical FL workflows.
 */

import { SplitLearningClient } from './split-learning-client';
import { SplitLearningCoordinator } from './split-learning-coordinator';
import { createDefaultVFLPrivacyConfig } from './privacy';
import type { VFLParticipant, VFLPrivacyConfig, EmbeddingUpdate, GradientUpdate } from './types';

/**
 * Configuration for a vertical FL setup
 */
export interface VFLSetupConfig {
  /** List of participants in the federation */
  participants: VFLParticipant[];

  /** Top model configuration */
  topModelConfig: {
    inputDim: number;
    outputDim: number;
    hiddenLayers: number[];
    activation: 'relu' | 'sigmoid' | 'tanh';
    dropout?: number;
  };

  /** Optimizer configuration */
  optimizer?: {
    type: 'sgd' | 'adam';
    learningRate: number;
    momentum?: number;
  };

  /** Batch size for training */
  batchSize: number;

  /** Embedding aggregation strategy */
  aggregationStrategy: 'concat' | 'sum' | 'attention';

  /** Privacy configuration */
  privacyConfig?: VFLPrivacyConfig;
}

/**
 * Result of a VFL training round
 */
export interface VFLRoundResult {
  /** Loss value */
  loss: number;

  /** Accuracy metric */
  accuracy: number;

  /** Gradients for each participant */
  gradients: Map<string, GradientUpdate>;
}

/**
 * Complete VFL setup including clients and coordinator
 */
export interface VFLSetup {
  /** Map of site IDs to clients */
  clients: Map<string, SplitLearningClient>;

  /** Coordinator instance */
  coordinator: SplitLearningCoordinator;

  /** Configuration used */
  config: VFLSetupConfig;

  /** Dispose all resources */
  dispose: () => void;
}

/**
 * Initialize a complete vertical FL setup
 *
 * @param config - VFL setup configuration
 * @returns Complete VFL setup with clients and coordinator
 *
 * @example
 * ```typescript
 * const setup = initializeVFLSetup({
 *   participants: [
 *     { siteId: 'site-a', role: 'guest', featureDomains: ['Condition'], ... },
 *     { siteId: 'site-b', role: 'guest', featureDomains: ['Measurement'], ... }
 *   ],
 *   topModelConfig: { inputDim: 32, outputDim: 1, hiddenLayers: [16] },
 *   batchSize: 32,
 *   aggregationStrategy: 'concat'
 * });
 *
 * // Use setup...
 *
 * setup.dispose(); // Clean up resources
 * ```
 */
export function initializeVFLSetup(config: VFLSetupConfig): VFLSetup {
  const privacyConfig = config.privacyConfig || createDefaultVFLPrivacyConfig();
  const clients = new Map<string, SplitLearningClient>();

  // Calculate embedding dimension from first participant
  const embeddingDim = config.participants[0]?.bottomModelConfig.outputDim || 16;

  // Initialize clients
  for (const participant of config.participants) {
    const client = new SplitLearningClient(participant, privacyConfig);
    client.initializeBottomModel();
    clients.set(participant.siteId, client);
  }

  // Calculate total input dimension for top model
  const totalEmbeddingDim =
    config.aggregationStrategy === 'concat'
      ? embeddingDim * config.participants.length
      : embeddingDim;

  // Initialize coordinator
  const coordinator = new SplitLearningCoordinator(
    {
      topModelConfig: {
        ...config.topModelConfig,
        inputDim: totalEmbeddingDim,
      },
      optimizer: config.optimizer || { type: 'adam', learningRate: 0.001 },
      batchSize: config.batchSize,
      aggregationStrategy: config.aggregationStrategy,
    },
    privacyConfig,
    embeddingDim
  );

  coordinator.initializeTopModel(totalEmbeddingDim);

  return {
    clients,
    coordinator,
    config,
    dispose: () => {
      clients.forEach((client) => client.dispose());
      coordinator.dispose();
    },
  };
}

/**
 * Execute one complete training round in vertical FL
 *
 * @param setup - VFL setup
 * @param features - Map of site IDs to feature arrays
 * @param labels - Label array
 * @param enableDP - Whether to enable differential privacy
 * @returns Training round result
 *
 * @example
 * ```typescript
 * const result = await executeVFLRound(
 *   setup,
 *   new Map([
 *     ['site-a', featuresA],
 *     ['site-b', featuresB]
 *   ]),
 *   labels,
 *   true // Enable DP
 * );
 *
 * console.log(`Loss: ${result.loss}, Accuracy: ${result.accuracy}`);
 * ```
 */
export async function executeVFLRound(
  setup: VFLSetup,
  features: Map<string, Float32Array>,
  labels: Float32Array,
  enableDP: boolean = false
): Promise<VFLRoundResult> {
  const { clients, coordinator, config } = setup;
  const embeddingUpdates: EmbeddingUpdate[] = [];

  // Step 1: Clients compute embeddings
  for (const [siteId, client] of clients) {
    const featureData = features.get(siteId);
    if (!featureData) {
      throw new Error(`Features not provided for site: ${siteId}`);
    }

    const embedding = await client.computeEmbeddings(featureData, config.batchSize, enableDP);

    embeddingUpdates.push(embedding);
  }

  // Step 2: Coordinator trains top model
  const trainResult = await coordinator.trainTopModel(embeddingUpdates, labels, 1);

  // Step 3: Clients update bottom models with gradients
  for (const [siteId, client] of clients) {
    const gradient = trainResult.gradients.get(siteId);
    if (gradient) {
      await client.updateBottomModel(gradient);
    }
  }

  return {
    loss: trainResult.loss,
    accuracy: trainResult.accuracy || 0,
    gradients: trainResult.gradients,
  };
}

/**
 * Generate synthetic features for testing
 *
 * @param batchSize - Number of samples
 * @param inputDim - Feature dimension
 * @returns Random feature array
 */
export function generateSyntheticFeatures(batchSize: number, inputDim: number): Float32Array {
  const features = new Float32Array(batchSize * inputDim);
  for (let i = 0; i < features.length; i++) {
    features[i] = Math.random();
  }
  return features;
}

/**
 * Generate synthetic labels for testing
 *
 * @param batchSize - Number of samples
 * @param isMultiClass - Whether to generate multi-class labels
 * @param numClasses - Number of classes (for multi-class)
 * @returns Random label array
 */
export function generateSyntheticLabels(
  batchSize: number,
  isMultiClass: boolean = false,
  numClasses: number = 2
): Float32Array {
  const labels = new Float32Array(batchSize);
  for (let i = 0; i < batchSize; i++) {
    if (isMultiClass) {
      labels[i] = Math.floor(Math.random() * numClasses);
    } else {
      labels[i] = Math.random() > 0.5 ? 1 : 0;
    }
  }
  return labels;
}

/**
 * Export top model weights from VFL setup
 *
 * @param setup - VFL setup
 * @returns Serialized top model weights
 */
export function exportTopModel(setup: VFLSetup): {
  data: Float32Array[];
  shapes: number[][];
} {
  return setup.coordinator.getTopModelWeights();
}

/**
 * Import top model weights into VFL setup
 *
 * @param setup - VFL setup
 * @param weights - Exported top model weights
 */
export function importTopModel(
  setup: VFLSetup,
  weights: { data: Float32Array[]; shapes: number[][] }
): void {
  setup.coordinator.setTopModelWeights(weights.data, weights.shapes);
}
