/**
 * Federated Aggregation Strategies
 * 
 * Implements various weighting schemes for aggregating site-specific bounds
 * into global federated bounds.
 * 
 * Weighting strategies:
 * 1. Sample-size (n): Weight by site sample size
 * 2. Square-root (√n): Compromise between equal and sample-size
 * 3. Logarithmic (log n): Down-weight large sites
 * 4. Power (n^α): Flexible family with tunable α ∈ [0,1]
 * 5. Equal: All sites weighted equally
 */

export interface ManskiBounds {
  lower: number;
  upper: number;
  width: number;
  assumption: 'worst-case' | 'mtr' | 'miv';
  n_treated: number;
  n_control: number;
  n_total: number;
}

export type WeightingStrategy = 
  | 'sample-size'      // Weight by n
  | 'sqrt'             // Weight by √n
  | 'log'              // Weight by log(n)
  | 'equal'            // Equal weights
  | 'power';           // Weight by n^α (requires alpha parameter)

export interface SiteBounds {
  site_id: string;
  bounds: ManskiBounds;
  weight?: number; // Computed weight (optional, computed by aggregation)
}

export interface AggregatedBounds {
  lower: number;
  upper: number;
  width: number;
  strategy: string;
  site_bounds: SiteBounds[];
  total_weight: number;
}

export interface AggregationOptions {
  strategy: WeightingStrategy;
  alpha?: number; // For power weighting, default 0.5
}

/**
 * Compute weight for a site based on strategy
 */
function computeWeight(
  n: number, 
  strategy: WeightingStrategy, 
  alpha: number = 0.5
): number {
  switch (strategy) {
    case 'sample-size':
      return n;
    
    case 'sqrt':
      return Math.sqrt(n);
    
    case 'log':
      return Math.log(n + 1); // +1 to avoid log(0)
    
    case 'equal':
      return 1;
    
    case 'power':
      return Math.pow(n, alpha);
    
    default:
      throw new Error(`Unknown weighting strategy: ${strategy}`);
  }
}

/**
 * Aggregate bounds across multiple sites using specified weighting strategy
 */
export function aggregateBounds(
  siteBounds: SiteBounds[],
  options: AggregationOptions = { strategy: 'sample-size' }
): AggregatedBounds {
  if (siteBounds.length === 0) {
    throw new Error('No site bounds to aggregate');
  }
  
  const { strategy, alpha = 0.5 } = options;
  
  // Compute weights for each site
  const weights = siteBounds.map(sb => 
    computeWeight(sb.bounds.n_total, strategy, alpha)
  );
  
  const total_weight = weights.reduce((sum, w) => sum + w, 0);
  
  // Normalize weights
  const normalized_weights = weights.map(w => w / total_weight);
  
  // Compute weighted average of lower and upper bounds
  let weighted_lower = 0;
  let weighted_upper = 0;
  
  for (let i = 0; i < siteBounds.length; i++) {
    const w = normalized_weights[i];
    weighted_lower += w * siteBounds[i].bounds.lower;
    weighted_upper += w * siteBounds[i].bounds.upper;
  }
  
  // Attach weights to site bounds
  const site_bounds_with_weights = siteBounds.map((sb, i) => ({
    ...sb,
    weight: normalized_weights[i]
  }));
  
  const strategy_name = strategy === 'power' 
    ? `power(α=${alpha})` 
    : strategy;
  
  return {
    lower: weighted_lower,
    upper: weighted_upper,
    width: weighted_upper - weighted_lower,
    strategy: strategy_name,
    site_bounds: site_bounds_with_weights,
    total_weight
  };
}

/**
 * Compare multiple aggregation strategies
 */
export function compareAggregationStrategies(
  siteBounds: SiteBounds[]
): Record<string, AggregatedBounds> {
  const strategies: Array<{ name: string; options: AggregationOptions }> = [
    { name: 'sample-size', options: { strategy: 'sample-size' } },
    { name: 'sqrt', options: { strategy: 'sqrt' } },
    { name: 'log', options: { strategy: 'log' } },
    { name: 'equal', options: { strategy: 'equal' } },
    { name: 'power-0.25', options: { strategy: 'power', alpha: 0.25 } },
    { name: 'power-0.5', options: { strategy: 'power', alpha: 0.5 } },
    { name: 'power-0.75', options: { strategy: 'power', alpha: 0.75 } }
  ];
  
  const results: Record<string, AggregatedBounds> = {};
  
  for (const { name, options } of strategies) {
    results[name] = aggregateBounds(siteBounds, options);
  }
  
  return results;
}

