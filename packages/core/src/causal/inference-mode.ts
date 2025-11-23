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
  confidence: number; // How confident we are in this mode choice (0-1)
  assumptions_met: string[];
  assumptions_violated: string[];
  recommendation: string;
}

export interface ModeThresholds {
  point_estimate_threshold: number; // Score ≥ this → point estimate
  bounds_threshold: number;         // Score ≥ this → bounds (else sensitivity)
}

const DEFAULT_THRESHOLDS: ModeThresholds = {
  point_estimate_threshold: 0.8,
  bounds_threshold: 0.4
};

/**
 * Determine inference mode based on assumption scores
 */
export function determineInferenceMode(
  scores: AssumptionScores,
  thresholds: ModeThresholds = DEFAULT_THRESHOLDS
): InferenceModeDecision {
  const { overall_score, unconfoundedness_score, positivity_score, specification_score } = scores;
  
  // Collect met and violated assumptions
  const assumptions_met: string[] = [];
  const assumptions_violated: string[] = [];
  
  if (unconfoundedness_score >= 0.7) {
    assumptions_met.push('unconfoundedness (balance achieved)');
  } else {
    assumptions_violated.push(`unconfoundedness (imbalance detected, score: ${unconfoundedness_score.toFixed(2)})`);
  }
  
  if (positivity_score >= 0.7) {
    assumptions_met.push('positivity (sufficient overlap)');
  } else {
    assumptions_violated.push(`positivity (overlap issues, score: ${positivity_score.toFixed(2)})`);
  }
  
  if (specification_score >= 0.7) {
    assumptions_met.push('specification (model fits well)');
  } else {
    assumptions_violated.push(`specification (heterogeneity detected, score: ${specification_score.toFixed(2)})`);
  }
  
  // Mode 1: Point Estimate
  if (overall_score >= thresholds.point_estimate_threshold) {
    return {
      mode: 'point-estimate',
      reason: `All assumptions reasonably satisfied (overall score: ${overall_score.toFixed(2)})`,
      confidence: overall_score,
      assumptions_met,
      assumptions_violated,
      recommendation: 'Proceed with standard point estimate (ATE). Report confidence intervals.'
    };
  }
  
  // Mode 2: Partial Identification (Bounds)
  if (overall_score >= thresholds.bounds_threshold) {
    return {
      mode: 'bounds',
      reason: `Moderate assumption violations detected (overall score: ${overall_score.toFixed(2)}). Use partial identification.`,
      confidence: overall_score,
      assumptions_met,
      assumptions_violated,
      recommendation: 'Use Manski bounds (worst-case or MTR). Report identification interval.'
    };
  }
  
  // Mode 3: Sensitivity Analysis
  return {
    mode: 'sensitivity',
    reason: `Severe assumption violations detected (overall score: ${overall_score.toFixed(2)}). Maximal robustness required.`,
    confidence: overall_score,
    assumptions_met,
    assumptions_violated,
    recommendation: 'Use Manski bounds + E-values. Report worst-case bounds and robustness metrics.'
  };
}

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
  safest_mode: InferenceMode; // Most conservative mode among sites
}

