/**
 * Differential Privacy Noise Mechanisms
 *
 * Implements Laplace and Gaussian noise addition for differential privacy.
 *
 * References:
 * - Dwork & Roth (2014). "The Algorithmic Foundations of Differential Privacy"
 * - Mironov (2012). "On significance of the least significant bits for differential privacy"
 */

import type { DPConfig, NoiseStats } from './types';

/**
 * Generate random sample from Laplace distribution
 *
 * Laplace(μ, b) has PDF: f(x) = (1/2b) * exp(-|x-μ|/b)
 *
 * @param location Location parameter (μ)
 * @param scale Scale parameter (b = Δf/ε)
 * @returns Random sample from Laplace distribution
 */
export function sampleLaplace(location: number = 0, scale: number = 1): number {
  // Use inverse transform sampling
  // If U ~ Uniform(0,1), then X = μ - b*sgn(U-0.5)*ln(1-2|U-0.5|)
  const u = Math.random();
  const sign = u < 0.5 ? -1 : 1;
  return location - scale * sign * Math.log(1 - 2 * Math.abs(u - 0.5));
}

/**
 * Generate random sample from Gaussian distribution
 *
 * Uses Box-Muller transform
 *
 * @param mean Mean (μ)
 * @param stddev Standard deviation (σ)
 * @returns Random sample from Gaussian distribution
 */
export function sampleGaussian(mean: number = 0, stddev: number = 1): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z0;
}

/**
 * Calculate Laplace noise scale for given epsilon
 *
 * Scale = sensitivity / epsilon
 * For L2 sensitivity with clipping: scale = C / epsilon
 *
 * @param sensitivity Global sensitivity (Δf)
 * @param epsilon Privacy parameter
 * @returns Noise scale
 */
export function calculateLaplaceScale(sensitivity: number, epsilon: number): number {
  if (epsilon <= 0) {
    throw new Error('Epsilon must be positive');
  }
  if (sensitivity < 0) {
    throw new Error('Sensitivity must be non-negative');
  }
  return sensitivity / epsilon;
}

/**
 * Calculate Gaussian noise standard deviation for (ε, δ)-DP
 *
 * Uses the Gaussian mechanism theorem:
 * σ = (sensitivity / epsilon) * sqrt(2 * ln(1.25/delta))
 *
 * @param sensitivity Global sensitivity (Δf)
 * @param epsilon Privacy parameter
 * @param delta Failure probability
 * @returns Noise standard deviation
 */
export function calculateGaussianStddev(
  sensitivity: number,
  epsilon: number,
  delta: number
): number {
  if (epsilon <= 0) {
    throw new Error('Epsilon must be positive');
  }
  if (delta <= 0 || delta >= 1) {
    throw new Error('Delta must be in (0, 1)');
  }
  if (sensitivity < 0) {
    throw new Error('Sensitivity must be non-negative');
  }

  // σ = (Δf / ε) * sqrt(2 * ln(1.25/δ))
  return (sensitivity / epsilon) * Math.sqrt(2 * Math.log(1.25 / delta));
}

/**
 * Add Laplace noise to a scalar value
 *
 * @param value Original value
 * @param scale Noise scale
 * @returns Noisy value
 */
export function addLaplaceNoiseScalar(value: number, scale: number): number {
  return value + sampleLaplace(0, scale);
}

/**
 * Add Gaussian noise to a scalar value
 *
 * @param value Original value
 * @param stddev Noise standard deviation
 * @returns Noisy value
 */
export function addGaussianNoiseScalar(value: number, stddev: number): number {
  return value + sampleGaussian(0, stddev);
}

/**
 * Add Laplace noise to a vector
 *
 * @param vector Original vector
 * @param scale Noise scale
 * @returns Noisy vector
 */
export function addLaplaceNoise(vector: Float32Array, scale: number): Float32Array {
  const noisy = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    noisy[i] = addLaplaceNoiseScalar(vector[i], scale);
  }
  return noisy;
}

/**
 * Add Gaussian noise to a vector
 *
 * @param vector Original vector
 * @param stddev Noise standard deviation
 * @returns Noisy vector
 */
export function addGaussianNoise(vector: Float32Array, stddev: number): Float32Array {
  const noisy = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    noisy[i] = addGaussianNoiseScalar(vector[i], stddev);
  }
  return noisy;
}

/**
 * Add noise to weights based on DP configuration
 *
 * @param weights Original weights
 * @param config DP configuration
 * @returns Noisy weights and statistics
 */
export function addNoiseToWeights(
  weights: Float32Array[],
  config: DPConfig
): { noisy: Float32Array[]; stats: NoiseStats } {
  const mechanism = config.mechanism || 'gaussian';
  const noisy: Float32Array[] = [];
  let totalNoiseMagnitude = 0;
  let totalSignalMagnitude = 0;

  if (mechanism === 'laplace') {
    const scale = calculateLaplaceScale(config.clipNorm, config.epsilon);

    for (const weight of weights) {
      const noisyWeight = addLaplaceNoise(weight, scale);
      noisy.push(noisyWeight);

      // Calculate statistics
      for (let i = 0; i < weight.length; i++) {
        totalNoiseMagnitude += Math.abs(noisyWeight[i] - weight[i]);
        totalSignalMagnitude += Math.abs(weight[i]);
      }
    }

    const totalElements = weights.reduce((sum, w) => sum + w.length, 0);
    const averageNoiseMagnitude = totalNoiseMagnitude / totalElements;
    const signalToNoiseRatio = totalSignalMagnitude / totalNoiseMagnitude;

    return {
      noisy,
      stats: {
        noiseScale: scale,
        mechanism: 'laplace',
        averageNoiseMagnitude,
        signalToNoiseRatio,
      },
    };
  } else {
    // Gaussian mechanism
    const stddev = calculateGaussianStddev(config.clipNorm, config.epsilon, config.delta);

    for (const weight of weights) {
      const noisyWeight = addGaussianNoise(weight, stddev);
      noisy.push(noisyWeight);

      // Calculate statistics
      for (let i = 0; i < weight.length; i++) {
        totalNoiseMagnitude += Math.abs(noisyWeight[i] - weight[i]);
        totalSignalMagnitude += Math.abs(weight[i]);
      }
    }

    const totalElements = weights.reduce((sum, w) => sum + w.length, 0);
    const averageNoiseMagnitude = totalNoiseMagnitude / totalElements;
    const signalToNoiseRatio = totalSignalMagnitude / totalNoiseMagnitude;

    return {
      noisy,
      stats: {
        noiseScale: stddev,
        mechanism: 'gaussian',
        averageNoiseMagnitude,
        signalToNoiseRatio,
      },
    };
  }
}
