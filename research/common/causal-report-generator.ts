/**
 * Federated Causal Report Generator
 *
 * Generates comprehensive causal inference reports that include:
 * - Assumption violation assessment
 * - Inference mode selection
 * - Effect estimates (point, bounds, or E-values)
 * - Robustness metrics
 * - Recommendations for stakeholders
 */

import { AssumptionScores, ViolationDetails } from '@harmonia/core/causal';

import { InferenceModeDecision, FederatedModeDecision } from '@harmonia/core/causal';

export interface SiteReport {
  site_id: string;
  sample_size: number;

  // Assumption assessment
  assumption_scores: AssumptionScores;
  violations: ViolationDetails[];

  // Inference mode
  mode_decision: InferenceModeDecision;

  // Effect estimates (depends on mode)
  point_estimate?: {
    ate: number;
    ci_lower: number;
    ci_upper: number;
  };

  bounds?: {
    lower: number;
    upper: number;
    width: number;
  };

  evalue?: {
    point: number;
    ci_limit: number;
    robustness_level: string;
  };

  // Summary
  conclusion: string;
  recommendation: string;
}

export interface FederatedCausalReport {
  // Meta information
  study_name: string;
  generation_date: string;
  total_sites: number;
  total_sample_size: number;

  // Federated mode decision
  federated_mode: FederatedModeDecision;

  // Site-specific reports
  site_reports: SiteReport[];

  // Federated estimates (depends on mode)
  federated_point_estimate?: {
    ate: number;
    ci_lower: number;
    ci_upper: number;
    heterogeneity: string;
  };

  federated_bounds?: {
    lower: number;
    upper: number;
    width: number;
    aggregation_strategy: string;
  };

  federated_robustness?: {
    fri_min: number;
    fri_median: number;
    fri_weighted_avg: number;
    fri_std: number;
    overall_robustness: string;
  };

  // Overall conclusion
  executive_summary: string;
  detailed_findings: string[];
  limitations: string[];
  recommendations: string[];
}

/**
 * Generate site-specific report
 */
export function generateSiteReport(
  site_id: string,
  sample_size: number,
  assumption_scores: AssumptionScores,
  violations: ViolationDetails[],
  mode_decision: InferenceModeDecision,
  estimates: {
    point_estimate?: SiteReport['point_estimate'];
    bounds?: SiteReport['bounds'];
    evalue?: SiteReport['evalue'];
  }
): SiteReport {
  // Generate conclusion
  let conclusion: string;

  if (mode_decision.mode === 'point-estimate') {
    conclusion =
      `Based on ${sample_size} patients, all causal assumptions are reasonably satisfied. ` +
      `Point estimate: ATE = ${estimates.point_estimate?.ate.toFixed(3)} ` +
      `(95% CI: [${estimates.point_estimate?.ci_lower.toFixed(3)}, ${estimates.point_estimate?.ci_upper.toFixed(3)}]).`;
  } else if (mode_decision.mode === 'bounds') {
    conclusion =
      `Based on ${sample_size} patients, some assumption violations detected. ` +
      `Partial identification bounds: [${estimates.bounds?.lower.toFixed(3)}, ${estimates.bounds?.upper.toFixed(3)}] ` +
      `(width: ${estimates.bounds?.width.toFixed(3)}).`;
  } else {
    conclusion =
      `Based on ${sample_size} patients, severe assumption violations detected. ` +
      `Worst-case bounds: [${estimates.bounds?.lower.toFixed(3)}, ${estimates.bounds?.upper.toFixed(3)}]. ` +
      `E-value: ${estimates.evalue?.point.toFixed(2)} (${estimates.evalue?.robustness_level} robustness).`;
  }

  // Generate recommendation
  const recommendation = mode_decision.recommendation;

  return {
    site_id,
    sample_size,
    assumption_scores,
    violations,
    mode_decision,
    ...estimates,
    conclusion,
    recommendation,
  };
}