/**
 * Format aggregated bounds for display
 */
export function formatAggregatedBounds(aggregated: AggregatedBounds): string {
  return `[${aggregated.lower.toFixed(4)}, ${aggregated.upper.toFixed(4)}] ` +
         `(width: ${aggregated.width.toFixed(4)}, strategy: ${aggregated.strategy})`;
}

/**
 * Print detailed aggregation results
 */
export function printAggregationResults(aggregated: AggregatedBounds): void {
  console.log('');
  console.log(`🔀 Federated Aggregation: ${aggregated.strategy}`);
  console.log('='.repeat(60));
  console.log(`Global Bounds: [${aggregated.lower.toFixed(4)}, ${aggregated.upper.toFixed(4)}]`);
  console.log(`Width: ${aggregated.width.toFixed(4)}`);
  console.log('');
  console.log('Site Contributions:');
  
  for (const sb of aggregated.site_bounds) {
    const weight_pct = ((sb.weight || 0) * 100).toFixed(1);
    console.log(`  ${sb.site_id}:`);
    console.log(`    Bounds: [${sb.bounds.lower.toFixed(4)}, ${sb.bounds.upper.toFixed(4)}]`);
    console.log(`    Weight: ${weight_pct}% (n=${sb.bounds.n_total})`);
  }
  console.log('');
}

/**
 * Print comparison of all strategies
 */
export function printStrategyComparison(
  comparisons: Record<string, AggregatedBounds>
): void {
  console.log('');
  console.log('📊 Aggregation Strategy Comparison');
  console.log('='.repeat(60));
  console.log('');
  
  // Sort by width (ascending)
  const sorted = Object.entries(comparisons)
    .sort((a, b) => a[1].width - b[1].width);
  
  console.log('Strategy              Lower      Upper      Width');
  console.log('-'.repeat(60));
  
  for (const [name, bounds] of sorted) {
    const paddedName = name.padEnd(20);
    const lower = bounds.lower.toFixed(4).padStart(9);
    const upper = bounds.upper.toFixed(4).padStart(9);
    const width = bounds.width.toFixed(4).padStart(9);
    console.log(`${paddedName} ${lower}  ${upper}  ${width}`);
  }
  
  console.log('');
  
  // Highlight best (narrowest) and worst (widest)
  const narrowest = sorted[0];
  const widest = sorted[sorted.length - 1];
  
  console.log(`✅ Narrowest bounds: ${narrowest[0]} (width: ${narrowest[1].width.toFixed(4)})`);
  console.log(`⚠️  Widest bounds: ${widest[0]} (width: ${widest[1].width.toFixed(4)})`);
  console.log(`📏 Width reduction: ${((widest[1].width - narrowest[1].width) / widest[1].width * 100).toFixed(1)}%`);
  console.log('');
}

/**
 * Compute information loss compared to centralized bounds
 */
export function computeInformationLoss(
  federatedBounds: AggregatedBounds,
  centralizedBounds: ManskiBounds
): number {
  // Information loss = (federated_width - centralized_width) / centralized_width
  return (federatedBounds.width - centralizedBounds.width) / centralizedBounds.width;
}

/**
 * Compute heterogeneity across sites
 */
export interface HeterogeneityMetrics {
  lower_variance: number;
  upper_variance: number;
  width_variance: number;
  max_width_difference: number;
}

export function computeHeterogeneity(siteBounds: SiteBounds[]): HeterogeneityMetrics {
  const lowers = siteBounds.map(sb => sb.bounds.lower);
  const uppers = siteBounds.map(sb => sb.bounds.upper);
  const widths = siteBounds.map(sb => sb.bounds.width);
  
  const mean = (arr: number[]) => arr.reduce((sum, x) => sum + x, 0) / arr.length;
  const variance = (arr: number[]) => {
    const m = mean(arr);
    return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length;
  };
  
  return {
    lower_variance: variance(lowers),
    upper_variance: variance(uppers),
    width_variance: variance(widths),
    max_width_difference: Math.max(...widths) - Math.min(...widths)
  };
}
