/**
 * Model Builder for CLI Training
 * Constructs TensorFlow.js models from Harmonia configuration
 */

import * as tf from '@tensorflow/tfjs-node';

import type { ModelConfig } from '../types/harmonia-config';

export interface LayerDefinition {
  type: string;
  units?: number;
  activation?: string;
  rate?: number;
  [key: string]: unknown;
}

export interface ModelWeights {
  data: Float32Array[];
  shapes: number[][];
}

/**
 * Build TensorFlow.js model from Harmonia configuration
 */
export function buildModelFromConfig(config: ModelConfig): tf.LayersModel {
  // Check if model has explicit layer configuration
  const modelDef = (config as any).model;
  if (!modelDef || !modelDef.layers) {
    // Create simple default model based on input/output dimensions
    return buildDefaultModel(config);
  }

  const model = tf.sequential();
  const layers = modelDef.layers as LayerDefinition[];

  // Determine input shape
  let inputShape: number[] | undefined;
  if (config.input.type === 'tabular' && config.input.features) {
    inputShape = [config.input.features.length];
  } else if ((config.input as any).dimension) {
    inputShape = [(config.input as any).dimension];
  }

  // Add layers
  layers.forEach((layerDef, index) => {
    const isFirst = index === 0;
    const layer = createLayer(layerDef, isFirst ? inputShape : undefined);
    model.add(layer);
  });

  // Compile model
  const loss = getLoss(config);
  const optimizer = getOptimizer(config);
  const metrics = getMetrics(config);

  model.compile({
    optimizer,
    loss,
    metrics,
  });

  return model;
}

/**
 * Build default model when no explicit architecture is provided
 */
function buildDefaultModel(config: ModelConfig): tf.LayersModel {
  const model = tf.sequential();

  // Determine input/output dimensions
  // Priority: config.input.dimension > features.length > default 10
  let inputDim: number;
  if ((config.input as any).dimension) {
    inputDim = (config.input as any).dimension;
  } else if (config.input.type === 'tabular' && config.input.features) {
    inputDim = config.input.features.length;
  } else {
    inputDim = 10;
  }

  const outputDim = config.output.dimension || 1;

  // Simple 2-layer network
  model.add(
    tf.layers.dense({
      inputShape: [inputDim],
      units: 64,
      activation: 'relu',
    })
  );

  model.add(
    tf.layers.dense({
      units: outputDim,
      activation: config.output.task === 'binary-classification' ? 'sigmoid' : 'linear',
    })
  );

  const loss = getLoss(config);
  const optimizer = tf.train.adam(0.001);

  model.compile({
    optimizer,
    loss,
    metrics: ['accuracy'],
  });

  return model;
}

/**
 * Create a layer from configuration
 */
function createLayer(layerDef: LayerDefinition, inputShape?: number[]): tf.layers.Layer {
  const config: Record<string, unknown> = {};

  if (inputShape) {
    config.inputShape = inputShape;
  }

  switch (layerDef.type) {
    case 'dense':
      if (!layerDef.units) {
        throw new Error('Dense layer requires units parameter');
      }
      return tf.layers.dense({
        ...config,
        units: layerDef.units,
        activation: (layerDef.activation || 'linear') as any,
      });

    case 'dropout':
      if (layerDef.rate === undefined) {
        throw new Error('Dropout layer requires rate parameter');
      }
      return tf.layers.dropout({
        ...config,
        rate: layerDef.rate,
      });

    case 'batchNormalization':
    case 'batch-norm':
      return tf.layers.batchNormalization(config);

    case 'conv2d':
      if (!layerDef.filters || !layerDef.kernelSize) {
        throw new Error('Conv2d layer requires filters and kernelSize parameters');
      }
      return tf.layers.conv2d({
        ...config,
        filters: layerDef.filters as number,
        kernelSize: layerDef.kernelSize as number | [number, number],
        activation: (layerDef.activation || 'linear') as any,
      });

    case 'maxPooling2d':
    case 'max-pooling':
      return tf.layers.maxPooling2d({
        ...config,
        poolSize: (layerDef.poolSize as [number, number]) || [2, 2],
      });

    case 'flatten':
      return tf.layers.flatten(config);

    default:
      throw new Error(`Unsupported layer type: ${layerDef.type}`);
  }
}

/**
 * Get loss function from config
 */
function getLoss(config: ModelConfig): string {
  const modelDef = (config as any).model;
  if (modelDef?.loss) {
    return modelDef.loss as string;
  }

  // Infer from task type
  switch (config.output.task) {
    case 'binary-classification':
      return 'binaryCrossentropy';
    case 'multi-class-classification':
      return 'categoricalCrossentropy';
    case 'regression':
      return 'meanSquaredError';
    default:
      return 'meanSquaredError';
  }
}

/**
 * Get optimizer from config
 */
function getOptimizer(config: ModelConfig): tf.Optimizer {
  const modelDef = (config as any).model;
  const optimizerConfig = modelDef?.optimizer || { type: 'adam', learningRate: 0.001 };
  const type = optimizerConfig.type || 'adam';
  const learningRate = optimizerConfig.learningRate || 0.001;

  switch (type) {
    case 'adam':
      return tf.train.adam(learningRate);
    case 'sgd':
      return tf.train.sgd(learningRate);
    case 'rmsprop':
      return tf.train.rmsprop(learningRate);
    default:
      return tf.train.adam(learningRate);
  }
}

/**
 * Get metrics from config
 */
function getMetrics(config: ModelConfig): string[] {
  const modelDef = (config as any).model;
  if (modelDef?.metrics) {
    return modelDef.metrics as string[];
  }

  // Default metrics based on task
  if (
    config.output.task === 'binary-classification' ||
    config.output.task === 'multi-class-classification'
  ) {
    return ['accuracy'];
  }

  return [];
}

/**
 * Get model weights in serialized format
 */
export function getModelWeights(model: tf.LayersModel): ModelWeights {
  const weights = model.getWeights();
  const data = weights.map((w) => {
    const array = w.dataSync();
    return new Float32Array(array);
  });
  const shapes = weights.map((w) => w.shape);

  // Note: Don't dispose weight tensors - they are owned by the model
  // and disposing them will break the model. We've already copied the data.

  return { data, shapes };
}

/**
 * Set model weights from serialized format
 */
export function setModelWeights(model: tf.LayersModel, weights: ModelWeights): void {
  const tensors = weights.shapes.map((shape, i) => tf.tensor(weights.data[i], shape));
  model.setWeights(tensors);

  // Note: Don't dispose tensors here - model.setWeights() takes ownership
  // and will manage their lifecycle. Disposing them causes "already disposed" errors.
}

/**
 * Generate mock training data for testing
 */
export function generateMockData(
  config: ModelConfig,
  sampleCount: number = 100
): {
  features: tf.Tensor2D;
  labels: tf.Tensor2D;
} {
  const inputDim =
    (config.input as any).dimension ||
    (config.input.type === 'tabular' && config.input.features ? config.input.features.length : 10);
  const outputDim = config.output.dimension || 1;

  const features = tf.randomNormal([sampleCount, inputDim]) as tf.Tensor2D;
  const labels = (
    config.output.task === 'binary-classification'
      ? tf.randomUniform([sampleCount, outputDim], 0, 1).greater(0.5).asType('float32')
      : tf.randomNormal([sampleCount, outputDim])
  ) as tf.Tensor2D;

  return { features, labels };
}
