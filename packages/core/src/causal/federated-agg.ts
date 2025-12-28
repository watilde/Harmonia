/**
 * Federated Aggregation for Partial Identification Bounds
 *
 * Aggregates ATE bounds from multiple sites without sharing patient-level data.
 * Implements various aggregation strategies for privacy-preserving causal inference.
 */

import type { ATEBounds } from './partial-id';

/**
 * Site-specific bounds with metadata
 */
export interface SiteBounds extends ATEBounds {
  /** Site identifier */
  siteId: string;
}

/**
 * Federated bounds result
 */
export interface FederatedBounds {
  /** Aggregated lower bound */
  lower: number;
  /** Aggregated upper bound */
  upper: number;
  /** Bound width */
  width: number;
  /** Number of sites */
  numSites: number;
  /** Total sample size across all sites */
  totalSampleSize: number;
  /** Aggregation strategy used */
  strategy: AggregationStrategy;
  /** Site-specific bounds */
  siteBounds: SiteBounds[];
}

/**
 * Aggregation strategies
 */
export type AggregationStrategy =
  | 'weighted-average' // Weight by sample size
  | 'conservative' // Take min(LB) and max(UB)
  | 'uniform' // Equal weight to all sites
  | 'inverse-width' // Weight by inverse of bound width
  | 'sqrt-n' // Weight by square root of sample size
  | 'log-n' // Weight by logarithm of sample size
  | 'power'; // Weight by power of sample size

/**
 * Configuration for federated aggregation
 */
export interface FederatedConfig {
  /** Aggregation strategy (default: 'weighted-average') */
  strategy?: AggregationStrategy;
  /** Minimum number of sites required (default: 2) */
  minSites?: number;
  /** Power parameter for 'power' strategy (default: 0.5) */
  alpha?: number;
}

/**
 * Aggregate bounds using weighted average by sample size
 *
 * This is the most common approach: sites with more data have more influence.
 */
function aggregateWeightedAverage(siteBounds: SiteBounds[]): {
  lower: number;
  upper: number;
} {
  const totalSampleSize = siteBounds.reduce((sum, site) => sum + site.sampleSize, 0);

  let weightedLower = 0;
  let weightedUpper = 0;

  for (const site of siteBounds) {
    const weight = site.sampleSize / totalSampleSize;
    weightedLower += site.lower * weight;
    weightedUpper += site.upper * weight;
  }

  return {
    lower: weightedLower,
    upper: weightedUpper,
  };
}

/**
 * Aggregate bounds conservatively (widest bounds)
 *
 * Takes the minimum lower bound and maximum upper bound across all sites.
 * This guarantees coverage if any site has valid bounds, but may be overly conservative.
 */
function aggregateConservative(siteBounds: SiteBounds[]): {
  lower: number;
  upper: number;
} {
  const lower = Math.min(...siteBounds.map((site) => site.lower));
  const upper = Math.max(...siteBounds.map((site) => site.upper));

  return { lower, upper };
}

/**
 * Aggregate bounds using uniform weights
 *
 * Each site contributes equally regardless of sample size.
 * Useful when sites are considered equally reliable despite size differences.
 */
function aggregateUniform(siteBounds: SiteBounds[]): {
  lower: number;
  upper: number;
} {
  const numSites = siteBounds.length;

  let sumLower = 0;
  let sumUpper = 0;

  for (const site of siteBounds) {
    sumLower += site.lower;
    sumUpper += site.upper;
  }

  return {
    lower: sumLower / numSites,
    upper: sumUpper / numSites,
  };
}

/**
 * Aggregate bounds using inverse-width weighting
 *
 * Sites with tighter (more informative) bounds get more weight.
 * Weight = 1 / width for each site.
 */
function aggregateInverseWidth(siteBounds: SiteBounds[]): {
  lower: number;
  upper: number;
} {
  // Compute inverse-width weights
  const weights = siteBounds.map((site) => 1 / site.width);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let weightedLower = 0;
  let weightedUpper = 0;

  for (let i = 0; i < siteBounds.length; i++) {
    const site = siteBounds[i];
    const weight = weights[i] / totalWeight;
    weightedLower += site.lower * weight;
    weightedUpper += site.upper * weight;
  }

  return {
    lower: weightedLower,
    upper: weightedUpper,
  };
}

/**
 * Aggregate bounds using square-root weighting
 *
 * Weight by sqrt(n_k) / sum(sqrt(n_j))
 * This gives less weight to large sites compared to sample-size weighting.
 */
function aggregateSqrtN(siteBounds: SiteBounds[]): {
  lower: number;
  upper: number;
} {
  // Compute sqrt weights
  const weights = siteBounds.map((site) => Math.sqrt(site.sampleSize));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let weightedLower = 0;
  let weightedUpper = 0;

  for (let i = 0; i < siteBounds.length; i++) {
    const site = siteBounds[i];
    const weight = weights[i] / totalWeight;
    weightedLower += site.lower * weight;
    weightedUpper += site.upper * weight;
  }

  return {
    lower: weightedLower,
    upper: weightedUpper,
  };
}

/**
 * Aggregate bounds using logarithmic weighting
 *
 * Weight by log(n_k) / sum(log(n_j))
 * This further reduces the influence of very large sites.
 */
function aggregateLogN(siteBounds: SiteBounds[]): {
  lower: number;
  upper: number;
} {
  // Compute log weights
  const weights = siteBounds.map((site) => Math.log(site.sampleSize));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let weightedLower = 0;
  let weightedUpper = 0;

  for (let i = 0; i < siteBounds.length; i++) {
    const site = siteBounds[i];
    const weight = weights[i] / totalWeight;
    weightedLower += site.lower * weight;
    weightedUpper += site.upper * weight;
  }

  return {
    lower: weightedLower,
    upper: weightedUpper,
  };
}

