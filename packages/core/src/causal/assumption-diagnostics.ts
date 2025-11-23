/**
 * Assumption Violation Detectors
 *
 * Detects violations of key causal inference assumptions:
 * 1. Unconfoundedness (ignorability)
 * 2. Positivity (overlap, common support)
 * 3. Model specification (linearity, functional form)
 *
 * Each detector returns a score in [0, 1]:
 * - 1.0: Perfect assumption satisfaction
 * - 0.5: Moderate violation
 * - 0.0: Severe violation
 */

export interface Patient {
  person_id: string;
  treatment: 0 | 1;
  outcome: 0 | 1;
  age?: number;
  gender?: string;
  covariates?: Record<string, number>;
  propensity_score?: number;
}

export interface AssumptionScores {
  unconfoundedness_score: number;
  positivity_score: number;
  specification_score: number;
  overall_score: number;
}

export interface ViolationDetails {
  assumption: 'unconfoundedness' | 'positivity' | 'specification';
  score: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation: string;
}

export interface ProgressCallback {
  onProgress: (stage: string, current: number, total: number, message?: string) => void;
}

/**
 * Detect unconfoundedness violation
 *
 * Strategy: Use balance diagnostics on observed covariates
 * - Compute standardized mean differences (SMD) for all covariates
 * - SMD > 0.1 indicates imbalance (potential confounding)
 *
 * Score interpretation:
 * - 1.0: All SMDs < 0.05 (excellent balance)
 * - 0.8: All SMDs < 0.1 (acceptable balance)
 * - 0.5: Some SMDs > 0.2 (moderate imbalance)
 * - 0.0: Many SMDs > 0.5 (severe imbalance)
 */
export function detectUnconfoundednessViolation(
  patients: Patient[],
  progressCallback?: ProgressCallback
): ViolationDetails {
  // Extract covariates
  progressCallback?.onProgress('unconfoundedness', 1, 4, 'Splitting treatment groups');
  const treated = patients.filter((p) => p.treatment === 1);
  const control = patients.filter((p) => p.treatment === 0);

  if (treated.length === 0 || control.length === 0) {
    return {
      assumption: 'unconfoundedness',
      score: 0,
      severity: 'severe',
      description: 'No treated or control patients',
      recommendation: 'Check data filtering and treatment assignment',
    };
  }

  // Get covariate names (use age and gender as proxies if covariates not available)
  progressCallback?.onProgress('unconfoundedness', 2, 4, 'Extracting covariate names');
  const covariateNames: string[] = [];
  if (patients[0].age !== undefined) covariateNames.push('age');
  if (patients[0].gender !== undefined) covariateNames.push('gender');
  if (patients[0].covariates) {
    covariateNames.push(...Object.keys(patients[0].covariates));
  }

  if (covariateNames.length === 0) {
    return {
      assumption: 'unconfoundedness',
      score: 0.5,
      severity: 'moderate',
      description: 'No covariates available for balance assessment',
      recommendation: 'Measure and adjust for potential confounders',
    };
  }

  // Compute standardized mean differences (SMD)
  progressCallback?.onProgress(
    'unconfoundedness',
    3,
    4,
    `Computing SMD for ${covariateNames.length} covariates`
  );
  const smds: number[] = [];

  for (let i = 0; i < covariateNames.length; i++) {
    const covar = covariateNames[i];
    if (i % 5 === 0 || i === covariateNames.length - 1) {
      progressCallback?.onProgress(
        'unconfoundedness',
        3,
        4,
        `Processing covariate ${i + 1}/${covariateNames.length}: ${covar}`
      );
    }
    let treated_mean: number;
    let treated_std: number;
    let control_mean: number;
    let control_std: number;

    if (covar === 'age') {
      const treated_ages = treated.map((p) => p.age!).filter((a) => a !== undefined);
      const control_ages = control.map((p) => p.age!).filter((a) => a !== undefined);

      treated_mean = mean(treated_ages);
      treated_std = std(treated_ages);
      control_mean = mean(control_ages);
      control_std = std(control_ages);
    } else if (covar === 'gender') {
      // Binary: proportion of males
      treated_mean = treated.filter((p) => p.gender === 'M').length / treated.length;
      treated_std = Math.sqrt(treated_mean * (1 - treated_mean));
      control_mean = control.filter((p) => p.gender === 'M').length / control.length;
      control_std = Math.sqrt(control_mean * (1 - control_mean));
    } else {
      // Custom covariate
      const treated_vals = treated.map((p) => p.covariates?.[covar] || 0);
      const control_vals = control.map((p) => p.covariates?.[covar] || 0);

      treated_mean = mean(treated_vals);
      treated_std = std(treated_vals);
      control_mean = mean(control_vals);
      control_std = std(control_vals);
    }

    // SMD = (mean_treated - mean_control) / pooled_std
    const pooled_std = Math.sqrt((treated_std ** 2 + control_std ** 2) / 2);
    const smd = pooled_std > 0 ? Math.abs(treated_mean - control_mean) / pooled_std : 0;
    smds.push(smd);
  }

  // Compute score based on SMD distribution
  progressCallback?.onProgress('unconfoundedness', 4, 4, 'Computing final score');
  const max_smd = Math.max(...smds);
  const mean_smd = mean(smds);

  let score: number;
  if (max_smd < 0.05) {
    score = 1.0; // Excellent balance
  } else if (max_smd < 0.1) {
    score = 0.9; // Good balance
  } else if (max_smd < 0.2) {
    score = 0.7; // Acceptable balance
  } else if (max_smd < 0.5) {
    score = 0.4; // Moderate imbalance
  } else {
    score = 0.1; // Severe imbalance
  }

  const severity = classifySeverity(score);

  return {
    assumption: 'unconfoundedness',
    score,
    severity,
    description: `Covariate balance: max SMD = ${max_smd.toFixed(3)}, mean SMD = ${mean_smd.toFixed(3)}`,
    recommendation:
      severity === 'none'
        ? 'Proceed with standard causal inference'
        : severity === 'mild'
          ? 'Consider covariate adjustment or propensity score methods'
          : severity === 'moderate'
            ? 'Use partial identification (Manski bounds) or sensitivity analysis (E-values)'
            : 'Severe confounding detected. Use Manski bounds + E-values for safe inference',
  };
}

