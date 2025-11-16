/**
 * Model utility functions
 */

import * as tf from '@tensorflow/tfjs-node';

import { ModelWeights } from '../types';

/**
 * Clone model weights
 */
export function cloneWeights(weights: ModelWeights): ModelWeights {
  return weights.map((w) => tf.clone(w));
}

/**
 * Calculate the L2 norm of model weights
 */
export function weightsNorm(weights: ModelWeights): number {
  let sumSquares = 0;
  weights.forEach((w) => {
    const squared = tf.square(w);
    sumSquares += tf.sum(squared).dataSync()[0];
    squared.dispose();
  });
  return Math.sqrt(sumSquares);
}

/**
 * Calculate the difference between two sets of weights
 */
export function weightsDifference(weights1: ModelWeights, weights2: ModelWeights): number {
  if (weights1.length !== weights2.length) {
    throw new Error('Weight arrays must have the same length');
  }

  let sumSquaredDiff = 0;
  for (let i = 0; i < weights1.length; i++) {
    const diff = tf.sub(weights1[i], weights2[i]);
    const squared = tf.square(diff);
    sumSquaredDiff += tf.sum(squared).dataSync()[0];
    diff.dispose();
    squared.dispose();
  }

  return Math.sqrt(sumSquaredDiff);
}

/**
 * Count total number of parameters in model
 */
export function countParameters(weights: ModelWeights): number {
  return weights.reduce((total, w) => total + w.size, 0);
}
