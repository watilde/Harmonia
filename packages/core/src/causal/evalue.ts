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
export function computeEvalueFromRR(RR: number): number {
  if (RR < 1) {
    throw new Error('RR must be >= 1. For RR < 1, use 1/RR and interpret for protective effect.');
  }

  if (RR === 1) {
    return 1; // No effect, no robustness
  }

  return RR + Math.sqrt(RR * (RR - 1));
}

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
export function computeEvalueFromATE(ate: number, baseline_risk?: number): EvalueResult {
  if (ate === 0) {
    return {
      evalue: 1,
      interpretation: 'No treatment effect (ATE = 0)',
      robustness_level: 'none',
    };
  }

  // Take absolute value for effect magnitude
  const abs_ate = Math.abs(ate);

  // Convert ATE to risk ratio
  let RR: number;

  if (baseline_risk !== undefined) {
    // Exact conversion: RR = (baseline + ATE) / baseline
    if (baseline_risk <= 0 || baseline_risk >= 1) {
      throw new Error('baseline_risk must be in (0, 1)');
    }

    const treated_risk = baseline_risk + abs_ate;
    if (treated_risk <= 0 || treated_risk > 1) {
      // ATE too extreme, use approximation
      RR = Math.exp(abs_ate);
    } else {
      RR = treated_risk / baseline_risk;
    }
  } else {
    // Approximate: RR ≈ exp(ATE) for small effects
    RR = Math.exp(abs_ate);
  }

  const evalue = computeEvalueFromRR(RR);

  return {
    evalue,
    interpretation: interpretEvalue(evalue),
    robustness_level: getRobustnessLevel(evalue),
  };
}

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
export function computeEvaluesForBounds(
  lower: number,
  upper: number,
  baseline_risk?: number
): BoundEvalues {
  // Check if bounds include null (0)
  const includes_null = lower <= 0 && upper >= 0;

  if (includes_null) {
    return {
      conservative: {
        evalue: 1,
        interpretation: 'Bounds include null effect (no robustness)',
        robustness_level: 'none',
      },
      optimistic: {
        evalue: 1,
        interpretation: 'Bounds include null effect (no robustness)',
        robustness_level: 'none',
      },
      bounds_include_null: true,
    };
  }

  // Bounds exclude null
  let conservative: EvalueResult;
  let optimistic: EvalueResult;

  if (lower > 0) {
    // Positive effect bounds
    conservative = computeEvalueFromATE(lower, baseline_risk);
    optimistic = computeEvalueFromATE(upper, baseline_risk);
  } else {
    // Negative effect bounds (both < 0)
    conservative = computeEvalueFromATE(upper, baseline_risk); // Closer to 0
    optimistic = computeEvalueFromATE(lower, baseline_risk); // Farther from 0
  }

  return {
    conservative,
    optimistic,
    bounds_include_null: false,
  };
}

/**
 * Interpret E-value magnitude
 */
function interpretEvalue(evalue: number): string {
  if (evalue === 1) {
    return 'No robustness to unmeasured confounding';
  } else if (evalue < 1.5) {
    return 'Weak robustness: Easily explained by weak confounding';
  } else if (evalue < 2.0) {
    return 'Moderate robustness: Requires moderate confounding to explain';
  } else if (evalue < 3.0) {
    return 'Good robustness: Requires strong confounding to explain';
  } else {
    return 'Strong robustness: Requires very strong confounding to explain';
  }
}

/**
 * Classify robustness level
 */
function getRobustnessLevel(evalue: number): 'none' | 'weak' | 'moderate' | 'good' | 'strong' {
  if (evalue === 1) {
    return 'none';
  } else if (evalue < 1.5) {
    return 'weak';
  } else if (evalue < 2.0) {
    return 'moderate';
  } else if (evalue < 3.0) {
    return 'good';
  } else {
    return 'strong';
  }
}

/**
 * Format E-value result for display
 */
export function formatEvalue(result: EvalueResult): string {
  return `E-value: ${result.evalue.toFixed(2)} (${result.robustness_level} - ${result.interpretation})`;
}

/**
 * Compute E-value for confidence interval limits
 *
 * @param ci_lower - Lower confidence limit
 * @param ci_upper - Upper confidence limit
 * @param baseline_risk - Optional baseline risk
 * @returns E-value for CI limit closer to null
 */
export function computeEvalueForCI(
  ci_lower: number,
  ci_upper: number,
  baseline_risk?: number
): EvalueResult {
  // CI-based E-value uses limit closer to null
  if (ci_lower > 0) {
    // Positive effect: use lower limit
    return computeEvalueFromATE(ci_lower, baseline_risk);
  } else if (ci_upper < 0) {
    // Negative effect: use upper limit (closer to 0)
    return computeEvalueFromATE(ci_upper, baseline_risk);
  } else {
    // CI includes null
    return {
      evalue: 1,
      interpretation: 'CI includes null effect (not statistically significant)',
      robustness_level: 'none',
    };
  }
}

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
export function computeBiasFactor(RR_TU: number, RR_YU: number): number {
  // Simplified bias factor (exact formula is more complex)
  return Math.sqrt(RR_TU * RR_YU);
}

/**
 * Find tipping point: confounding strength that nullifies effect
 *
 * @param ate - Observed ATE
 * @param baseline_risk - Optional baseline risk
 * @returns RR_TU and RR_YU needed (assuming equal) to nullify effect
 */
export function findTippingPoint(ate: number, baseline_risk?: number): number {
  if (ate === 0) {
    return 1; // Already null
  }

  const result = computeEvalueFromATE(ate, baseline_risk);
  return result.evalue;
}

/**
 * Sensitivity analysis: attenuate effect by bias factor
 *
 * @param ate - Observed ATE
 * @param bias_factor - Bias factor to apply
 * @returns Attenuated ATE
 */
export function attenuateEffect(ate: number, bias_factor: number): number {
  if (bias_factor <= 0) {
    throw new Error('Bias factor must be positive');
  }

  // Convert to RR scale
  const RR = Math.exp(ate);

  // Attenuate
  const RR_attenuated = RR / bias_factor;

  // Convert back to ATE
  return Math.log(RR_attenuated);
}
