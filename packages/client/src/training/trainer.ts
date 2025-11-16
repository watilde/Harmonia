/**
 * Local training orchestrator
 */

import * as tf from '@tensorflow/tfjs-node';

import { LocalTrainingResult, ModelConfig, TrainingDataset, TrainingMetrics } from '../types';
import { buildModel, getModelWeights, setModelWeights } from './model-builder';

/**
 * Train model locally on site data
 */
export async function trainLocal(
  dataset: TrainingDataset,
  config: ModelConfig,
  globalWeights?: { data: Float32Array[]; shapes: number[][] }
): Promise<LocalTrainingResult> {
  // Build model
  const model = buildModel(config);

  // Set global weights if provided
  if (globalWeights) {
    setModelWeights(model, globalWeights);
  }

  // Train model
  const history = await model.fit(dataset.features, dataset.labels, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationSplit: config.validationSplit || 0.2,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (logs) {
          console.log(
            `Epoch ${epoch + 1}/${config.epochs} - loss: ${logs.loss.toFixed(4)}${
              logs.acc ? `, acc: ${logs.acc.toFixed(4)}` : ''
            }`
          );
        }
      },
    },
  });

  // Extract final metrics
  const finalEpoch = history.history.loss.length - 1;
  const metrics: TrainingMetrics = {
    loss: (history.history.loss[finalEpoch] as number) || 0,
  };

  // Add accuracy if available
  if (history.history.acc) {
    metrics.accuracy = (history.history.acc[finalEpoch] as number) || 0;
  }

  // Get trained weights
  const weights = getModelWeights(model);

  return {
    ...weights,
    sampleCount: dataset.sampleCount,
    metrics,
  };
}

/**
 * Evaluate model on dataset
 */
export async function evaluateModel(
  model: tf.LayersModel,
  dataset: TrainingDataset
): Promise<TrainingMetrics> {
  const evaluation = (await model.evaluate(dataset.features, dataset.labels)) as tf.Scalar[];

  const metrics: TrainingMetrics = {
    loss: (await evaluation[0].data())[0],
  };

  if (evaluation.length > 1) {
    metrics.accuracy = (await evaluation[1].data())[0];
  }

  // Cleanup
  evaluation.forEach((t) => t.dispose());

  return metrics;
}

/**
 * Apply differential privacy noise to weights (optional)
 */
export function applyDifferentialPrivacy(
  weights: { data: Float32Array[]; shapes: number[][] },
  epsilon: number,
  delta: number,
  clipNorm: number
): { data: Float32Array[]; shapes: number[][] } {
  // Calculate sensitivity
  const sensitivity = 2 * clipNorm;

  // Calculate noise scale
  const noiseScale = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;

  // Add Gaussian noise to each weight
  const noisyData = weights.data.map((weightArray) => {
    const noisy = new Float32Array(weightArray.length);
    for (let i = 0; i < weightArray.length; i++) {
      const noise = gaussianNoise(0, noiseScale);
      noisy[i] = weightArray[i] + noise;
    }
    return noisy;
  });

  return {
    data: noisyData,
    shapes: weights.shapes,
  };
}

/**
 * Generate Gaussian noise using Box-Muller transform
 */
function gaussianNoise(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Clip weights to prevent gradient explosion
 */
export function clipWeights(
  weights: { data: Float32Array[]; shapes: number[][] },
  maxNorm: number
): { data: Float32Array[]; shapes: number[][] } {
  // Calculate total norm
  let totalNorm = 0;
  weights.data.forEach((weightArray) => {
    weightArray.forEach((w) => {
      totalNorm += w * w;
    });
  });
  totalNorm = Math.sqrt(totalNorm);

  // Clip if necessary
  if (totalNorm > maxNorm) {
    const scale = maxNorm / totalNorm;
    const clippedData = weights.data.map((weightArray) => {
      const clipped = new Float32Array(weightArray.length);
      for (let i = 0; i < weightArray.length; i++) {
        clipped[i] = weightArray[i] * scale;
      }
      return clipped;
    });

    return {
      data: clippedData,
      shapes: weights.shapes,
    };
  }

  return weights;
}
