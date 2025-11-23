/**
 * Federated Robustness Index (FRI)
 * 
 * Aggregates site-specific E-values into a global robustness metric
 * for federated causal inference.
 */

export interface SiteEvalue {
  site_id: string;
  evalue: number;
  sample_size: number;
  interpretation?: string;
  robustness_level?: string;
}

export interface FederatedRobustnessIndex {
  // Core components
  min_evalue: number;           // Worst-case site robustness
  median_evalue: number;        // Typical robustness
  weighted_avg_evalue: number;  // Population-weighted robustness
  std_evalue: number;           // Heterogeneity across sites
  
  // Site details
  site_evalues: SiteEvalue[];
  worst_site: string;           // Site with minimum E-value
  best_site: string;            // Site with maximum E-value
  
  // Aggregation info
  weighting_strategy: string;
  total_sample_size: number;
  
  // Interpretation
  overall_robustness: 'none' | 'weak' | 'moderate' | 'good' | 'strong';
  interpretation: string;
}

export type WeightingStrategy = 
  | 'sample-size'
  | 'sqrt'
  | 'log'
  | 'equal';

/**
 * Compute Federated Robustness Index
 * 
 * @param siteEvalues - Array of site-specific E-values
 * @param strategy - Weighting strategy for aggregation
 * @returns Federated Robustness Index
 */
export function computeFRI(
  siteEvalues: SiteEvalue[],
  strategy: WeightingStrategy = 'sample-size'
): FederatedRobustnessIndex {
  if (siteEvalues.length === 0) {
    throw new Error('No site E-values provided');
  }
  
  // Extract E-values and sample sizes
  const evalues = siteEvalues.map(s => s.evalue);
  const sampleSizes = siteEvalues.map(s => s.sample_size);
  const totalN = sampleSizes.reduce((sum, n) => sum + n, 0);
  
  // Compute weights
  const weights = computeWeights(sampleSizes, strategy);
  
  // Core metrics
  const min_evalue = Math.min(...evalues);
  const median_evalue = computeMedian(evalues);
  const weighted_avg_evalue = evalues.reduce((sum, e, i) => sum + e * weights[i], 0);
  const std_evalue = computeStdDev(evalues);
  
  // Find worst and best sites
  const minIndex = evalues.indexOf(min_evalue);
  const maxIndex = evalues.indexOf(Math.max(...evalues));
  const worst_site = siteEvalues[minIndex].site_id;
  const best_site = siteEvalues[maxIndex].site_id;
  
  // Overall robustness based on minimum E-value (conservative)
  const overall_robustness = classifyRobustness(min_evalue);
  const interpretation = interpretFRI(min_evalue, std_evalue);
  
  return {
    min_evalue,
    median_evalue,
    weighted_avg_evalue,
    std_evalue,
    site_evalues: siteEvalues,
    worst_site,
    best_site,
    weighting_strategy: strategy,
    total_sample_size: totalN,
    overall_robustness,
    interpretation
  };
}

/**
 * Compute weights for aggregation
 */
function computeWeights(sampleSizes: number[], strategy: WeightingStrategy): number[] {
  let unnormalized: number[];
  
  switch (strategy) {
    case 'sample-size':
      unnormalized = sampleSizes;
      break;
    
    case 'sqrt':
      unnormalized = sampleSizes.map(n => Math.sqrt(n));
      break;
    
    case 'log':
      unnormalized = sampleSizes.map(n => Math.log(n + 1));
      break;
    
    case 'equal':
      unnormalized = sampleSizes.map(() => 1);
      break;
    
    default:
      throw new Error(`Unknown weighting strategy: ${strategy}`);
  }
  
  // Normalize to sum to 1
  const sum = unnormalized.reduce((a, b) => a + b, 0);
  return unnormalized.map(w => w / sum);
}

/**
 * Compute median
 */
function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Compute standard deviation
 */
