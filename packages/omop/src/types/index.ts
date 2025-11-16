/**
 * OMOP CDM type definitions
 */

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  type: 'postgresql' | 'sqlserver';
  host: string;
  port: number;
  database: string;
  schema: string;
  username: string;
  password: string;
  ssl?: boolean;
}

/**
 * OMOP CDM version
 */
export type OMOPVersion = '5.3' | '5.4';

/**
 * Cohort definition
 */
export interface CohortDefinition {
  cohortId: number;
  cohortName: string;
  description?: string;
  definition: CohortCriteria;
}

/**
 * Cohort selection criteria
 */
export interface CohortCriteria {
  inclusionRules: InclusionRule[];
  exclusionRules?: ExclusionRule[];
  observationWindow?: ObservationWindow;
}

/**
 * Inclusion rule for cohort
 */
export interface InclusionRule {
  ruleId: number;
  name: string;
  conceptIds: number[];
  domains: OMOPDomain[];
  minOccurrences?: number;
  dateRange?: DateRange;
}

/**
 * Exclusion rule for cohort
 */
export interface ExclusionRule {
  ruleId: number;
  name: string;
  conceptIds: number[];
  domains: OMOPDomain[];
}

/**
 * OMOP domain types
 */
export type OMOPDomain =
  | 'Condition'
  | 'Drug'
  | 'Procedure'
  | 'Measurement'
  | 'Observation'
  | 'Device';

/**
 * Date range specification
 */
export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Observation window for cohort
 */
export interface ObservationWindow {
  priorDays: number;
  postDays: number;
}

/**
 * Patient features extracted from OMOP
 */
export interface PatientFeatures {
  personId: number;
  features: Record<string, number | string | boolean>;
  indexDate: Date;
}

/**
 * Feature definition
 */
export interface FeatureDefinition {
  featureName: string;
  featureType: 'numeric' | 'categorical' | 'binary';
  sql?: string; // Custom SQL for feature extraction
  conceptIds?: number[]; // Concept IDs for standardized features
  aggregation?: 'count' | 'avg' | 'max' | 'min' | 'exists';
  timeWindow?: number; // Days before index date
}

/**
 * Query result from OMOP database
 */
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}
