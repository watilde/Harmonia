/**
 * Gradient Clipping for Differential Privacy
 *
 * Implements gradient clipping to bound the sensitivity of the learning algorithm.
 * This is essential for differential privacy as it ensures that any single training
 * example can only have a bounded influence on the model.
 *
 * References:
 * - Abadi et al. (2016). "Deep Learning with Differential Privacy"
 * - McMahan et al. (2018). "Learning Differentially Private Recurrent Language Models"
 */

import type { ClippingStats } from './types';

/**
 * Calculate L2 norm of a vector
 *
 * ||x||_2 = sqrt(sum(x_i^2))
 *
 * @param vector Input vector
 * @returns L2 norm
 */
export function l2Norm(vector: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}

/**
 * Calculate L2 norm of multiple weight arrays
 *
 * @param weights Array of weight tensors
 * @returns Total L2 norm
 */
export function calculateWeightsNorm(weights: Float32Array[]): number {
  let sumSquares = 0;
  for (const weight of weights) {
    for (let i = 0; i < weight.length; i++) {
      sumSquares += weight[i] * weight[i];
    }
  }
  return Math.sqrt(sumSquares);
}

/**
 * Clip a vector to maximum L2 norm
 *
 * If ||x||_2 > C, return (C / ||x||_2) * x
 * Otherwise, return x unchanged
 *
 * @param vector Input vector
 * @param maxNorm Maximum allowed norm (C)
 * @returns Clipped vector
 */
export function clipVector(vector: Float32Array, maxNorm: number): Float32Array {
  const norm = l2Norm(vector);

  if (norm <= maxNorm) {
    return vector; // No clipping needed
  }

  // Clip: multiply by C / ||x||_2
  const scale = maxNorm / norm;
  const clipped = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    clipped[i] = vector[i] * scale;
  }

  return clipped;
}

/**
 * Clip model weights to maximum L2 norm
 *
 * Clips the entire weight vector (all layers combined) to have
 * maximum L2 norm of clipNorm.
 *
 * @param weights Array of weight tensors
 * @param clipNorm Maximum allowed norm (C)
 * @returns Clipped weights and statistics
 */
export function clipWeights(
  weights: Float32Array[],
  clipNorm: number
): { clipped: Float32Array[]; stats: ClippingStats } {
  const normBefore = calculateWeightsNorm(weights);

  if (normBefore <= clipNorm) {
    // No clipping needed
    return {
      clipped: weights,
      stats: {
        clippedCount: 0,
        totalCount: 1,
        averageNormBefore: normBefore,
        averageNormAfter: normBefore,
        maxNorm: normBefore,
      },
    };
  }

  // Apply clipping: scale all weights by C / ||weights||_2
  const scale = clipNorm / normBefore;
  const clipped = weights.map((weight) => {
    const clippedWeight = new Float32Array(weight.length);
    for (let i = 0; i < weight.length; i++) {
      clippedWeight[i] = weight[i] * scale;
    }
    return clippedWeight;
  });

  const normAfter = calculateWeightsNorm(clipped);

  return {
    clipped,
    stats: {
      clippedCount: 1,
      totalCount: 1,
      averageNormBefore: normBefore,
      averageNormAfter: normAfter,
      maxNorm: normBefore,
    },
  };
}

/**
 * Clip multiple client updates
 *
 * @param updates Array of client weight updates
 * @param clipNorm Maximum allowed norm per client
 * @returns Clipped updates and combined statistics
 */
export function clipClientUpdates(
  updates: Float32Array[][],
  clipNorm: number
): { clipped: Float32Array[][]; stats: ClippingStats } {
  let totalClipped = 0;
  let totalNormBefore = 0;
  let totalNormAfter = 0;
  let maxNormObserved = 0;

  const clipped: Float32Array[][] = [];

  for (const update of updates) {
    const result = clipWeights(update, clipNorm);
    clipped.push(result.clipped);

    totalClipped += result.stats.clippedCount;
    totalNormBefore += result.stats.averageNormBefore;
    totalNormAfter += result.stats.averageNormAfter;
    maxNormObserved = Math.max(maxNormObserved, result.stats.maxNorm);
  }

  const totalCount = updates.length;

  return {
    clipped,
    stats: {
      clippedCount: totalClipped,
      totalCount,
      averageNormBefore: totalNormBefore / totalCount,
      averageNormAfter: totalNormAfter / totalCount,
      maxNorm: maxNormObserved,
    },
  };
}

/**
 * Adaptive clipping threshold
 *
 * Adjusts clipping threshold based on the quantile of gradient norms.
 * This helps reduce the amount of clipping needed while maintaining privacy.
 *
 * Reference: Andrew et al. (2021). "Differentially Private Learning with Adaptive Clipping"
 *
 * @param norms Array of gradient norms from previous round
 * @param targetQuantile Target quantile (e.g., 0.5 for median)
 * @param currentClipNorm Current clipping threshold
 * @param learningRate Learning rate for threshold adjustment
 * @returns New clipping threshold
 */
export function adaptiveClippingThreshold(
  norms: number[],
  targetQuantile: number = 0.5,
  currentClipNorm: number,
  learningRate: number = 0.2
): number {
  if (norms.length === 0) {
    return currentClipNorm;
  }

  // Calculate target quantile of norms
  const sortedNorms = [...norms].sort((a, b) => a - b);
  const index = Math.floor(norms.length * targetQuantile);
  const targetNorm = sortedNorms[index];

  // Update threshold: C_new = C_old + lr * (targetNorm - C_old)
  const newClipNorm = currentClipNorm + learningRate * (targetNorm - currentClipNorm);

  // Ensure threshold stays positive and reasonable
  return Math.max(0.1, Math.min(newClipNorm, 100.0));
}

/**
 * Calculate clipping ratio
 *
 * Ratio of samples that were clipped
 *
 * @param stats Clipping statistics
 * @returns Clipping ratio [0, 1]
 */
export function getClippingRatio(stats: ClippingStats): number {
  if (stats.totalCount === 0) {
    return 0;
  }
  return stats.clippedCount / stats.totalCount;
}

/**
 * Check if clipping threshold is appropriate
 *
 * Returns true if clipping ratio is within reasonable bounds
 * (not too high = too much information loss, not too low = wasting privacy budget)
 *
 * @param stats Clipping statistics
 * @param minRatio Minimum acceptable ratio (default: 0.1)
 * @param maxRatio Maximum acceptable ratio (default: 0.5)
 * @returns True if clipping is appropriate
 */
export function isClippingAppropriate(
  stats: ClippingStats,
  minRatio: number = 0.1,
  maxRatio: number = 0.5
): boolean {
  const ratio = getClippingRatio(stats);
  return ratio >= minRatio && ratio <= maxRatio;
}