export function determineFederatedMode(
  siteScores: Map<string, AssumptionScores>,
  thresholds: ModeThresholds = DEFAULT_THRESHOLDS
): FederatedModeDecision {
  const site_modes = new Map<string, InferenceModeDecision>();
  const mode_counts = {
    'point-estimate': 0,
    'bounds': 0,
    'sensitivity': 0
  };
  
  // Determine mode for each site
  for (const [site_id, scores] of siteScores.entries()) {
    const decision = determineInferenceMode(scores, thresholds);
    site_modes.set(site_id, decision);
    mode_counts[decision.mode]++;
  }
  
  const total_sites = siteScores.size;
  const mode_distribution = {
    point_estimate: mode_counts['point-estimate'] / total_sites,
    bounds: mode_counts['bounds'] / total_sites,
    sensitivity: mode_counts['sensitivity'] / total_sites
  };
  
  // Determine overall mode: Use most conservative (safest) mode
  let overall_mode: InferenceMode;
  let safest_mode: InferenceMode;
  
  if (mode_counts['sensitivity'] > 0) {
    // Any site needs sensitivity analysis → all sites should use it
    overall_mode = 'sensitivity';
    safest_mode = 'sensitivity';
  } else if (mode_counts['bounds'] > 0) {
    // Any site needs bounds → all sites should use bounds
    overall_mode = 'bounds';
    safest_mode = 'bounds';
  } else {
    // All sites can use point estimates
    overall_mode = 'point-estimate';
    safest_mode = 'point-estimate';
  }
  
  // Generate recommendation
  let recommendation: string;
  
  if (overall_mode === 'point-estimate') {
    recommendation = `All ${total_sites} sites meet assumptions. Use standard federated ATE estimation with confidence intervals.`;
  } else if (overall_mode === 'bounds') {
    const bounds_count = mode_counts['bounds'] + mode_counts['sensitivity'];
    recommendation = `${bounds_count}/${total_sites} sites have assumption violations. Use federated Manski bounds for safe inference. Report identification intervals for each site and aggregate.`;
  } else {
    const sensitivity_count = mode_counts['sensitivity'];
    recommendation = `${sensitivity_count}/${total_sites} sites have severe assumption violations. Use federated Manski bounds + E-values. Report worst-case bounds and robustness metrics (FRI).`;
  }
  
  return {
    overall_mode,
    site_modes,
    mode_distribution,
    recommendation,
    safest_mode
  };
}

/**
 * Print inference mode decision
 */
export function printModeDecision(decision: InferenceModeDecision, site_id?: string): void {
  const prefix = site_id ? `[${site_id}]` : '';
  
  console.log('');
  console.log('─'.repeat(70));
  console.log(`${prefix} Inference Mode Decision`);
  console.log('─'.repeat(70));
  console.log('');
  console.log(`Selected Mode: ${decision.mode.toUpperCase()}`);
  console.log(`Confidence:    ${(decision.confidence * 100).toFixed(1)}%`);
  console.log('');
  console.log(`Reason: ${decision.reason}`);
  console.log('');
  
  if (decision.assumptions_met.length > 0) {
    console.log('✓ Assumptions Met:');
    decision.assumptions_met.forEach(a => console.log(`  - ${a}`));
    console.log('');
  }
  
  if (decision.assumptions_violated.length > 0) {
    console.log('✗ Assumptions Violated:');
    decision.assumptions_violated.forEach(a => console.log(`  - ${a}`));
    console.log('');
  }
  
  console.log(`Recommendation: ${decision.recommendation}`);
  console.log('');
  console.log('─'.repeat(70));
  console.log('');
}

/**
 * Print federated mode decision
 */
export function printFederatedModeDecision(decision: FederatedModeDecision): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log('  Federated Inference Mode Decision');
  console.log('═'.repeat(70));
  console.log('');
  
  console.log(`Overall Mode: ${decision.overall_mode.toUpperCase()}`);
  console.log(`Safest Mode:  ${decision.safest_mode.toUpperCase()}`);
  console.log('');
  
  console.log('Mode Distribution Across Sites:');
  console.log(`  Point Estimate: ${(decision.mode_distribution.point_estimate * 100).toFixed(1)}%`);
  console.log(`  Bounds:         ${(decision.mode_distribution.bounds * 100).toFixed(1)}%`);
  console.log(`  Sensitivity:    ${(decision.mode_distribution.sensitivity * 100).toFixed(1)}%`);
  console.log('');
  
  console.log('Site-Specific Modes:');
  for (const [site_id, site_decision] of decision.site_modes.entries()) {
    console.log(`  ${site_id.padEnd(15)} ${site_decision.mode.padEnd(20)} (confidence: ${(site_decision.confidence * 100).toFixed(1)}%)`);
  }
  console.log('');
  
  console.log(`Recommendation: ${decision.recommendation}`);
  console.log('');
  console.log('═'.repeat(70));
  console.log('');
}

/**
 * Get mode priority (for safety)
 * Higher priority = more conservative
 */
export function getModePriority(mode: InferenceMode): number {
  switch (mode) {
    case 'sensitivity': return 3;
    case 'bounds': return 2;
    case 'point-estimate': return 1;
  }
}

/**
 * Compare two modes and return the safer one
 */
export function getSaferMode(mode1: InferenceMode, mode2: InferenceMode): InferenceMode {
  return getModePriority(mode1) >= getModePriority(mode2) ? mode1 : mode2;
}
