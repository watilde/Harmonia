/**
 * Partial Identification for Causal Inference
 *
 * Implements Manski's partial identification framework for computing
 * sharp bounds on Average Treatment Effects (ATE) without untestable
 * assumptions about unmeasured confounding.
 *
 * References:
 * - Manski, C. F. (1990). Nonparametric Bounds on Treatment Effects
 * - Manski, C. F. (2003). Partial Identification of Probability Distributions
 */
/**
 * Data point for causal inference
 */
export interface CausalDataPoint {
    /** Treatment indicator (0 or 1) */
    treatment: 0 | 1;
    /** Outcome value (0 to 1 for binary, 0-1 range for continuous) */
    outcome: number;
    /** Optional: Sample weight */
    weight?: number;
}
/**
 * Type alias for backward compatibility with manski-bounds.ts
 * @deprecated Use ATEBounds instead
 */
export type ManskiBounds = ATEBounds;
/**
 * Bounds on Average Treatment Effect
 */
export interface ATEBounds {
    /** Lower bound */
    lower: number;
    /** Upper bound */
    upper: number;
    /** Bound width (upper - lower) */
    width: number;
    /** Assumption level used */
    assumption: 'worst-case' | 'mtr' | 'mts' | 'mtr-mts';
    /** Sample size */
    sampleSize: number;
}
/**
 * Configuration for bound computation
 */
export interface BoundsConfig {
    /** Assumption level (default: 'worst-case') */
    assumption?: 'worst-case' | 'mtr' | 'mts' | 'mtr-mts';
    /** Minimum outcome value (default: 0) */
    yMin?: number;
    /** Maximum outcome value (default: 1) */
    yMax?: number;
}
/**
 * Compute sharp bounds on Average Treatment Effect (ATE)
 *
 * The ATE is defined as: E[Y(1) - Y(0)]
 * where Y(1) is the potential outcome under treatment,
 * and Y(0) is the potential outcome under control.
 *
 * This function computes sharp bounds on the ATE using various
 * identification assumptions, from weakest (worst-case) to strongest (MTR+MTS).
 *
 * @param data - Array of observations with treatment and outcome
 * @param config - Configuration for bound computation
 * @returns Sharp bounds on the ATE
 *
 * @example
 * ```typescript
 * const data: CausalDataPoint[] = [
 *   { treatment: 1, outcome: 0.8 },
 *   { treatment: 1, outcome: 0.7 },
 *   { treatment: 0, outcome: 0.5 },
 *   { treatment: 0, outcome: 0.6 },
 * ];
 *
 * // Worst-case bounds (no assumptions)
 * const worstCase = computeATEBounds(data, { assumption: 'worst-case' });
 * console.log(`ATE ∈ [${worstCase.lower}, ${worstCase.upper}]`);
 *
 * // MTR bounds (treatment doesn't harm)
 * const mtr = computeATEBounds(data, { assumption: 'mtr' });
 * console.log(`ATE ∈ [${mtr.lower}, ${mtr.upper}] (assuming MTR)`);
 * ```
 */
export declare function computeATEBounds(data: CausalDataPoint[], config?: BoundsConfig): ATEBounds;
/**
 * Check if true ATE is contained in bounds (for validation)
 */
export declare function checkCoverage(bounds: ATEBounds, trueATE: number): boolean;
/**
 * Format bounds for display
 */
export declare function formatBounds(bounds: ATEBounds, decimals?: number): string;
/**
 * Compute the overlap between two bounds
 *
 * @param bounds1 - First bounds
 * @param bounds2 - Second bounds
 * @returns Width of the overlapping region (0 if no overlap)
 */
export declare function computeBoundsOverlap(bounds1: ATEBounds, bounds2: ATEBounds): number;
/**
 * Compute all bounds for comparison across different assumptions
 *
 * @param data - Array of observations
 * @param config - Optional configuration (yMin, yMax)
 * @returns Object with bounds under different assumptions
 */
export declare function computeAllBounds(data: CausalDataPoint[], config?: Omit<BoundsConfig, 'assumption'>): {
    worstCase: ATEBounds;
    mtr: ATEBounds;
    mts: ATEBounds;
    mtrMts: ATEBounds;
};
//# sourceMappingURL=partial-id.d.ts.map