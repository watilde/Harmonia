/**
 * Split Learning Coordinator for Vertical Federated Learning
 *
 * The coordinator:
 * 1. Receives embeddings from all participants
 * 2. Aggregates embeddings
 * 3. Trains top model for prediction
 * 4. Computes loss and gradients
 * 5. Distributes gradients back to participants
 */

import * as tf from '@tensorflow/tfjs-node';
import type {
  CoordinatorConfig,
  AggregatedEmbeddings,
  EmbeddingUpdate,
  GradientUpdate,
  TrainingResult,
  VFLPrivacyConfig,
} from './types';
import { aggregateEmbeddings } from './embedding-aggregation';
import { splitGradients } from './embedding-aggregation';
import { protectGradientUpdate } from './privacy';

/**
 * Split Learning Coordinator
 */
export class SplitLearningCoordinator {
  private config: CoordinatorConfig;
  private privacyConfig: VFLPrivacyConfig;
  private topModel: tf.LayersModel | null = null;
  private currentRound: number = 0;
  private embeddingDim: number;

  constructor(config: CoordinatorConfig, privacyConfig: VFLPrivacyConfig, embeddingDim: number) {
    this.config = config;
    this.privacyConfig = privacyConfig;
    this.embeddingDim = embeddingDim;
  }

