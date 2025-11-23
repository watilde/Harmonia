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
export type AggregationStrategy = 'weighted-average' | 'conservative' | 'uniform' | 'inverse-width';
/**
 * Configuration for federated aggregation
 */
export interface FederatedConfig {
  /** Aggregation strategy (default: 'weighted-average') */
  strategy?: AggregationStrategy;
  /** Minimum number of sites required (default: 2) */
  minSites?: number;
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
export declare function federateATEBounds(
  siteBounds: SiteBounds[],
  config?: FederatedConfig
): FederatedBounds;
/**
 * Format federated bounds for display
 */
export declare function formatFederatedBounds(bounds: FederatedBounds, decimals?: number): string;
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
export declare function computeCommunicationCost(siteBounds: SiteBounds[]): {
  bytesPerSite: number;
  totalBytes: number;
};
//# sourceMappingURL=federated-agg.d.ts.map