/**
 * Aggregate bounds using power weighting
 *
 * Weight by n_k^α / sum(n_j^α)
 * where α is a configurable parameter (default: 0.5).
 * α = 1.0 gives sample-size weighting, α = 0.5 gives sqrt weighting.
 */
function aggregatePower(siteBounds: SiteBounds[], alpha: number): {
  lower: number;
  upper: number;
} {
  // Compute power weights
  const weights = siteBounds.map((site) => Math.pow(site.sampleSize, alpha));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let weightedLower = 0;
  let weightedUpper = 0;

  for (let i = 0; i < siteBounds.length; i++) {
    const site = siteBounds[i];
    const weight = weights[i] / totalWeight;
    weightedLower += site.lower * weight;
    weightedUpper += site.upper * weight;
  }

  return {
    lower: weightedLower,
    upper: weightedUpper,
  };
}

/**
 * Aggregate ATE bounds from multiple sites
 *
 * Combines bounds computed at different sites without requiring patient-level
 * data sharing. Various aggregation strategies balance informativeness and
 * conservatism.
 *
 * @param siteBounds - Array of bounds from each site
 * @param config - Configuration for aggregation
 * @returns Federated bounds aggregated across sites
 *
 * @example
 * ```typescript
 * const siteBounds: SiteBounds[] = [
 *   { siteId: 'hospital-a', lower: 0.1, upper: 0.4, width: 0.3,
 *     assumption: 'mtr', sampleSize: 100 },
 *   { siteId: 'hospital-b', lower: 0.15, upper: 0.35, width: 0.2,
 *     assumption: 'mtr', sampleSize: 150 },
 * ];
 *
 * const federated = federateATEBounds(siteBounds, {
 *   strategy: 'weighted-average'
 * });
 *
 * console.log(`Federated ATE ∈ [${federated.lower}, ${federated.upper}]`);
 * console.log(`Based on ${federated.numSites} sites with n=${federated.totalSampleSize}`);
 * ```
 */
export function federateATEBounds(
  siteBounds: SiteBounds[],
  config: FederatedConfig = {}
): FederatedBounds {
  if (!siteBounds || siteBounds.length === 0) {
    throw new Error('Site bounds cannot be empty');
  }

  const strategy = config.strategy ?? 'weighted-average';
  const minSites = config.minSites ?? 2;
  const alpha = config.alpha ?? 0.5;

  if (siteBounds.length < minSites) {
    throw new Error(`At least ${minSites} sites required, got ${siteBounds.length}`);
  }

  // Check all sites use same assumption
  const assumptions = new Set(siteBounds.map((site) => site.assumption));
  if (assumptions.size > 1) {
    throw new Error(
      'All sites must use the same assumption level: ' + Array.from(assumptions).join(', ')
    );
  }

  // Aggregate based on strategy
  let aggregated: { lower: number; upper: number };

  switch (strategy) {
    case 'weighted-average':
      aggregated = aggregateWeightedAverage(siteBounds);
      break;
    case 'conservative':
      aggregated = aggregateConservative(siteBounds);
      break;
    case 'uniform':
      aggregated = aggregateUniform(siteBounds);
      break;
    case 'inverse-width':
      aggregated = aggregateInverseWidth(siteBounds);
      break;
    case 'sqrt-n':
      aggregated = aggregateSqrtN(siteBounds);
      break;
    case 'log-n':
      aggregated = aggregateLogN(siteBounds);
      break;
    case 'power':
      aggregated = aggregatePower(siteBounds, alpha);
      break;
    default:
      throw new Error(`Unknown aggregation strategy: ${strategy}`);
  }

  const totalSampleSize = siteBounds.reduce((sum, site) => sum + site.sampleSize, 0);

  return {
    lower: aggregated.lower,
    upper: aggregated.upper,
    width: aggregated.upper - aggregated.lower,
    numSites: siteBounds.length,
    totalSampleSize,
    strategy,
    siteBounds: [...siteBounds],
  };
}

/**
 * Format federated bounds for display
 */
export function formatFederatedBounds(bounds: FederatedBounds, decimals = 3): string {
  const lower = bounds.lower.toFixed(decimals);
  const upper = bounds.upper.toFixed(decimals);
  const width = bounds.width.toFixed(decimals);
  return (
    `Federated ATE ∈ [${lower}, ${upper}] ` +
    `(width=${width}, ${bounds.numSites} sites, n=${bounds.totalSampleSize}, ` +
    `strategy=${bounds.strategy})`
  );
}

/**
 * Compute communication cost (bytes transferred per site)
 *
 * Each site only needs to send:
 * - Site ID (string)
 * - Lower bound (number)
 * - Upper bound (number)
 * - Sample size (number)
 * - Assumption (string)
 */
export function computeCommunicationCost(siteBounds: SiteBounds[]): {
  bytesPerSite: number;
  totalBytes: number;
} {
  // Rough estimate:
  // Site ID: ~20 bytes
  // Lower bound: 8 bytes (double)
  // Upper bound: 8 bytes (double)
  // Sample size: 4 bytes (int)
  // Assumption: ~10 bytes (string)
  const bytesPerSite = 20 + 8 + 8 + 4 + 10;
  const totalBytes = bytesPerSite * siteBounds.length;

  return { bytesPerSite, totalBytes };
}
