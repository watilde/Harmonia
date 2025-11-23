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
export declare function detectUnconfoundednessViolation(patients: Patient[]): ViolationDetails;
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
export declare function detectPositivityViolation(patients: Patient[]): ViolationDetails;
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
export declare function detectSpecificationViolation(patients: Patient[]): ViolationDetails;
/**
 * Compute overall assumption scores for a site
 */
export declare function assessAssumptions(patients: Patient[]): AssumptionScores;
/**
 * Get all violation details
 */
export declare function getViolationDetails(patients: Patient[]): ViolationDetails[];
//# sourceMappingURL=assumption-diagnostics.d.ts.map