function computeStdDev(values: number[]): number {
  const mean = values.reduce((sum, x) => sum + x, 0) / values.length;
  const variance = values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Classify overall robustness level
 */
function classifyRobustness(min_evalue: number): 'none' | 'weak' | 'moderate' | 'good' | 'strong' {
  if (min_evalue === 1) {
    return 'none';
  } else if (min_evalue < 1.5) {
    return 'weak';
  } else if (min_evalue < 2.0) {
    return 'moderate';
  } else if (min_evalue < 3.0) {
    return 'good';
  } else {
    return 'strong';
  }
}

/**
 * Interpret FRI
 */
function interpretFRI(min_evalue: number, std_evalue: number): string {
  const robustness = classifyRobustness(min_evalue);
  const heterogeneity = std_evalue < 0.5 ? 'low' : 'high';
  
  let base = '';
  
  switch (robustness) {
    case 'none':
      base = 'No robustness to unmeasured confounding across sites.';
      break;
    case 'weak':
      base = 'Weak robustness: Easily explained by weak confounding.';
      break;
    case 'moderate':
      base = 'Moderate robustness: Requires moderate confounding to explain.';
      break;
    case 'good':
      base = 'Good robustness: Requires strong confounding to explain.';
      break;
    case 'strong':
      base = 'Strong robustness: Requires very strong confounding to explain.';
      break;
  }
  
  const het = heterogeneity === 'low'
    ? 'Consistent robustness across sites.'
    : 'High heterogeneity in robustness across sites.';
  
  return `${base} ${het}`;
}

/**
 * Compare multiple aggregation strategies
 */
export function compareFRIStrategies(
  siteEvalues: SiteEvalue[]
): Record<WeightingStrategy, FederatedRobustnessIndex> {
  const strategies: WeightingStrategy[] = ['sample-size', 'sqrt', 'log', 'equal'];
  
  const results: Record<string, FederatedRobustnessIndex> = {};
  
  for (const strategy of strategies) {
    results[strategy] = computeFRI(siteEvalues, strategy);
  }
  
  return results as Record<WeightingStrategy, FederatedRobustnessIndex>;
}

/**
 * Format FRI for display
 */
export function formatFRI(fri: FederatedRobustnessIndex): string {
  const lines = [
    `Federated Robustness Index (${fri.weighting_strategy}):`,
    `  Minimum E-value:       ${fri.min_evalue.toFixed(2)} (${fri.worst_site})`,
    `  Median E-value:        ${fri.median_evalue.toFixed(2)}`,
    `  Weighted Avg E-value:  ${fri.weighted_avg_evalue.toFixed(2)}`,
    `  Heterogeneity (σ):     ${fri.std_evalue.toFixed(2)}`,
    `  Overall Robustness:    ${fri.overall_robustness}`,
    `  Interpretation:        ${fri.interpretation}`
  ];
  
  return lines.join('\n');
}

/**
 * Print detailed FRI report
 */
export function printFRIReport(fri: FederatedRobustnessIndex): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log('  Federated Robustness Index (FRI)');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Weighting Strategy: ${fri.weighting_strategy}`);
  console.log(`Total Sample Size:  ${fri.total_sample_size}`);
  console.log(`Number of Sites:    ${fri.site_evalues.length}`);
  console.log('');
  
  console.log('Core Metrics:');
  console.log(`  Minimum E-value (worst-case):    ${fri.min_evalue.toFixed(2)}`);
  console.log(`  Median E-value (typical):        ${fri.median_evalue.toFixed(2)}`);
  console.log(`  Weighted Average E-value:        ${fri.weighted_avg_evalue.toFixed(2)}`);
  console.log(`  Standard Deviation (heterog):    ${fri.std_evalue.toFixed(2)}`);
  console.log('');
  
  console.log('Site Details:');
  console.log(`  Worst robustness:  ${fri.worst_site} (E-value: ${fri.min_evalue.toFixed(2)})`);
  console.log(`  Best robustness:   ${fri.best_site} (E-value: ${Math.max(...fri.site_evalues.map(s => s.evalue)).toFixed(2)})`);
  console.log('');
  
  console.log('Overall Assessment:');
  console.log(`  Robustness Level: ${fri.overall_robustness.toUpperCase()}`);
  console.log(`  Interpretation:   ${fri.interpretation}`);
  console.log('');
  
  console.log('Site-Specific E-values:');
  for (const site of fri.site_evalues) {
    console.log(`  ${site.site_id.padEnd(15)} E-value: ${site.evalue.toFixed(2)}  (n=${site.sample_size})`);
  }
  console.log('');
  console.log('═'.repeat(70));
  console.log('');
}

/**
 * Compare FRI across strategies
 */
export function printFRIComparison(
  comparison: Record<WeightingStrategy, FederatedRobustnessIndex>
): void {
  console.log('');
  console.log('═'.repeat(70));
  console.log('  FRI Strategy Comparison');
  console.log('═'.repeat(70));
  console.log('');
  
  console.log('Strategy         Min E    Med E    Avg E    Std E    Robustness');
  console.log('-'.repeat(70));
  
  const strategies: WeightingStrategy[] = ['sample-size', 'sqrt', 'log', 'equal'];
  
  for (const strategy of strategies) {
    const fri = comparison[strategy];
    const line = [
      strategy.padEnd(15),
      fri.min_evalue.toFixed(2).padStart(7),
      fri.median_evalue.toFixed(2).padStart(7),
      fri.weighted_avg_evalue.toFixed(2).padStart(7),
      fri.std_evalue.toFixed(2).padStart(7),
      fri.overall_robustness.padEnd(10)
    ].join('  ');
    console.log(line);
  }
  
  console.log('');
  console.log('═'.repeat(70));
  console.log('');
}

/**
 * Assess heterogeneity in E-values
 */
export interface HeterogeneityAssessment {
  coefficient_of_variation: number;
  range: number;
  iqr: number; // Interquartile range
  interpretation: string;
}

export function assessHeterogeneity(siteEvalues: SiteEvalue[]): HeterogeneityAssessment {
  const evalues = siteEvalues.map(s => s.evalue);
  
  const mean = evalues.reduce((sum, e) => sum + e, 0) / evalues.length;
  const std = computeStdDev(evalues);
  const cv = std / mean;
  
  const sorted = [...evalues].sort((a, b) => a - b);
  const range = sorted[sorted.length - 1] - sorted[0];
  
  const q1_idx = Math.floor(sorted.length * 0.25);
  const q3_idx = Math.floor(sorted.length * 0.75);
  const iqr = sorted[q3_idx] - sorted[q1_idx];
  
  let interpretation: string;
  if (cv < 0.2) {
    interpretation = 'Low heterogeneity: Consistent robustness across sites';
  } else if (cv < 0.5) {
    interpretation = 'Moderate heterogeneity: Some variation in robustness';
  } else {
    interpretation = 'High heterogeneity: Substantial variation in robustness across sites';
  }
  
  return {
    coefficient_of_variation: cv,
    range,
    iqr,
    interpretation
  };
}
