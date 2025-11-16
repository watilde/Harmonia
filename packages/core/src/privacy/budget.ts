/**
 * Privacy Budget Management
 *
 * Tracks and manages the privacy budget (epsilon, delta) consumed by
 * differential privacy mechanisms over multiple queries/rounds.
 *
 * Key concepts:
 * - Privacy budget is finite and must be carefully allocated
 * - Composition theorems allow tracking total privacy loss
 * - Once budget is exhausted, no more queries can be performed
 *
 * References:
 * - Dwork & Roth (2014). "The Algorithmic Foundations of Differential Privacy"
 * - Kairouz et al. (2015). "The Composition Theorem for Differential Privacy"
 */

import type { PrivacyBudget, DPConfig } from './types';

/**
 * Create a new privacy budget tracker
 *
 * @param totalEpsilon Total epsilon budget
 * @param totalDelta Total delta budget
 * @param maxQueries Maximum number of queries allowed
 * @returns Privacy budget tracker
 */
export function createPrivacyBudget(
  totalEpsilon: number,
  totalDelta: number,
  maxQueries: number = Infinity
): PrivacyBudget {
  if (totalEpsilon <= 0) {
    throw new Error('Total epsilon must be positive');
  }
  if (totalDelta < 0 || totalDelta >= 1) {
    throw new Error('Total delta must be in [0, 1)');
  }
  if (maxQueries <= 0) {
    throw new Error('Max queries must be positive');
  }

  return {
    totalEpsilon,
    totalDelta,
    remainingEpsilon: totalEpsilon,
    remainingDelta: 0, // Start at 0, accumulate as queries are made
    queriesExecuted: 0,
    maxQueries,
  };
}

/**
 * Check if budget is exhausted
 *
 * @param budget Privacy budget
 * @returns True if budget is exhausted
 */
export function isBudgetExhausted(budget: PrivacyBudget): boolean {
  return (
    budget.remainingEpsilon <= 0 ||
    budget.remainingDelta >= budget.totalDelta ||
    budget.queriesExecuted >= budget.maxQueries
  );
}

/**
 * Check if a query can be performed with given privacy parameters
 *
 * @param budget Privacy budget
 * @param epsilon Epsilon required for query
 * @param delta Delta required for query
 * @returns True if query can be performed
 */
export function canPerformQuery(budget: PrivacyBudget, epsilon: number, delta: number): boolean {
  if (isBudgetExhausted(budget)) {
    return false;
  }

  return budget.remainingEpsilon >= epsilon && budget.remainingDelta + delta <= budget.totalDelta;
}

/**
 * Consume privacy budget for a query
 *
 * Uses basic composition theorem:
 * - Multiple (ε_i, δ_i)-DP mechanisms compose to (Σε_i, Σδ_i)-DP
 *
 * @param budget Privacy budget (will be mutated)
 * @param epsilon Epsilon consumed
 * @param delta Delta consumed
 * @throws Error if budget is insufficient
 */
export function consumeBudget(budget: PrivacyBudget, epsilon: number, delta: number): void {
  if (!canPerformQuery(budget, epsilon, delta)) {
    throw new Error(
      `Insufficient privacy budget. ` +
        `Required: (ε=${epsilon}, δ=${delta}), ` +
        `Remaining: (ε=${budget.remainingEpsilon}, δ=${budget.remainingDelta})`
    );
  }

  budget.remainingEpsilon -= epsilon;
  budget.remainingDelta += delta;
  budget.queriesExecuted += 1;
}

/**
 * Calculate epsilon per query for uniform budget allocation
 *
 * If we have total epsilon E and want to perform T queries,
 * each query gets ε_i = E / T
 *
 * @param totalEpsilon Total epsilon budget
 * @param numQueries Number of queries to perform
 * @returns Epsilon per query
 */
export function epsilonPerQuery(totalEpsilon: number, numQueries: number): number {
  if (numQueries <= 0) {
    throw new Error('Number of queries must be positive');
  }
  return totalEpsilon / numQueries;
}

/**
 * Calculate delta per query for uniform budget allocation
 *
 * Common practice: δ_i = δ / T where T is number of queries
 *
 * @param totalDelta Total delta budget
 * @param numQueries Number of queries to perform
 * @returns Delta per query
 */
export function deltaPerQuery(totalDelta: number, numQueries: number): number {
  if (numQueries <= 0) {
    throw new Error('Number of queries must be positive');
  }
  return totalDelta / numQueries;
}

