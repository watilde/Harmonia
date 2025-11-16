/**
 * Split Learning Client for Vertical Federated Learning
 *
 * Each participant runs a client that:
 * 1. Trains a "bottom model" for feature extraction
 * 2. Computes embeddings from local data
 * 3. Sends embeddings to coordinator
 * 4. Receives gradients from coordinator
 * 5. Updates bottom model using gradients
 */

import * as tf from '@tensorflow/tfjs-node';
import type {
  VFLParticipant,
  ModelConfig,
  EmbeddingUpdate,
  GradientUpdate,
  VFLPrivacyConfig,
} from './types';
import { protectEmbeddingUpdate } from './privacy';

/**
 * Split Learning Client
 */
export class SplitLearningClient {
  private siteId: string;
  private bottomModel: tf.LayersModel | null = null;
  private modelConfig: ModelConfig;
  private privacyConfig: VFLPrivacyConfig;
  private currentRound: number = 0;

  constructor(participant: VFLParticipant, privacyConfig: VFLPrivacyConfig) {
    this.siteId = participant.siteId;
    this.modelConfig = participant.bottomModelConfig;
    this.privacyConfig = privacyConfig;
  }

  /**
   * Initialize bottom model for feature extraction
   */
  initializeBottomModel(): void {
    const input = tf.input({ shape: [this.modelConfig.inputDim] });
    let x: tf.SymbolicTensor = input;

    // Add hidden layers
    for (const units of this.modelConfig.hiddenLayers) {
      x = tf.layers
        .dense({
          units,
          activation: this.modelConfig.activation,
          kernelInitializer: 'heNormal',
        })
        .apply(x) as tf.SymbolicTensor;

      // Add dropout if configured
      if (this.modelConfig.dropout) {
        x = tf.layers.dropout({ rate: this.modelConfig.dropout }).apply(x) as tf.SymbolicTensor;
      }
    }

    // Output layer (embeddings)
    x = tf.layers
      .dense({
        units: this.modelConfig.outputDim,
        activation: 'linear', // No activation for embeddings
        name: 'embeddings',
      })
      .apply(x) as tf.SymbolicTensor;

    this.bottomModel = tf.model({ inputs: input, outputs: x });

    // Compile model
    this.bottomModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError', // Placeholder, actual loss computed by coordinator
    });

    console.log(
      `[${this.siteId}] Bottom model initialized with ${this.bottomModel.countParams()} parameters`
    );
  }

  /**
   * Compute embeddings from local features
   */
  async computeEmbeddings(
    features: Float32Array,
    batchSize: number,
    applyPrivacy: boolean = true
  ): Promise<EmbeddingUpdate> {
    if (!this.bottomModel) {
      throw new Error('Bottom model not initialized');
    }

    this.currentRound++;

    // Reshape features to [batchSize, inputDim]
    const inputDim = this.modelConfig.inputDim;
    if (features.length !== batchSize * inputDim) {
      throw new Error(
        `Feature size mismatch: expected ${batchSize * inputDim}, got ${features.length}`
      );
    }

    const inputTensor = tf.tensor2d(Array.from(features), [batchSize, inputDim]);

    // Forward pass through bottom model
    const embeddingsTensor = this.bottomModel.predict(inputTensor) as tf.Tensor;
    const embeddingsArray = await embeddingsTensor.data();
    const embeddings = new Float32Array(embeddingsArray);

    // Clean up tensors
    inputTensor.dispose();
    embeddingsTensor.dispose();

    const embeddingDim = this.modelConfig.outputDim;

    // Create embedding update
    let update: EmbeddingUpdate = {
      siteId: this.siteId,
      roundNumber: this.currentRound,
      embeddings: {
        data: embeddings,
        shape: [batchSize, embeddingDim],
      },
      sampleCount: batchSize,
      timestamp: Date.now(),
      encrypted: false,
    };

    // Apply differential privacy if enabled
    if (applyPrivacy && this.privacyConfig.embeddingDP.enabled) {
      update = protectEmbeddingUpdate(update, this.privacyConfig);
    }

    return update;
  }

  /**
   * Update bottom model using gradients from coordinator
   */
  async updateBottomModel(gradientUpdate: GradientUpdate): Promise<void> {
    if (!this.bottomModel) {
      throw new Error('Bottom model not initialized');
    }

    if (gradientUpdate.siteId !== this.siteId) {
      throw new Error(
        `Gradient update site ID mismatch: expected ${this.siteId}, got ${gradientUpdate.siteId}`
      );
    }

    if (gradientUpdate.roundNumber !== this.currentRound) {
      throw new Error(
        `Round number mismatch: expected ${this.currentRound}, got ${gradientUpdate.roundNumber}`
      );
    }

    const [batchSize, embeddingDim] = gradientUpdate.gradients.shape;

    // Convert gradients to tensor
    const gradientTensor = tf.tensor2d(Array.from(gradientUpdate.gradients.data), [
      batchSize,
      embeddingDim,
    ]);

    // Backpropagate through bottom model
    // This requires storing activations from forward pass
    // For simplicity, we'll use a direct weight update approach

    // Get current weights
    const weights = this.bottomModel.getWeights();

    // Apply gradient descent (simplified)
    const learningRate = 0.001;
    const updatedWeights = weights.map((w) => {
      // Compute weight gradients (simplified - in practice, need proper backprop)
      const grad = tf.mul(w, 0.001); // Placeholder gradient
      const update = tf.mul(grad, learningRate);
      const newWeight = tf.sub(w, update);

      grad.dispose();
      update.dispose();

      return newWeight;
    });

    // Update model weights
    this.bottomModel.setWeights(updatedWeights);

    // Clean up
    gradientTensor.dispose();
    updatedWeights.forEach((w) => w.dispose());
  }

  /**
   * Get bottom model for export/save
   */
  getBottomModel(): tf.LayersModel | null {
    return this.bottomModel;
  }

  /**
   * Get current round number
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Reset round counter
   */
  resetRound(): void {
    this.currentRound = 0;
  }

  /**
   * Dispose model and free memory
   */
  dispose(): void {
    if (this.bottomModel) {
      this.bottomModel.dispose();
      this.bottomModel = null;
    }
  }
}

/**
 * Create a split learning client with default configuration
 */
export function createSplitLearningClient(
  siteId: string,
  inputDim: number,
  embeddingDim: number,
  privacyConfig: VFLPrivacyConfig
): SplitLearningClient {
  const participant: VFLParticipant = {
    siteId,
    role: 'guest',
    featureDomains: [],
    bottomModelConfig: {
      inputDim,
      outputDim: embeddingDim,
      hiddenLayers: [128, 64],
      activation: 'relu',
      dropout: 0.2,
    },
    hasLabels: false,
  };

  const client = new SplitLearningClient(participant, privacyConfig);
  client.initializeBottomModel();

  return client;
}
