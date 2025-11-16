/**
 * Differential Privacy Module
 *
 * Provides differential privacy mechanisms for federated learning.
 *
 * Main components:
 * - Noise mechanisms (Laplace, Gaussian)
 * - Gradient clipping
 * - Privacy budget management
 * - DP-FedAvg algorithm
 */

// Types
export type {
  DPConfig,
  PrivacyBudget,
  ClippingStats,
  NoiseStats,
  DPFedAvgConfig,
  DPAggregationResult,
} from './types';

// Noise mechanisms
export {
  sampleLaplace,
  sampleGaussian,
  calculateLaplaceScale,
  calculateGaussianStddev,
  addLaplaceNoise,
  addGaussianNoise,
  addNoiseToWeights,
} from './noise';

// Gradient clipping
export {
  l2Norm,
  calculateWeightsNorm,
  clipVector,
  clipWeights,
  clipClientUpdates,
  adaptiveClippingThreshold,
  getClippingRatio,
  isClippingAppropriate,
} from './clipping';

// Privacy budget
export {
  createPrivacyBudget,
  isBudgetExhausted,
  canPerformQuery,
  consumeBudget,
  epsilonPerQuery,
  deltaPerQuery,
  createRoundConfig,
  momentsAccountant,
  calculateNoiseMultiplier,
  getBudgetSummary,
} from './budget';