/**
 * Create DP config for a single round given total budget and number of rounds
 *
 * Uniformly allocates privacy budget across all rounds
 *
 * @param totalBudget Total privacy budget
 * @param numRounds Total number of training rounds
 * @param clipNorm Gradient clipping threshold
 * @returns DP config for one round
 */
export function createRoundConfig(
  totalBudget: PrivacyBudget,
  numRounds: number,
  clipNorm: number
): DPConfig {
  const epsilon = epsilonPerQuery(totalBudget.totalEpsilon, numRounds);
  const delta = deltaPerQuery(totalBudget.totalDelta, numRounds);

  return {
    epsilon,
    delta,
    clipNorm,
    mechanism: 'gaussian', // Gaussian for (ε, δ)-DP
  };
}

/**
 * Advanced composition using moments accountant
 *
 * Provides tighter privacy bounds than basic composition.
 * This is a simplified version - full implementation requires numerical integration.
 *
 * Reference: Abadi et al. (2016). "Deep Learning with Differential Privacy"
 *
 * @param q Sampling ratio (batch_size / dataset_size)
 * @param sigma Noise multiplier
 * @param steps Number of steps/iterations
 * @param delta Target delta
 * @returns Epsilon achieved
 */
export function momentsAccountant(q: number, sigma: number, steps: number, delta: number): number {
  // Simplified approximation of moments accountant
  // Full implementation requires computing Rényi divergence

  // This is a conservative approximation
  // For proper implementation, use Google's TensorFlow Privacy library

  if (q <= 0 || q > 1) {
    throw new Error('Sampling ratio q must be in (0, 1]');
  }
  if (sigma <= 0) {
    throw new Error('Noise multiplier sigma must be positive');
  }
  if (steps <= 0) {
    throw new Error('Steps must be positive');
  }
  if (delta <= 0 || delta >= 1) {
    throw new Error('Delta must be in (0, 1)');
  }

  // Simplified formula (conservative approximation)
  // ε ≈ (q * steps) / (2 * sigma^2) + sqrt((q * steps) / sigma^2) * sqrt(2 * ln(1/δ))

  const term1 = (q * steps) / (2 * sigma * sigma);
  const term2 = Math.sqrt((q * steps) / (sigma * sigma)) * Math.sqrt(2 * Math.log(1 / delta));

  return term1 + term2;
}

/**
 * Calculate required noise multiplier for target (ε, δ)-DP
 *
 * Inverts the moments accountant formula (approximately)
 *
 * @param q Sampling ratio
 * @param epsilon Target epsilon
 * @param steps Number of steps
 * @param delta Target delta
 * @returns Required noise multiplier
 */
export function calculateNoiseMultiplier(
  q: number,
  epsilon: number,
  steps: number,
  delta: number
): number {
  if (epsilon <= 0) {
    throw new Error('Epsilon must be positive');
  }

  // Binary search for sigma that achieves target epsilon
  let sigmaLow = 0.01;
  let sigmaHigh = 100.0;
  const tolerance = 0.01;

  while (sigmaHigh - sigmaLow > tolerance) {
    const sigmaMid = (sigmaLow + sigmaHigh) / 2;
    const achievedEpsilon = momentsAccountant(q, sigmaMid, steps, delta);

    if (achievedEpsilon > epsilon) {
      // Need more noise
      sigmaLow = sigmaMid;
    } else {
      // Can use less noise
      sigmaHigh = sigmaMid;
    }
  }

  return (sigmaLow + sigmaHigh) / 2;
}

/**
 * Get privacy budget status summary
 *
 * @param budget Privacy budget
 * @returns Human-readable summary
 */
export function getBudgetSummary(budget: PrivacyBudget): string {
  const epsilonUsed = budget.totalEpsilon - budget.remainingEpsilon;
  const epsilonPercent = (epsilonUsed / budget.totalEpsilon) * 100;
  const deltaPercent = (budget.remainingDelta / budget.totalDelta) * 100;
  const queriesPercent = (budget.queriesExecuted / budget.maxQueries) * 100;

  return `Privacy Budget Status:
  Epsilon: ${epsilonUsed.toFixed(3)} / ${budget.totalEpsilon.toFixed(3)} (${epsilonPercent.toFixed(1)}% used)
  Delta: ${budget.remainingDelta.toExponential(2)} / ${budget.totalDelta.toExponential(2)} (${deltaPercent.toFixed(1)}% used)
  Queries: ${budget.queriesExecuted} / ${budget.maxQueries} (${queriesPercent.toFixed(1)}% used)
  Status: ${isBudgetExhausted(budget) ? 'EXHAUSTED' : 'Available'}`;
}
