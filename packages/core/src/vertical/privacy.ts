/**
 * Privacy Protection for Vertical Federated Learning
 *
 * Applies differential privacy to embeddings and gradients to prevent
 * information leakage through intermediate representations.
 */

import { clipVector, l2Norm } from '../privacy/clipping';
import { calculateGaussianStddev } from '../privacy/noise';
import type { VFLPrivacyConfig, EmbeddingUpdate, GradientUpdate } from './types';

/**
 * Add differential privacy noise to embeddings
 */
export function addDPToEmbeddings(
  embeddings: Float32Array,
  shape: [number, number],
  config: VFLPrivacyConfig
): {
  noisy: Float32Array;
  stats: { noiseMagnitude: number; clippedNorm: number };
} {
  if (!config.embeddingDP.enabled) {
    return {
      noisy: embeddings,
      stats: { noiseMagnitude: 0, clippedNorm: 0 },
    };
  }

  const [batchSize, embeddingDim] = shape;
  const noisy = new Float32Array(embeddings.length);
  let totalClippedNorm = 0;
  let totalNoiseMagnitude = 0;

  // Calculate noise scale
  const sigma = calculateGaussianStddev(
    config.embeddingDP.clipNorm,
    config.embeddingDP.epsilon,
    config.embeddingDP.delta
  );

  // Process each sample in the batch
  for (let i = 0; i < batchSize; i++) {
    const start = i * embeddingDim;
    const end = start + embeddingDim;
    const sample = embeddings.slice(start, end);

    // Clip embedding norm
    const clipped = clipVector(sample, config.embeddingDP.clipNorm);
    const normAfter = l2Norm(clipped);
    totalClippedNorm += normAfter;

    // Add Gaussian noise
    for (let j = 0; j < embeddingDim; j++) {
      const noise = gaussianRandom(0, sigma);
      noisy[start + j] = clipped[j] + noise;
      totalNoiseMagnitude += noise * noise;
    }
  }

  return {
    noisy,
    stats: {
      noiseMagnitude: Math.sqrt(totalNoiseMagnitude / embeddings.length),
      clippedNorm: totalClippedNorm / batchSize,
    },
  };
}

/**
 * Add differential privacy noise to gradients
 */
export function addDPToGradients(
  gradients: Float32Array,
  shape: [number, number],
  config: VFLPrivacyConfig
): {
  noisy: Float32Array;
  stats: { noiseMagnitude: number; clippedNorm: number };
} {
  if (!config.gradientDP.enabled) {
    return {
      noisy: gradients,
      stats: { noiseMagnitude: 0, clippedNorm: 0 },
    };
  }

  const [batchSize, embeddingDim] = shape;
  const noisy = new Float32Array(gradients.length);
  let totalClippedNorm = 0;
  let totalNoiseMagnitude = 0;

  // Calculate noise scale
  const sigma = calculateGaussianStddev(
    config.gradientDP.clipNorm,
    config.gradientDP.epsilon,
    config.gradientDP.delta
  );

  // Process each sample in the batch
  for (let i = 0; i < batchSize; i++) {
    const start = i * embeddingDim;
    const end = start + embeddingDim;
    const sample = gradients.slice(start, end);

    // Clip gradient norm
    const clipped = clipVector(sample, config.gradientDP.clipNorm);
    const normAfter = l2Norm(clipped);
    totalClippedNorm += normAfter;

    // Add Gaussian noise
    for (let j = 0; j < embeddingDim; j++) {
      const noise = gaussianRandom(0, sigma);
      noisy[start + j] = clipped[j] + noise;
      totalNoiseMagnitude += noise * noise;
    }
  }

  return {
    noisy,
    stats: {
      noiseMagnitude: Math.sqrt(totalNoiseMagnitude / gradients.length),
      clippedNorm: totalClippedNorm / batchSize,
    },
  };
}

/**
 * Apply privacy protection to embedding update
 */
export function protectEmbeddingUpdate(
  update: EmbeddingUpdate,
  config: VFLPrivacyConfig
): EmbeddingUpdate {
  const { noisy, stats } = addDPToEmbeddings(
    update.embeddings.data,
    update.embeddings.shape,
    config
  );

  return {
    ...update,
    embeddings: {
      data: noisy,
      shape: update.embeddings.shape,
    },
    privacyStats: {
      noiseMagnitude: stats.noiseMagnitude,
      clippedNorm: stats.clippedNorm,
    },
  };
}

/**
 * Apply privacy protection to gradient update
 */
export function protectGradientUpdate(
  update: GradientUpdate,
  config: VFLPrivacyConfig
): GradientUpdate {
  const { noisy, stats } = addDPToGradients(update.gradients.data, update.gradients.shape, config);

  return {
    ...update,
    gradients: {
      data: noisy,
      shape: update.gradients.shape,
    },
    privacyStats: {
      noiseMagnitude: stats.noiseMagnitude,
      clippedNorm: stats.clippedNorm,
    },
  };
}

/**
 * Calculate total privacy budget used across rounds
 */
export function calculateVFLPrivacyBudget(
  rounds: number,
  config: VFLPrivacyConfig
): { epsilon: number; delta: number } {
  let totalEpsilon = 0;
  let totalDelta = 0;

  // Embedding DP budget (forward pass)
  if (config.embeddingDP.enabled) {
    totalEpsilon += config.embeddingDP.epsilon * rounds;
    totalDelta += config.embeddingDP.delta * rounds;
  }

  // Gradient DP budget (backward pass)
  if (config.gradientDP.enabled) {
    totalEpsilon += config.gradientDP.epsilon * rounds;
    totalDelta += config.gradientDP.delta * rounds;
  }

  return { epsilon: totalEpsilon, delta: totalDelta };
}

/**
 * Validate privacy configuration
 */
export function validatePrivacyConfig(config: VFLPrivacyConfig): void {
  if (config.embeddingDP.enabled) {
    if (config.embeddingDP.epsilon <= 0) {
      throw new Error('Embedding epsilon must be positive');
    }
    if (config.embeddingDP.delta < 0 || config.embeddingDP.delta >= 1) {
      throw new Error('Embedding delta must be in [0, 1)');
    }
    if (config.embeddingDP.clipNorm <= 0) {
      throw new Error('Embedding clip norm must be positive');
    }
  }

  if (config.gradientDP.enabled) {
    if (config.gradientDP.epsilon <= 0) {
      throw new Error('Gradient epsilon must be positive');
    }
    if (config.gradientDP.delta < 0 || config.gradientDP.delta >= 1) {
      throw new Error('Gradient delta must be in [0, 1)');
    }
    if (config.gradientDP.clipNorm <= 0) {
      throw new Error('Gradient clip norm must be positive');
    }
  }
}

/**
 * Generate Gaussian random number using Box-Muller transform
 */
function gaussianRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z0;
}

/**
 * Create default VFL privacy configuration for medical applications
 */
export function createDefaultVFLPrivacyConfig(): VFLPrivacyConfig {
  return {
    embeddingDP: {
      enabled: true,
      epsilon: 1.0, // Stronger privacy for embeddings (can reveal more)
      delta: 1e-5,
      clipNorm: 1.0,
    },
    gradientDP: {
      enabled: true,
      epsilon: 1.0,
      delta: 1e-5,
      clipNorm: 1.0,
    },
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
    },
  };
}
