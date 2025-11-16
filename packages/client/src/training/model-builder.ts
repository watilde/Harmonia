/**
 * Model builder for federated learning
 */

import * as tf from '@tensorflow/tfjs-node';

import { LayerConfig, ModelConfig, OptimizerConfig } from '../types';

/**
 * Build TensorFlow.js model from configuration
 */
export function buildModel(config: ModelConfig): tf.LayersModel {
  if (config.type !== 'sequential') {
    throw new Error(`Model type ${config.type} not supported yet`);
  }

  const model = tf.sequential();

  // Add layers
  config.layers.forEach((layerConfig, index) => {
    const layer = createLayer(layerConfig, index === 0);
    model.add(layer);
  });

  // Compile model
  const optimizer = createOptimizer(config.optimizer);
  model.compile({
    optimizer,
    loss: config.loss,
    metrics: config.metrics,
  });

  return model;
}

/**
 * Create a single layer from configuration
 */
function createLayer(config: LayerConfig, isFirst: boolean): tf.layers.Layer {
  const commonConfig: Record<string, unknown> = {};

  if (isFirst && config.inputShape) {
    commonConfig.inputShape = config.inputShape;
  }

  switch (config.type) {
    case 'dense':
      if (!config.units) {
        throw new Error('Dense layer requires units parameter');
      }
      return tf.layers.dense({
        ...commonConfig,
        units: config.units,
        activation: (config.activation || 'linear') as any,
      });

    case 'dropout':
      if (config.rate === undefined) {
        throw new Error('Dropout layer requires rate parameter');
      }
      return tf.layers.dropout({
        ...commonConfig,
        rate: config.rate,
      });

    case 'batchNormalization':
      return tf.layers.batchNormalization(commonConfig);

    default:
      throw new Error(`Unsupported layer type: ${config.type}`);
  }
}

/**
 * Create optimizer from configuration
 */
function createOptimizer(config: OptimizerConfig): tf.Optimizer {
  switch (config.type) {
    case 'adam':
      return tf.train.adam(config.learningRate);

    case 'sgd':
      return tf.train.sgd(config.learningRate);

    case 'rmsprop':
      return tf.train.rmsprop(config.learningRate, config.momentum);

    default:
      throw new Error(`Unsupported optimizer type: ${config.type}`);
  }
}

/**
 * Set model weights from serialized format
 */
export function setModelWeights(
  model: tf.LayersModel,
  weights: { data: Float32Array[]; shapes: number[][] }
): void {
  const tensors = weights.shapes.map((shape, i) => tf.tensor(weights.data[i], shape));
  model.setWeights(tensors);
  // Clean up tensors
  tensors.forEach((t) => t.dispose());
}

/**
 * Get model weights in serialized format
 */
export function getModelWeights(model: tf.LayersModel): {
  data: Float32Array[];
  shapes: number[][];
} {
  const weights = model.getWeights();
  const data = weights.map((w) => w.dataSync() as Float32Array);
  const shapes = weights.map((w) => w.shape);
  return { data, shapes };
}