/**
 * Generate federated causal report
 */
export function generateFederatedReport(
  study_name: string,
  site_reports: SiteReport[],
  federated_mode: FederatedModeDecision,
  federated_estimates: {
    federated_point_estimate?: FederatedCausalReport['federated_point_estimate'];
    federated_bounds?: FederatedCausalReport['federated_bounds'];
    federated_robustness?: FederatedCausalReport['federated_robustness'];
  }
): FederatedCausalReport {
  const total_sites = site_reports.length;
  const total_sample_size = site_reports.reduce((sum, r) => sum + r.sample_size, 0);

  // Generate executive summary
  const executive_summary = generateExecutiveSummary(
    study_name,
    total_sites,
    total_sample_size,
    federated_mode,
    federated_estimates
  );

  // Generate detailed findings
  const detailed_findings = generateDetailedFindings(site_reports, federated_mode);

  // Generate limitations
  const limitations = generateLimitations(site_reports, federated_mode);

  // Generate recommendations
  const recommendations = generateRecommendations(federated_mode, federated_estimates);

  return {
    study_name,
    generation_date: new Date().toISOString(),
    total_sites,
    total_sample_size,
    federated_mode,
    site_reports,
    ...federated_estimates,
    executive_summary,
    detailed_findings,
    limitations,
    recommendations,
  };
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(
  study_name: string,
  total_sites: number,
  total_sample_size: number,
  federated_mode: FederatedModeDecision,
  federated_estimates: any
): string {
  let summary = `## Executive Summary\n\n`;
  summary += `**Study**: ${study_name}\n`;
  summary += `**Sites**: ${total_sites} sites, ${total_sample_size} total patients\n`;
  summary += `**Inference Mode**: ${federated_mode.overall_mode.toUpperCase()}\n\n`;

  if (federated_mode.overall_mode === 'point-estimate') {
    summary += `All sites met causal assumptions. `;
    summary += `Federated ATE: ${federated_estimates.federated_point_estimate?.ate.toFixed(3)} `;
    summary += `(95% CI: [${federated_estimates.federated_point_estimate?.ci_lower.toFixed(3)}, `;
    summary += `${federated_estimates.federated_point_estimate?.ci_upper.toFixed(3)}]). `;
    summary += `Conclusion: Strong evidence for causal effect.`;
  } else if (federated_mode.overall_mode === 'bounds') {
    summary += `Some sites had assumption violations. `;
    summary += `Federated bounds: [${federated_estimates.federated_bounds?.lower.toFixed(3)}, `;
    summary += `${federated_estimates.federated_bounds?.upper.toFixed(3)}] `;
    summary += `(width: ${federated_estimates.federated_bounds?.width.toFixed(3)}). `;
    summary += `Conclusion: Partial identification with quantified uncertainty.`;
  } else {
    summary += `Severe assumption violations detected at some sites. `;
    summary += `Federated worst-case bounds: [${federated_estimates.federated_bounds?.lower.toFixed(3)}, `;
    summary += `${federated_estimates.federated_bounds?.upper.toFixed(3)}]. `;
    summary += `Federated robustness (FRI min): ${federated_estimates.federated_robustness?.fri_min.toFixed(2)}. `;
    summary += `Conclusion: Conservative inference with robustness guarantees.`;
  }

  return summary;
}

/**
 * Generate detailed findings
 */
function generateDetailedFindings(
  site_reports: SiteReport[],
  federated_mode: FederatedModeDecision
): string[] {
  const findings: string[] = [];

  // Finding 1: Mode distribution
  findings.push(
    `Mode Distribution: ${(federated_mode.mode_distribution.point_estimate * 100).toFixed(0)}% point estimate, ` +
      `${(federated_mode.mode_distribution.bounds * 100).toFixed(0)}% bounds, ` +
      `${(federated_mode.mode_distribution.sensitivity * 100).toFixed(0)}% sensitivity analysis`
  );

  // Finding 2: Assumption violations
  const sites_with_violations = site_reports.filter((r) =>
    r.violations.some((v) => v.severity !== 'none')
  );
  if (sites_with_violations.length > 0) {
    findings.push(
      `Assumption Violations: ${sites_with_violations.length}/${site_reports.length} sites had violations. ` +
        `Most common: ${getMostCommonViolation(site_reports)}`
    );
  } else {
    findings.push(`Assumption Violations: None detected. All sites met assumptions.`);
  }

  // Finding 3: Effect heterogeneity
  const effect_heterogeneity = assessEffectHeterogeneity(site_reports);
  findings.push(`Effect Heterogeneity: ${effect_heterogeneity}`);

  // Finding 4: Sample size distribution
  const sample_sizes = site_reports.map((r) => r.sample_size);
  const min_n = Math.min(...sample_sizes);
  const max_n = Math.max(...sample_sizes);
  findings.push(`Sample Size Range: ${min_n} - ${max_n} patients per site`);

  return findings;
}

/**
 * Generate limitations
 */
function generateLimitations(
  site_reports: SiteReport[],
  federated_mode: FederatedModeDecision
): string[] {
  const limitations: string[] = [];

  if (federated_mode.overall_mode === 'sensitivity') {
    limitations.push('Severe assumption violations limit the precision of causal estimates');
    limitations.push('Bounds may be wide due to worst-case scenarios');
  }

  if (federated_mode.overall_mode === 'bounds') {
    limitations.push(
      'Partial identification results in wider uncertainty intervals than point estimates'
    );
  }

  // Check for small sample sizes
  const small_sites = site_reports.filter((r) => r.sample_size < 100);
  if (small_sites.length > 0) {
    limitations.push(
      `${small_sites.length} sites have small sample sizes (n < 100), limiting statistical power`
    );
  }

  // General limitations
  limitations.push('Unmeasured confounding cannot be completely ruled out');
  limitations.push('Results assume no selection bias in the federated network');

  return limitations;
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  federated_mode: FederatedModeDecision,
  _federated_estimates: any
): string[] {
  const recommendations: string[] = [];

  if (federated_mode.overall_mode === 'point-estimate') {
    recommendations.push('Standard causal inference is appropriate. Proceed with confidence.');
    recommendations.push('Report point estimates with confidence intervals.');
    recommendations.push('Consider sensitivity analysis as supplementary evidence.');
  } else if (federated_mode.overall_mode === 'bounds') {
    recommendations.push('Use partial identification bounds for conservative inference.');
    recommendations.push('Report identification intervals alongside point estimates if available.');
    recommendations.push('Investigate sources of assumption violations for future studies.');
  } else {
    recommendations.push('Use worst-case bounds + E-values for maximally robust inference.');
    recommendations.push(
      'Report FRI (Federated Robustness Index) to quantify robustness across sites.'
    );
    recommendations.push(
      'Consider collecting additional covariates to reduce unmeasured confounding.'
    );
    recommendations.push(
      'Strengthen study design (e.g., instrumental variables, randomization) for future iterations.'
    );
  }

  return recommendations;
}

/**
 * Helper: Get most common violation type
 */
function getMostCommonViolation(site_reports: SiteReport[]): string {
  const violation_counts = new Map<string, number>();

  for (const report of site_reports) {
    for (const violation of report.violations) {
      if (violation.severity !== 'none') {
        const count = violation_counts.get(violation.assumption) || 0;
        violation_counts.set(violation.assumption, count + 1);
      }
    }
  }

  let max_count = 0;
  let most_common = 'none';

  // Convert to array for iteration compatibility
  const entries = Array.from(violation_counts.entries());
  for (const [violation, count] of entries) {
    if (count > max_count) {
      max_count = count;
      most_common = violation;
    }
  }

  return most_common;
}

/**
 * Helper: Assess effect heterogeneity
 */
function assessEffectHeterogeneity(site_reports: SiteReport[]): string {
  const effects: number[] = [];

  for (const report of site_reports) {
    if (report.point_estimate) {
      effects.push(report.point_estimate.ate);
    } else if (report.bounds) {
      // Use midpoint of bounds
      effects.push((report.bounds.lower + report.bounds.upper) / 2);
    }
  }

  if (effects.length < 2) return 'Insufficient data';

  const mean_effect = effects.reduce((sum, e) => sum + e, 0) / effects.length;
  const std_effect = Math.sqrt(
    effects.reduce((sum, e) => sum + Math.pow(e - mean_effect, 2), 0) / effects.length
  );

  const cv = Math.abs(mean_effect) > 0.01 ? std_effect / Math.abs(mean_effect) : std_effect;

  if (cv < 0.3) return 'Low (consistent effects across sites)';
  if (cv < 0.6) return 'Moderate';
  return 'High (substantial variation across sites)';
}

/**
 * Print federated causal report
 */
export function printFederatedReport(report: FederatedCausalReport): void {
  console.log('');
  console.log('═'.repeat(80));
  console.log('  FEDERATED CAUSAL INFERENCE REPORT');
  console.log('═'.repeat(80));
  console.log('');

  console.log(report.executive_summary);
  console.log('');

  console.log('## Detailed Findings');
  console.log('');
  report.detailed_findings.forEach((finding, i) => {
    console.log(`${i + 1}. ${finding}`);
  });
  console.log('');

  console.log('## Site-Specific Results');
  console.log('');
  for (const site_report of report.site_reports) {
    printSiteReport(site_report);
  }

  console.log('## Limitations');
  console.log('');
  report.limitations.forEach((limitation, i) => {
    console.log(`${i + 1}. ${limitation}`);
  });
  console.log('');

  console.log('## Recommendations');
  console.log('');
  report.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
  console.log('');

  console.log('═'.repeat(80));
  console.log('');
}

/**
 * Print site-specific report
 */
function printSiteReport(report: SiteReport): void {
  console.log(`### ${report.site_id} (n=${report.sample_size})`);
  console.log('');
  console.log(`Mode: ${report.mode_decision.mode.toUpperCase()}`);
  console.log(
    `Assumption Scores: Overall=${report.assumption_scores.overall_score.toFixed(2)}, ` +
      `Unconf=${report.assumption_scores.unconfoundedness_score.toFixed(2)}, ` +
      `Positivity=${report.assumption_scores.positivity_score.toFixed(2)}, ` +
      `Spec=${report.assumption_scores.specification_score.toFixed(2)}`
  );
  console.log(`Conclusion: ${report.conclusion}`);
  console.log('');
}

/**
 * Export report to JSON
 */
export function exportReportToJSON(report: FederatedCausalReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report to Markdown
 */
export function exportReportToMarkdown(report: FederatedCausalReport): string {
  let md = `# ${report.study_name}\n\n`;
  md += `**Generated**: ${report.generation_date}\n\n`;
  md += report.executive_summary + '\n\n';

  md += `## Detailed Findings\n\n`;
  report.detailed_findings.forEach((finding, i) => {
    md += `${i + 1}. ${finding}\n`;
  });
  md += '\n';

  md += `## Site-Specific Results\n\n`;
  for (const site_report of report.site_reports) {
    md += `### ${site_report.site_id}\n\n`;
    md += `- **Sample Size**: ${site_report.sample_size}\n`;
    md += `- **Mode**: ${site_report.mode_decision.mode}\n`;
    md += `- **Conclusion**: ${site_report.conclusion}\n\n`;
  }

  md += `## Limitations\n\n`;
  report.limitations.forEach((limitation, i) => {
    md += `${i + 1}. ${limitation}\n`;
  });
  md += '\n';

  md += `## Recommendations\n\n`;
  report.recommendations.forEach((rec, i) => {
    md += `${i + 1}. ${rec}\n`;
  });
  md += '\n';

  return md;
}
