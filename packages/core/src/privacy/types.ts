/**
 * Differential Privacy types and interfaces
 *
 * Based on:
 * - Dwork & Roth (2014). "The Algorithmic Foundations of Differential Privacy"
 * - McMahan et al. (2018). "Learning Differentially Private Recurrent Language Models"
 */

/**
 * Differential Privacy configuration
 */
export interface DPConfig {
  /**
   * Privacy parameter epsilon (ε)
   * Smaller values = stronger privacy
   * Typical range: 0.1 - 10
   */
  epsilon: number;

  /**
   * Privacy parameter delta (δ)
   * Probability of privacy failure
   * Typical value: 1/n^2 where n is dataset size
   */
  delta: number;

  /**
   * Gradient clipping threshold (C)
   * Maximum L2 norm of gradients
   */
  clipNorm: number;

  /**
   * Noise multiplier (σ)
   * Controls the amount of noise added
   * Calculated from epsilon and delta
   */
  noiseMultiplier?: number;

  /**
   * Mechanism type
   */
  mechanism?: 'laplace' | 'gaussian';
}

/**
 * Privacy budget tracker
 */
export interface PrivacyBudget {
  /**
   * Total epsilon budget
   */
  totalEpsilon: number;

  /**
   * Total delta budget
   */
  totalDelta: number;

  /**
   * Remaining epsilon
   */
  remainingEpsilon: number;

  /**
   * Remaining delta
   */
  remainingDelta: number;

  /**
   * Number of queries/rounds executed
   */
  queriesExecuted: number;

  /**
   * Maximum allowed queries
   */
  maxQueries: number;
}

/**
 * Clipping statistics
 */
export interface ClippingStats {
  /**
   * Number of gradients clipped
   */
  clippedCount: number;

  /**
   * Total gradients processed
   */
  totalCount: number;

  /**
   * Average norm before clipping
   */
  averageNormBefore: number;

  /**
   * Average norm after clipping
   */
  averageNormAfter: number;

  /**
   * Maximum norm observed
   */
  maxNorm: number;
}

/**
 * Noise statistics
 */
export interface NoiseStats {
  /**
   * Scale of noise added
   */
  noiseScale: number;

  /**
   * Mechanism used
   */
  mechanism: 'laplace' | 'gaussian';

  /**
   * Average magnitude of noise
   */
  averageNoiseMagnitude: number;

  /**
   * Signal-to-noise ratio
   */
  signalToNoiseRatio: number;
}

/**
 * DP-FedAvg configuration
 * Extends standard FedAvg with privacy parameters
 */
export interface DPFedAvgConfig {
  /**
   * Privacy configuration
   */
  privacy: DPConfig;

  /**
   * Aggregation strategy
   */
  strategy: 'weighted' | 'uniform';

  /**
   * Minimum number of participants
   */
  minParticipants: number;

  /**
   * Total number of training rounds
   */
  totalRounds: number;

  /**
   * Enable adaptive clipping
   */
  adaptiveClipping?: boolean;

  /**
   * Target clipping quantile (for adaptive clipping)
   */
  targetQuantile?: number;
}

/**
 * Result of DP-FedAvg aggregation
 */
export interface DPAggregationResult {
  /**
   * Aggregated weights (with noise)
   */
  weights: {
    data: Float32Array[];
    shapes: number[][];
  };

  /**
   * Privacy budget consumed
   */
  privacyBudgetConsumed: {
    epsilon: number;
    delta: number;
  };

  /**
   * Clipping statistics
   */
  clippingStats: ClippingStats;

  /**
   * Noise statistics
   */
  noiseStats: NoiseStats;

  /**
   * Number of participants
   */
  participantCount: number;
}
