/**
 * E-value Calculator
 *
 * Implements E-value computation for sensitivity analysis in causal inference.
 * Based on VanderWeele & Ding (2017).
 *
 * E-value = minimum strength of association (on RR scale) that an unmeasured
 * confounder would need with both treatment and outcome to explain away
 * the observed effect.
 */
export interface EvalueResult {
    evalue: number;
    interpretation: string;
    robustness_level: 'none' | 'weak' | 'moderate' | 'good' | 'strong';
}
export interface BoundEvalues {
    conservative: EvalueResult;
    optimistic: EvalueResult;
    bounds_include_null: boolean;
}
/**
 * Compute E-value for a risk ratio
 *
 * Formula: E = RR + sqrt(RR * (RR - 1))
 *
 * @param RR - Risk ratio (must be >= 1; for RR < 1, use 1/RR)
 * @returns E-value
 */
export declare function computeEvalueFromRR(RR: number): number;
/**
 * Compute E-value from ATE (average treatment effect)
 *
 * For small effects, approximate: RR ≈ exp(ATE)
 * For large effects or when baseline risk known, use exact conversion
 *
 * @param ate - Average treatment effect (difference in proportions)
 * @param baseline_risk - Baseline risk P(Y=1|T=0), optional
 * @returns E-value
 */
export declare function computeEvalueFromATE(ate: number, baseline_risk?: number): EvalueResult;
/**
 * Compute E-values for partially identified bounds
 *
 * For bounds [L, U]:
 * - If 0 ∈ [L, U]: conservative E-value = 1 (no robustness)
 * - If L > 0: conservative based on L, optimistic based on U
 * - If U < 0: conservative based on |U|, optimistic based on |L|
 *
 * @param lower - Lower bound on ATE
 * @param upper - Upper bound on ATE
 * @param baseline_risk - Optional baseline risk
 * @returns Conservative and optimistic E-values
 */
export declare function computeEvaluesForBounds(lower: number, upper: number, baseline_risk?: number): BoundEvalues;
/**
 * Format E-value result for display
 */
export declare function formatEvalue(result: EvalueResult): string;
/**
 * Compute E-value for confidence interval limits
 *
 * @param ci_lower - Lower confidence limit
 * @param ci_upper - Upper confidence limit
 * @param baseline_risk - Optional baseline risk
 * @returns E-value for CI limit closer to null
 */
export declare function computeEvalueForCI(ci_lower: number, ci_upper: number, baseline_risk?: number): EvalueResult;
/**
 * Compute bias factor for given confounding strength
 *
 * Bias factor B relates observed to true effect:
 * RR_observed = RR_true * B
 *
 * For unmeasured confounder with:
 * - RR_TU: association with treatment
 * - RR_YU: association with outcome
 *
 * Bias factor: B ≈ RR_TU * RR_YU (approximation under rare outcome)
 *
 * @param RR_TU - Risk ratio for confounder-treatment association
 * @param RR_YU - Risk ratio for confounder-outcome association
 * @returns Bias factor
 */
export declare function computeBiasFactor(RR_TU: number, RR_YU: number): number;
/**
 * Find tipping point: confounding strength that nullifies effect
 *
 * @param ate - Observed ATE
 * @param baseline_risk - Optional baseline risk
 * @returns RR_TU and RR_YU needed (assuming equal) to nullify effect
 */
export declare function findTippingPoint(ate: number, baseline_risk?: number): number;
/**
 * Sensitivity analysis: attenuate effect by bias factor
 *
 * @param ate - Observed ATE
 * @param bias_factor - Bias factor to apply
 * @returns Attenuated ATE
 */
export declare function attenuateEffect(ate: number, bias_factor: number): number;
//# sourceMappingURL=evalue.d.ts.map