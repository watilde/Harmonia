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
    min_evalue: number;
    median_evalue: number;
    weighted_avg_evalue: number;
    std_evalue: number;
    site_evalues: SiteEvalue[];
    worst_site: string;
    best_site: string;
    weighting_strategy: string;
    total_sample_size: number;
    overall_robustness: 'none' | 'weak' | 'moderate' | 'good' | 'strong';
    interpretation: string;
}
export type WeightingStrategy = 'sample-size' | 'sqrt' | 'log' | 'equal';
/**
 * Compute Federated Robustness Index
 *
 * @param siteEvalues - Array of site-specific E-values
 * @param strategy - Weighting strategy for aggregation
 * @returns Federated Robustness Index
 */
export declare function computeFRI(siteEvalues: SiteEvalue[], strategy?: WeightingStrategy): FederatedRobustnessIndex;
/**
 * Compare multiple aggregation strategies
 */
export declare function compareFRIStrategies(siteEvalues: SiteEvalue[]): Record<WeightingStrategy, FederatedRobustnessIndex>;
/**
 * Format FRI for display
 */
export declare function formatFRI(fri: FederatedRobustnessIndex): string;
/**
 * Print detailed FRI report
 */
export declare function printFRIReport(fri: FederatedRobustnessIndex): void;
/**
 * Compare FRI across strategies
 */
export declare function printFRIComparison(comparison: Record<WeightingStrategy, FederatedRobustnessIndex>): void;
/**
 * Assess heterogeneity in E-values
 */
export interface HeterogeneityAssessment {
    coefficient_of_variation: number;
    range: number;
    iqr: number;
    interpretation: string;
}
export declare function assessHeterogeneity(siteEvalues: SiteEvalue[]): HeterogeneityAssessment;
//# sourceMappingURL=robustness-index.d.ts.map