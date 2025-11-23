/**
 * OMOP to Causal Inference Data Extractor
 *
 * Extracts treatment and outcome data from OMOP CDM format
 * for causal inference analysis.
 */
import type { CausalDataPoint } from './partial-id';
import type { OMOPDataset } from './omop-synthetic';
/**
 * Configuration for extracting causal data from OMOP
 */
export interface OMOPExtractionConfig {
  /** Clinical scenario type */
  scenario: 'diabetes' | 'icu' | 'screening';
  /** Index date for cohort (YYYY-MM-DD) */
  indexDate: string;
  /** Follow-up window in days */
  followUpDays: number;
}
/**
 * Cohort extraction result
 */
export interface CohortExtractionResult {
  /** Causal inference data points */
  data: CausalDataPoint[];
  /** Number of patients in cohort */
  cohortSize: number;
  /** Number treated */
  numTreated: number;
  /** Number control */
  numControl: number;
  /** Scenario metadata */
  metadata: {
    scenario: string;
    indexDate: string;
    treatmentDefinition: string;
    outcomeDefinition: string;
  };
}
/**
 * Extract causal inference data from OMOP dataset
 */
export declare function extractCausalDataFromOMOP(
  dataset: OMOPDataset,
  config: OMOPExtractionConfig
): CohortExtractionResult;
/**
 * Save cohort extraction result to JSON
 */
export declare function saveCohortExtraction(
  _result: CohortExtractionResult,
  _outputPath: string
): void;
//# sourceMappingURL=omop-extractor.d.ts.map