  /**
   * Initialize top model for prediction
   */
  initializeTopModel(inputDim: number): void {
    const input = tf.input({ shape: [inputDim] });
    let x: tf.SymbolicTensor = input;

    // Add hidden layers
    for (const units of this.config.topModelConfig.hiddenLayers) {
      x = tf.layers
        .dense({
          units,
          activation: this.config.topModelConfig.activation,
          kernelInitializer: 'heNormal',
        })
        .apply(x) as tf.SymbolicTensor;
    }

    // Output layer
    x = tf.layers
      .dense({
        units: this.config.topModelConfig.outputDim,
        activation: this.config.topModelConfig.outputDim === 1 ? 'sigmoid' : 'softmax',
        name: 'prediction',
      })
      .apply(x) as tf.SymbolicTensor;

    this.topModel = tf.model({ inputs: input, outputs: x });

    // Compile model
    const optimizer =
      this.config.optimizer.type === 'adam'
        ? tf.train.adam(this.config.optimizer.learningRate)
        : tf.train.sgd(this.config.optimizer.learningRate);

    this.topModel.compile({
      optimizer,
      loss:
        this.config.topModelConfig.outputDim === 1
          ? 'binaryCrossentropy'
          : 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    console.log(
      `[Coordinator] Top model initialized with ${this.topModel.countParams()} parameters`
    );
  }

  /**
   * Process embeddings and train top model
   */
  async trainTopModel(
    embeddingUpdates: EmbeddingUpdate[],
    labels: Float32Array,
    roundNumber: number
  ): Promise<TrainingResult> {
    if (!this.topModel) {
      throw new Error('Top model not initialized');
    }

    this.currentRound = roundNumber;

    // Aggregate embeddings
    const aggregated = aggregateEmbeddings(
      embeddingUpdates,
      this.config,
      roundNumber,
      this.embeddingDim
    );

    const [batchSize, totalEmbeddingDim] = aggregated.embeddings.shape;

    // Prepare input and labels
    const inputTensor = tf.tensor2d(Array.from(aggregated.embeddings.data), [
      batchSize,
      totalEmbeddingDim,
    ]);

    const labelShape: [number, number] =
      this.config.topModelConfig.outputDim === 1
        ? [batchSize, 1]
        : [batchSize, this.config.topModelConfig.outputDim];

    const labelTensor = tf.tensor2d(Array.from(labels), labelShape);

    // Train for one step and compute gradients
    const result = await this.trainStep(inputTensor, labelTensor, aggregated);

    // Clean up tensors
    inputTensor.dispose();
    labelTensor.dispose();

    return result;
  }

  /**
   * Perform one training step with gradient computation
   */
  private async trainStep(
    inputTensor: tf.Tensor2D,
    labelTensor: tf.Tensor2D,
    aggregated: AggregatedEmbeddings
  ): Promise<TrainingResult> {
    if (!this.topModel) {
      throw new Error('Top model not initialized');
    }

    let loss = 0;
    let accuracy = 0;
    let gradients: tf.Tensor | null = null;

    // Use tf.tidy to automatically clean up intermediate tensors
    await tf.tidy(() => {
      // Forward pass
      const predictions = this.topModel!.predict(inputTensor) as tf.Tensor2D;

      // Compute loss
      const lossFn =
        this.config.topModelConfig.outputDim === 1
          ? tf.losses.sigmoidCrossEntropy
          : tf.losses.softmaxCrossEntropy;

      const lossValue = lossFn(labelTensor, predictions);
      loss = lossValue.dataSync()[0];

      // Compute accuracy
      const predicted =
        this.config.topModelConfig.outputDim === 1
          ? predictions.greater(0.5)
          : predictions.argMax(-1);

      const labels =
        this.config.topModelConfig.outputDim === 1
          ? labelTensor.greater(0.5)
          : labelTensor.argMax(-1);

      const correct = predicted.equal(labels).sum();
      accuracy = correct.dataSync()[0] / inputTensor.shape[0];
    });

    // Compute gradients w.r.t. input embeddings
    const grad = tf.grad((x: tf.Tensor) => {
      const pred = this.topModel!.predict(x) as tf.Tensor2D;
      const lossFn =
        this.config.topModelConfig.outputDim === 1
          ? tf.losses.sigmoidCrossEntropy
          : tf.losses.softmaxCrossEntropy;
      return lossFn(labelTensor, pred);
    });

    gradients = grad(inputTensor);

    // Train the top model
    await this.topModel.fit(inputTensor, labelTensor, {
      epochs: 1,
      verbose: 0,
      batchSize: this.config.batchSize,
    });

    // Convert gradients to Float32Array
    const gradientsArray = await gradients.data();
    const gradientsFloat32 = new Float32Array(gradientsArray);

    // Split gradients for each participant
    const splitGradientMap = splitGradients(
      gradientsFloat32,
      aggregated.aggregationMethod,
      aggregated.participantIds,
      this.embeddingDim,
      this.currentRound
    );

    // Apply privacy protection to gradients
    const protectedGradients = new Map<string, GradientUpdate>();
    for (const [siteId, gradUpdate] of splitGradientMap) {
      const protected_ = this.privacyConfig.gradientDP.enabled
        ? protectGradientUpdate(gradUpdate, this.privacyConfig)
        : gradUpdate;
      protectedGradients.set(siteId, protected_);
    }

    // Clean up
    gradients.dispose();

    return {
      loss,
      accuracy,
      gradients: protectedGradients,
    };
  }

  /**
   * Get top model weights for export
   */
  getTopModelWeights(): { data: Float32Array[]; shapes: number[][] } {
    if (!this.topModel) {
      throw new Error('Top model not initialized');
    }

    const weights = this.topModel.getWeights();
    const data: Float32Array[] = [];
    const shapes: number[][] = [];

    for (const weight of weights) {
      const values = weight.dataSync();
      data.push(new Float32Array(values));
      shapes.push(weight.shape);
    }

    return { data, shapes };
  }

  /**
   * Set top model weights (for loading)
   */
  setTopModelWeights(data: Float32Array[], shapes: number[][]): void {
    if (!this.topModel) {
      throw new Error('Top model not initialized');
    }

    const tensors = data.map((d, i) => tf.tensor(Array.from(d), shapes[i]));
    this.topModel.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }

  /**
   * Dispose model and free memory
   */
  dispose(): void {
    if (this.topModel) {
      this.topModel.dispose();
      this.topModel = null;
    }
  }
}

/**
 * Create a split learning coordinator with default configuration
 */
export function createSplitLearningCoordinator(
  inputDim: number,
  outputDim: number,
  embeddingDim: number,
  privacyConfig: VFLPrivacyConfig
): SplitLearningCoordinator {
  const config: CoordinatorConfig = {
    topModelConfig: {
      inputDim,
      outputDim,
      hiddenLayers: [64, 32],
      activation: 'relu',
    },
    optimizer: {
      type: 'adam',
      learningRate: 0.001,
    },
    batchSize: 32,
    aggregationStrategy: 'concat',
  };

  const coordinator = new SplitLearningCoordinator(config, privacyConfig, embeddingDim);

  return coordinator;
}