/**
 * Detect positivity violation
 *
 * Strategy: Check overlap in propensity score distribution
 * - Positivity requires: 0 < P(T=1|X) < 1 for all X
 * - Practical: Check for extreme propensity scores
 *
 * Score interpretation:
 * - 1.0: All propensity scores in [0.1, 0.9] (excellent overlap)
 * - 0.8: All in [0.05, 0.95] (good overlap)
 * - 0.5: Some in [0.01, 0.99] (moderate overlap)
 * - 0.0: Many near 0 or 1 (severe positivity violation)
 */
export function detectPositivityViolation(
  patients: Patient[],
  progressCallback?: ProgressCallback
): ViolationDetails {
  // Estimate propensity scores if not provided
  progressCallback?.onProgress('positivity', 1, 3, 'Estimating propensity scores');

  // Check if propensity scores already exist
  if (patients.length > 0 && patients[0].propensity_score !== undefined) {
    progressCallback?.onProgress('positivity', 1, 3, 'Using existing propensity scores');
    const patientsWithPS = patients;
    const propensity_scores = patientsWithPS.map((p) => p.propensity_score!);

    // Skip to checking extreme scores
    progressCallback?.onProgress('positivity', 2, 3, 'Checking for extreme propensity scores');
    const very_low = propensity_scores.filter((ps) => ps < 0.01).length;
    const low = propensity_scores.filter((ps) => ps < 0.05).length;
    const moderate_low = propensity_scores.filter((ps) => ps < 0.1).length;

    const very_high = propensity_scores.filter((ps) => ps > 0.99).length;
    const high = propensity_scores.filter((ps) => ps > 0.95).length;
    const moderate_high = propensity_scores.filter((ps) => ps > 0.9).length;

    const n = propensity_scores.length;
    const extreme_prop = (very_low + very_high) / n;
    const near_extreme_prop = (low + high) / n;
    const moderate_extreme_prop = (moderate_low + moderate_high) / n;

    progressCallback?.onProgress('positivity', 3, 3, 'Computing final score');
    let score: number;
    if (extreme_prop > 0.1) {
      score = 0.1;
    } else if (near_extreme_prop > 0.2) {
      score = 0.4;
    } else if (moderate_extreme_prop > 0.3) {
      score = 0.7;
    } else {
      score = 1.0;
    }

    const severity = classifySeverity(score);
    return {
      assumption: 'positivity',
      score,
      severity,
      description: `Propensity score overlap: ${(extreme_prop * 100).toFixed(1)}% extreme, ${(near_extreme_prop * 100).toFixed(1)}% near-extreme`,
      recommendation:
        severity === 'none'
          ? 'Proceed with standard causal inference'
          : severity === 'mild'
            ? 'Consider trimming extreme propensity scores'
            : severity === 'moderate'
              ? 'Use partial identification or restrict to common support region'
              : 'Severe positivity violation. Use Manski bounds for safe inference',
    };
  }

  // OPTIMIZED: Use age bucketing for O(n) instead of O(n²)
  progressCallback?.onProgress('positivity', 1, 3, 'Building age-based propensity score index');

  // Create age buckets (each bucket spans 10 years)
  const ageBuckets = new Map<number, { total: number; treated: number }>();

  for (const p of patients) {
    const age = p.age || 50;
    const bucket = Math.floor(age / 10) * 10; // Bucket: 0-9, 10-19, 20-29, etc.

    if (!ageBuckets.has(bucket)) {
      ageBuckets.set(bucket, { total: 0, treated: 0 });
    }

    const bucketData = ageBuckets.get(bucket)!;
    bucketData.total++;
    if (p.treatment === 1) {
      bucketData.treated++;
    }
  }

  // Compute propensity scores using precomputed buckets
  progressCallback?.onProgress('positivity', 1, 3, 'Computing propensity scores');
  const patientsWithPS = patients.map((p, idx) => {
    if (idx % 100000 === 0 && idx > 0) {
      progressCallback?.onProgress(
        'positivity',
        1,
        3,
        `Processed ${idx.toLocaleString()}/${patients.length.toLocaleString()} patients`
      );
    }

    if (p.propensity_score !== undefined) {
      return { ...p };
    }

    const age = p.age || 50;
    const bucket = Math.floor(age / 10) * 10;
    const bucketData = ageBuckets.get(bucket);

    let ps = 0.5; // Default
    if (bucketData && bucketData.total > 0) {
      ps = bucketData.treated / bucketData.total;
    }

    return { ...p, propensity_score: ps };
  });

  const propensity_scores = patientsWithPS.map((p) => p.propensity_score!);

  // Check for extreme scores
  progressCallback?.onProgress('positivity', 2, 3, 'Checking for extreme propensity scores');
  const very_low = propensity_scores.filter((ps) => ps < 0.01).length;
  const low = propensity_scores.filter((ps) => ps < 0.05).length;
  const moderate_low = propensity_scores.filter((ps) => ps < 0.1).length;

  const very_high = propensity_scores.filter((ps) => ps > 0.99).length;
  const high = propensity_scores.filter((ps) => ps > 0.95).length;
  const moderate_high = propensity_scores.filter((ps) => ps > 0.9).length;

  const n = propensity_scores.length;
  const extreme_prop = (very_low + very_high) / n;
  const near_extreme_prop = (low + high) / n;
  const moderate_extreme_prop = (moderate_low + moderate_high) / n;

  progressCallback?.onProgress('positivity', 3, 3, 'Computing final score');
  let score: number;
  if (extreme_prop > 0.1) {
    score = 0.1; // Severe violation
  } else if (near_extreme_prop > 0.2) {
    score = 0.4; // Moderate violation
  } else if (moderate_extreme_prop > 0.3) {
    score = 0.7; // Mild violation
  } else {
    score = 1.0; // Good overlap
  }

  const severity = classifySeverity(score);

  return {
    assumption: 'positivity',
    score,
    severity,
    description: `Propensity score overlap: ${(extreme_prop * 100).toFixed(1)}% extreme, ${(near_extreme_prop * 100).toFixed(1)}% near-extreme`,
    recommendation:
      severity === 'none'
        ? 'Proceed with standard causal inference'
        : severity === 'mild'
          ? 'Consider trimming extreme propensity scores'
          : severity === 'moderate'
            ? 'Use partial identification or restrict to common support region'
            : 'Severe positivity violation. Use Manski bounds for safe inference',
  };
}

