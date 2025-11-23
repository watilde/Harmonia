'use strict';
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.computeATEBounds = computeATEBounds;
exports.checkCoverage = checkCoverage;
exports.formatBounds = formatBounds;
exports.computeBoundsOverlap = computeBoundsOverlap;
exports.computeAllBounds = computeAllBounds;
/**
 * Compute mean outcome for treated and control groups
 */
function computeGroupMeans(data) {
  let treatedSum = 0;
  let treatedWeight = 0;
  let controlSum = 0;
  let controlWeight = 0;
  for (const point of data) {
    const weight = point.weight ?? 1;
    if (point.treatment === 1) {
      treatedSum += point.outcome * weight;
      treatedWeight += weight;
    } else {
      controlSum += point.outcome * weight;
      controlWeight += weight;
    }
  }
  if (treatedWeight === 0 || controlWeight === 0) {
    throw new Error('Data must contain both treated and control observations');
  }
  return {
    treated: {
      mean: treatedSum / treatedWeight,
      n: treatedWeight,
    },
    control: {
      mean: controlSum / controlWeight,
      n: controlWeight,
    },
  };
}
/**
 * Compute worst-case bounds (no assumptions)
 *
 * Bounds: [E[Y|T=1] - y_max, E[Y|T=1] - y_min]
 *
 * These bounds make no assumptions about treatment effects or selection.
 * They are the widest possible bounds but always valid.
 */
function computeWorstCaseBounds(means, yMin, yMax) {
  return {
    lower: means.treated.mean - yMax,
    upper: means.treated.mean - yMin,
  };
}
/**
 * Compute MTR bounds (Monotone Treatment Response)
 *
 * Assumption: Y(1) >= Y(0) (treatment doesn't harm)
 * Bounds: [E[Y|T=1] - E[Y|T=0], min(y_max, E[Y|T=1]) - y_min]
 *
 * MTR is reasonable when treatment is expected to help or have no effect.
 */
function computeMTRBounds(means, yMin, yMax) {
  return {
    lower: means.treated.mean - means.control.mean,
    upper: Math.min(yMax, means.treated.mean) - yMin,
  };
}
/**
 * Compute MTS bounds (Monotone Treatment Selection)
 *
 * Assumption: E[Y(0)|T=1] >= E[Y(0)|T=0] (those who take treatment would
 * have better outcomes even without treatment)
 * Bounds: [E[Y|T=1] - y_max, E[Y|T=0] - y_min]
 *
 * MTS is reasonable when treatment is given to healthier/higher-risk patients.
 */
function computeMTSBounds(means, yMin, yMax) {
  return {
    lower: means.treated.mean - yMax,
    upper: means.control.mean - yMin,
  };
}
/**
 * Compute MTR+MTS bounds (both assumptions)
 *
 * Combining both assumptions gives tighter bounds.
 * Bounds: [E[Y|T=1] - E[Y|T=0], E[Y|T=0] - y_min]
 */
function computeMTRMTSBounds(means, yMin) {
  return {
    lower: means.treated.mean - means.control.mean,
    upper: means.control.mean - yMin,
  };
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
function computeATEBounds(data, config = {}) {
  if (!data || data.length === 0) {
    throw new Error('Data cannot be empty');
  }
  const assumption = config.assumption ?? 'worst-case';
  const yMin = config.yMin ?? 0;
  const yMax = config.yMax ?? 1;
  if (yMin >= yMax) {
    throw new Error('yMin must be less than yMax');
  }
  // Compute group means
  const means = computeGroupMeans(data);
  // Compute bounds based on assumption
  let bounds;
  switch (assumption) {
    case 'worst-case':
      bounds = computeWorstCaseBounds(means, yMin, yMax);
      break;
    case 'mtr':
      bounds = computeMTRBounds(means, yMin, yMax);
      break;
    case 'mts':
      bounds = computeMTSBounds(means, yMin, yMax);
      break;
    case 'mtr-mts':
      bounds = computeMTRMTSBounds(means, yMin);
      break;
    default:
      throw new Error(`Unknown assumption: ${assumption}`);
  }
  return {
    lower: bounds.lower,
    upper: bounds.upper,
    width: bounds.upper - bounds.lower,
    assumption,
    sampleSize: data.length,
  };
}
/**
 * Check if true ATE is contained in bounds (for validation)
 */
function checkCoverage(bounds, trueATE) {
  return trueATE >= bounds.lower && trueATE <= bounds.upper;
}
/**
 * Format bounds for display
 */
function formatBounds(bounds, decimals = 3) {
  const lower = bounds.lower.toFixed(decimals);
  const upper = bounds.upper.toFixed(decimals);
  const width = bounds.width.toFixed(decimals);
  return `ATE ∈ [${lower}, ${upper}] (width=${width}, n=${bounds.sampleSize}, assumption=${bounds.assumption})`;
}
/**
 * Compute the overlap between two bounds
 *
 * @param bounds1 - First bounds
 * @param bounds2 - Second bounds
 * @returns Width of the overlapping region (0 if no overlap)
 */
function computeBoundsOverlap(bounds1, bounds2) {
  const overlapLower = Math.max(bounds1.lower, bounds2.lower);
  const overlapUpper = Math.min(bounds1.upper, bounds2.upper);
  if (overlapUpper < overlapLower) {
    return 0; // No overlap
  }
  return overlapUpper - overlapLower;
}
/**
 * Compute all bounds for comparison across different assumptions
 *
 * @param data - Array of observations
 * @param config - Optional configuration (yMin, yMax)
 * @returns Object with bounds under different assumptions
 */
function computeAllBounds(data, config = {}) {
  return {
    worstCase: computeATEBounds(data, { ...config, assumption: 'worst-case' }),
    mtr: computeATEBounds(data, { ...config, assumption: 'mtr' }),
    mts: computeATEBounds(data, { ...config, assumption: 'mts' }),
    mtrMts: computeATEBounds(data, { ...config, assumption: 'mtr-mts' }),
  };
}
//# sourceMappingURL=partial-id.js.map
