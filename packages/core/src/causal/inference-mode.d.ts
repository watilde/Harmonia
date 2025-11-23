/**
 * Automatic Inference Mode Switcher
 *
 * Automatically selects the appropriate causal inference method based on
 * assumption violation scores:
 *
 * Mode 1: Point Estimate (score ≥ 0.8)
 *   - Standard ATE estimation
 *   - Assumes all assumptions hold
 *
 * Mode 2: Partial Identification (0.4 ≤ score < 0.8)
 *   - Manski bounds (worst-case or MTR)
 *   - Acknowledges uncertainty
 *
 * Mode 3: Sensitivity Analysis (score < 0.4)
 *   - E-values + Manski bounds
 *   - Maximally robust inference
 */
import type { AssumptionScores } from './assumption-diagnostics';
export type InferenceMode = 'point-estimate' | 'bounds' | 'sensitivity';
export interface InferenceModeDecision {
  mode: InferenceMode;
  reason: string;
  confidence: number;
  assumptions_met: string[];
  assumptions_violated: string[];
  recommendation: string;
}
export interface ModeThresholds {
  point_estimate_threshold: number;
  bounds_threshold: number;
}
/**
 * Determine inference mode based on assumption scores
 */
export declare function determineInferenceMode(
  scores: AssumptionScores,
  thresholds?: ModeThresholds
): InferenceModeDecision;
/**
 * Determine mode for multiple sites and aggregate
 */
export interface FederatedModeDecision {
  overall_mode: InferenceMode;
  site_modes: Map<string, InferenceModeDecision>;
  mode_distribution: {
    point_estimate: number;
    bounds: number;
    sensitivity: number;
  };
  recommendation: string;
  safest_mode: InferenceMode;
}
export declare function determineFederatedMode(
  siteScores: Map<string, AssumptionScores>,
  thresholds?: ModeThresholds
): FederatedModeDecision;
/**
 * Print inference mode decision
 */
export declare function printModeDecision(decision: InferenceModeDecision, site_id?: string): void;
/**
 * Print federated mode decision
 */
export declare function printFederatedModeDecision(decision: FederatedModeDecision): void;
/**
 * Get mode priority (for safety)
 * Higher priority = more conservative
 */
export declare function getModePriority(mode: InferenceMode): number;
/**
 * Compare two modes and return the safer one
 */
export declare function getSaferMode(mode1: InferenceMode, mode2: InferenceMode): InferenceMode;
//# sourceMappingURL=inference-mode.d.ts.map