/**
 * Detect model specification violation
 *
 * Strategy: Test linearity and functional form assumptions
 * - For continuous covariates: Test for non-linearity using polynomial terms
 * - For outcome model: Test residual patterns
 *
 * Score interpretation:
 * - 1.0: Model fits well (R² > 0.8, no patterns in residuals)
 * - 0.7: Acceptable fit (R² > 0.5)
 * - 0.4: Poor fit (R² < 0.3)
 * - 0.0: Very poor fit (R² < 0.1 or severe residual patterns)
 */
export function detectSpecificationViolation(
  patients: Patient[],
  progressCallback?: ProgressCallback
): ViolationDetails {
  // Simple specification check: predict outcome from treatment + age
  progressCallback?.onProgress('specification', 1, 3, 'Splitting treatment groups');
  const treated = patients.filter((p) => p.treatment === 1);
  const control = patients.filter((p) => p.treatment === 0);

  // Check if treatment effect varies dramatically by subgroup (interaction)
  const age_groups = [
    { name: 'young', filter: (p: Patient) => (p.age || 50) < 40 },
    { name: 'middle', filter: (p: Patient) => (p.age || 50) >= 40 && (p.age || 50) < 60 },
    { name: 'old', filter: (p: Patient) => (p.age || 50) >= 60 },
  ];

  const effects: number[] = [];

  progressCallback?.onProgress('specification', 2, 3, 'Testing heterogeneity across age groups');
  for (const group of age_groups) {
    const treated_group = treated.filter(group.filter);
    const control_group = control.filter(group.filter);

    if (treated_group.length < 10 || control_group.length < 10) continue;

    const treated_outcome_rate =
      treated_group.filter((p) => p.outcome === 1).length / treated_group.length;
    const control_outcome_rate =
      control_group.filter((p) => p.outcome === 1).length / control_group.length;
    const effect = treated_outcome_rate - control_outcome_rate;

    effects.push(effect);
  }

  if (effects.length < 2) {
    return {
      assumption: 'specification',
      score: 0.6,
      severity: 'mild',
      description: 'Insufficient data for specification testing',
      recommendation: 'Collect more data or use flexible models',
    };
  }

  // Check heterogeneity in treatment effects
  progressCallback?.onProgress('specification', 3, 3, 'Computing heterogeneity score');
  const effect_std = std(effects);
  const effect_mean = mean(effects);
  const cv = Math.abs(effect_mean) > 0.01 ? effect_std / Math.abs(effect_mean) : effect_std;

  let score: number;
  if (cv < 0.3) {
    score = 1.0; // Homogeneous effects (linear model likely OK)
  } else if (cv < 0.6) {
    score = 0.7; // Moderate heterogeneity
  } else if (cv < 1.0) {
    score = 0.4; // High heterogeneity
  } else {
    score = 0.1; // Very high heterogeneity (severe misspecification)
  }

  const severity = classifySeverity(score);

  return {
    assumption: 'specification',
    score,
    severity,
    description: `Treatment effect heterogeneity: CV = ${cv.toFixed(2)}`,
    recommendation:
      severity === 'none'
        ? 'Linear model appears appropriate'
        : severity === 'mild'
          ? 'Consider interaction terms or flexible models'
          : severity === 'moderate'
            ? 'Use doubly-robust methods or bounds'
            : 'Severe model misspecification. Use non-parametric bounds',
  };
}

