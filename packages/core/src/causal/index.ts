/**
 * Causal Inference Module
 *
 * Implements federated partial identification for privacy-preserving
 * causal inference in multi-site studies.
 *
 * Key Features:
 * - Partial identification bounds (Manski framework)
 * - Federated aggregation without data sharing
 * - Multiple aggregation strategies
 * - Support for various identifying assumptions (MTR, MTS)
 *
 * @example
 * ```typescript
 * import { computeATEBounds, federateATEBounds } from '@harmonia/core/causal';
 *
 * // Compute local bounds at each site
 * const site1Bounds = computeATEBounds(site1Data, { assumption: 'mtr' });
 * const site2Bounds = computeATEBounds(site2Data, { assumption: 'mtr' });
 *
 * // Aggregate bounds federally
 * const federated = federateATEBounds(
 *   [
 *     { ...site1Bounds, siteId: 'hospital-1' },
 *     { ...site2Bounds, siteId: 'hospital-2' }
 *   ],
 *   { strategy: 'weighted-average' }
 * );
 *
 * console.log(`Federated ATE ∈ [${federated.lower}, ${federated.upper}]`);
 * ```
 *
 * @module causal
 */

export * from './partial-id';
export * from './federated-agg';
export * from './omop-synthetic';
export * from './omop-extractor';
