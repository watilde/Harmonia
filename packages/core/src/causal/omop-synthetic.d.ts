/**
 * Synthetic OMOP CDM Data Generator for Causal Inference
 *
 * Generates realistic OMOP-structured synthetic data for causal inference experiments.
 * This is a pragmatic alternative to Synthea that provides OMOP-formatted data
 * with realistic clinical patterns.
 */
/**
 * OMOP Person record
 */
export interface OMOPPerson {
    person_id: number;
    gender_concept_id: number;
    year_of_birth: number;
    race_concept_id: number;
    ethnicity_concept_id: number;
}
/**
 * OMOP Condition Occurrence record
 */
export interface OMOPConditionOccurrence {
    condition_occurrence_id: number;
    person_id: number;
    condition_concept_id: number;
    condition_start_date: string;
    condition_type_concept_id: number;
}
/**
 * OMOP Drug Exposure record
 */
export interface OMOPDrugExposure {
    drug_exposure_id: number;
    person_id: number;
    drug_concept_id: number;
    drug_exposure_start_date: string;
    drug_type_concept_id: number;
    quantity?: number;
}
/**
 * OMOP Measurement record
 */
export interface OMOPMeasurement {
    measurement_id: number;
    person_id: number;
    measurement_concept_id: number;
    measurement_date: string;
    value_as_number?: number;
    unit_concept_id?: number;
}
/**
 * OMOP Procedure Occurrence record
 */
export interface OMOPProcedureOccurrence {
    procedure_occurrence_id: number;
    person_id: number;
    procedure_concept_id: number;
    procedure_date: string;
    procedure_type_concept_id: number;
}
/**
 * OMOP Visit Occurrence record
 */
export interface OMOPVisitOccurrence {
    visit_occurrence_id: number;
    person_id: number;
    visit_concept_id: number;
    visit_start_date: string;
    visit_end_date: string;
    visit_type_concept_id: number;
}
/**
 * Complete OMOP dataset for a cohort
 */
export interface OMOPDataset {
    persons: OMOPPerson[];
    conditions: OMOPConditionOccurrence[];
    drugs: OMOPDrugExposure[];
    measurements: OMOPMeasurement[];
    procedures: OMOPProcedureOccurrence[];
    visits: OMOPVisitOccurrence[];
}
/**
 * Configuration for OMOP synthetic data generation
 */
export interface OMOPSyntheticConfig {
    /** Number of patients to generate */
    numPatients: number;
    /** Clinical scenario type */
    scenario: 'diabetes' | 'icu' | 'screening';
    /** True average treatment effect */
    trueATE: number;
    /** Confounding strength (0-1) */
    confounding: number;
    /** Base treatment rate (0-1) */
    treatmentRate?: number;
    /** Random seed for reproducibility */
    seed?: number;
    /** Index date for cohort (YYYY-MM-DD) */
    indexDate?: string;
}
/**
 * OMOP Concept IDs (Standard vocabulary)
 */
export declare const OMOP_CONCEPTS: {
    MALE: number;
    FEMALE: number;
    WHITE: number;
    BLACK: number;
    ASIAN: number;
    HISPANIC: number;
    NOT_HISPANIC: number;
    TYPE2_DIABETES: number;
    DIABETIC_NEUROPATHY: number;
    DIABETIC_RETINOPATHY: number;
    METFORMIN: number;
    INSULIN: number;
    GLIPIZIDE: number;
    NEW_DIABETES_DRUG: number;
    HBA1C: number;
    GLUCOSE: number;
    BMI: number;
    SEPSIS: number;
    PNEUMONIA: number;
    RESPIRATORY_FAILURE: number;
    SHOCK: number;
    MECHANICAL_VENTILATION: number;
    CENTRAL_LINE: number;
    ICU_ADMISSION: number;
    APACHE_SCORE: number;
    SOFA_SCORE: number;
    LACTATE: number;
    MAMMOGRAPHY: number;
    COLONOSCOPY: number;
    PSA_TEST: number;
    BREAST_CANCER: number;
    COLON_CANCER: number;
    PROSTATE_CANCER: number;
    INPATIENT: number;
    OUTPATIENT: number;
    EMERGENCY: number;
    EHR: number;
    CLAIM: number;
};
/**
 * Generate synthetic OMOP dataset based on scenario
 */
export declare function generateOMOPSyntheticData(config: OMOPSyntheticConfig): OMOPDataset;
/**
 * Export OMOP dataset to JSON files (mimicking OMOP CDM structure)
 */
export declare function exportOMOPDataset(dataset: OMOPDataset, outputDir: string): {
    [table: string]: string;
};
//# sourceMappingURL=omop-synthetic.d.ts.map