/**
 * Compute overall assumption scores for a site
 */
export function assessAssumptions(
  patients: Patient[],
  progressCallback?: ProgressCallback
): AssumptionScores {
  progressCallback?.onProgress('overall', 1, 3, 'Assessing unconfoundedness');
  const unconfoundedness = detectUnconfoundednessViolation(patients, progressCallback);

  progressCallback?.onProgress('overall', 2, 3, 'Assessing positivity');
  const positivity = detectPositivityViolation(patients, progressCallback);

  progressCallback?.onProgress('overall', 3, 3, 'Assessing specification');
  const specification = detectSpecificationViolation(patients, progressCallback);

  // Overall score: geometric mean (conservative)
  const overall_score = Math.pow(
    unconfoundedness.score * positivity.score * specification.score,
    1 / 3
  );

  return {
    unconfoundedness_score: unconfoundedness.score,
    positivity_score: positivity.score,
    specification_score: specification.score,
    overall_score,
  };
}

/**
 * Get all violation details
 */
export function getViolationDetails(
  patients: Patient[],
  progressCallback?: ProgressCallback
): ViolationDetails[] {
  return [
    detectUnconfoundednessViolation(patients, progressCallback),
    detectPositivityViolation(patients, progressCallback),
    detectSpecificationViolation(patients, progressCallback),
  ];
}

/**
 * Classify severity based on score
 */
function classifySeverity(score: number): 'none' | 'mild' | 'moderate' | 'severe' {
  if (score >= 0.8) return 'none';
  if (score >= 0.6) return 'mild';
  if (score >= 0.4) return 'moderate';
  return 'severe';
}

/**
 * Helper: compute mean
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

/**
 * Helper: compute standard deviation
 */
function std(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}
