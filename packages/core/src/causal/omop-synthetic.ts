/**
 * Synthetic OMOP CDM Data Generator for Causal Inference
 *
 * Generates realistic OMOP-structured synthetic data for causal inference experiments.
 * This is a pragmatic alternative to Synthea that provides OMOP-formatted data
 * with realistic clinical patterns.
 */

/**
 * Seeded random number generator (same as in partial-id)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  normal(mean = 0, stdDev = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

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
export const OMOP_CONCEPTS = {
  // Gender
  MALE: 8507,
  FEMALE: 8532,

  // Race
  WHITE: 8527,
  BLACK: 8516,
  ASIAN: 8515,

  // Ethnicity
  HISPANIC: 38003563,
  NOT_HISPANIC: 38003564,

  // Diabetes conditions
  TYPE2_DIABETES: 201826,
  DIABETIC_NEUROPATHY: 443767,
  DIABETIC_RETINOPATHY: 193349,

  // Diabetes drugs
  METFORMIN: 1503297,
  INSULIN: 1502905,
  GLIPIZIDE: 1502826,
  NEW_DIABETES_DRUG: 9999001, // Synthetic drug for experiment

  // Diabetes measurements
  HBA1C: 3004410,
  GLUCOSE: 3004501,
  BMI: 3038553,

  // ICU conditions
  SEPSIS: 132797,
  PNEUMONIA: 255848,
  RESPIRATORY_FAILURE: 4324261,
  SHOCK: 201313,

  // ICU procedures
  MECHANICAL_VENTILATION: 4230167,
  CENTRAL_LINE: 4146470,
  ICU_ADMISSION: 9201, // Visit concept

  // ICU measurements
  APACHE_SCORE: 9999002, // Synthetic
  SOFA_SCORE: 9999003, // Synthetic
  LACTATE: 3004327,

  // Screening procedures
  MAMMOGRAPHY: 4324693,
  COLONOSCOPY: 4149568,
  PSA_TEST: 2212392,

  // Screening conditions
  BREAST_CANCER: 4112853,
  COLON_CANCER: 4302454,
  PROSTATE_CANCER: 4163261,

  // Visit types
  INPATIENT: 9201,
  OUTPATIENT: 9202,
  EMERGENCY: 9203,

  // Type concepts (provenance)
  EHR: 32817,
  CLAIM: 32810,
};

/**
 * Generate synthetic OMOP dataset for diabetes medication scenario
 */
function generateDiabetesOMOP(config: OMOPSyntheticConfig): OMOPDataset {
  const rng = new SeededRandom(config.seed ?? 42);
  const indexDate = config.indexDate ?? '2024-01-01';
  const treatmentRate = config.treatmentRate ?? 0.5;

  const persons: OMOPPerson[] = [];
  const conditions: OMOPConditionOccurrence[] = [];
  const drugs: OMOPDrugExposure[] = [];
  const measurements: OMOPMeasurement[] = [];

  let conditionId = 1;
  let drugId = 1;
  let measurementId = 1;

  for (let i = 0; i < config.numPatients; i++) {
    const personId = i + 1;

    // Generate person demographics
    const age = Math.floor(rng.next() * 40 + 40); // 40-80 years old
    persons.push({
      person_id: personId,
      gender_concept_id: rng.next() > 0.5 ? OMOP_CONCEPTS.MALE : OMOP_CONCEPTS.FEMALE,
      year_of_birth: 2024 - age,
      race_concept_id: OMOP_CONCEPTS.WHITE,
      ethnicity_concept_id: OMOP_CONCEPTS.NOT_HISPANIC,
    });

    // Baseline severity (confounder)
    const severity = rng.normal(0, 1);

    // Treatment assignment (confounded by severity)
    const treatmentProb = treatmentRate + config.confounding * severity;
    const treatment = rng.next() < Math.max(0.1, Math.min(0.9, treatmentProb)) ? 1 : 0;

    // Add Type 2 Diabetes condition
    conditions.push({
      condition_occurrence_id: conditionId++,
      person_id: personId,
      condition_concept_id: OMOP_CONCEPTS.TYPE2_DIABETES,
      condition_start_date: '2023-01-01',
      condition_type_concept_id: OMOP_CONCEPTS.EHR,
    });

    // Add baseline HbA1c measurement (higher = worse)
    const baselineHbA1c = 8.5 + severity * 1.5; // 7.0 - 10.0 range
    measurements.push({
      measurement_id: measurementId++,
      person_id: personId,
      measurement_concept_id: OMOP_CONCEPTS.HBA1C,
      measurement_date: '2023-12-01',
      value_as_number: baselineHbA1c,
      unit_concept_id: 8554, // percent
    });

    // Add drug exposure
    if (treatment === 1) {
      // New diabetes drug
      drugs.push({
        drug_exposure_id: drugId++,
        person_id: personId,
        drug_concept_id: OMOP_CONCEPTS.NEW_DIABETES_DRUG,
        drug_exposure_start_date: indexDate,
        drug_type_concept_id: OMOP_CONCEPTS.EHR,
      });
    } else {
      // Standard care (Metformin)
      drugs.push({
        drug_exposure_id: drugId++,
        person_id: personId,
        drug_concept_id: OMOP_CONCEPTS.METFORMIN,
        drug_exposure_start_date: indexDate,
        drug_type_concept_id: OMOP_CONCEPTS.EHR,
      });
    }

    // Outcome: HbA1c < 7% at 6 months
    // True causal effect = trueATE
    const treatmentEffect = treatment * config.trueATE;
    const outcomeProb = 0.3 + severity * 0.2 + treatmentEffect;
    const outcome = rng.next() < Math.max(0, Math.min(1, outcomeProb)) ? 1 : 0;

    // Follow-up HbA1c measurement
    const followupHbA1c = outcome === 1 ? rng.next() * 0.5 + 6.0 : rng.next() * 2.0 + 8.0;

    measurements.push({
      measurement_id: measurementId++,
      person_id: personId,
      measurement_concept_id: OMOP_CONCEPTS.HBA1C,
      measurement_date: '2024-07-01', // 6 months after index
      value_as_number: followupHbA1c,
      unit_concept_id: 8554,
    });
  }

  return {
    persons,
    conditions,
    drugs,
    measurements,
    procedures: [],
    visits: [],
  };
}

/**
 * Generate synthetic OMOP dataset for ICU intervention scenario
 */
function generateICUOMOP(config: OMOPSyntheticConfig): OMOPDataset {
  const rng = new SeededRandom(config.seed ?? 42);
  const indexDate = config.indexDate ?? '2024-01-01';
  const treatmentRate = config.treatmentRate ?? 0.4;

  const persons: OMOPPerson[] = [];
  const conditions: OMOPConditionOccurrence[] = [];
  const procedures: OMOPProcedureOccurrence[] = [];
  const measurements: OMOPMeasurement[] = [];
  const visits: OMOPVisitOccurrence[] = [];

  let conditionId = 1;
  let procedureId = 1;
  let measurementId = 1;
  let visitId = 1;

  for (let i = 0; i < config.numPatients; i++) {
    const personId = i + 1;
    const age = Math.floor(rng.next() * 50 + 30); // 30-80 years old

    persons.push({
      person_id: personId,
      gender_concept_id: rng.next() > 0.5 ? OMOP_CONCEPTS.MALE : OMOP_CONCEPTS.FEMALE,
      year_of_birth: 2024 - age,
      race_concept_id: OMOP_CONCEPTS.WHITE,
      ethnicity_concept_id: OMOP_CONCEPTS.NOT_HISPANIC,
    });

    // Illness severity (APACHE score surrogate - higher = sicker)
    const severity = rng.normal(0, 1);

    // Treatment: Early intervention (confounded by severity)
    const treatmentProb = treatmentRate + config.confounding * severity;
    const treatment = rng.next() < Math.max(0.1, Math.min(0.9, treatmentProb)) ? 1 : 0;

    // ICU admission
    visits.push({
      visit_occurrence_id: visitId++,
      person_id: personId,
      visit_concept_id: OMOP_CONCEPTS.INPATIENT,
      visit_start_date: indexDate,
      visit_end_date: '2024-01-10',
      visit_type_concept_id: OMOP_CONCEPTS.EHR,
    });

    // Primary condition (Sepsis)
    conditions.push({
      condition_occurrence_id: conditionId++,
      person_id: personId,
      condition_concept_id: OMOP_CONCEPTS.SEPSIS,
      condition_start_date: indexDate,
      condition_type_concept_id: OMOP_CONCEPTS.EHR,
    });

    // APACHE score measurement
    const apacheScore = 15 + severity * 10; // 5-25 range
    measurements.push({
      measurement_id: measurementId++,
      person_id: personId,
      measurement_concept_id: OMOP_CONCEPTS.APACHE_SCORE,
      measurement_date: indexDate,
      value_as_number: apacheScore,
    });

    // Early intervention procedure
    if (treatment === 1) {
      procedures.push({
        procedure_occurrence_id: procedureId++,
        person_id: personId,
        procedure_concept_id: OMOP_CONCEPTS.CENTRAL_LINE,
        procedure_date: indexDate,
        procedure_type_concept_id: OMOP_CONCEPTS.EHR,
      });
    }

    // Outcome: 30-day mortality (0=alive, 1=dead)
    // True causal effect = trueATE (negative = reduces mortality)
    // Note: Mortality outcome is computed during cohort extraction based on
    // severity, treatment, and random variation. This ensures consistency
    // with the extraction logic.
  }

  return {
    persons,
    conditions,
    drugs: [],
    measurements,
    procedures,
    visits,
  };
}

/**
 * Generate synthetic OMOP dataset for cancer screening scenario
 */
function generateScreeningOMOP(config: OMOPSyntheticConfig): OMOPDataset {
  const rng = new SeededRandom(config.seed ?? 42);
  const indexDate = config.indexDate ?? '2024-01-01';
  const treatmentRate = config.treatmentRate ?? 0.35;

  const persons: OMOPPerson[] = [];
  const procedures: OMOPProcedureOccurrence[] = [];
  const conditions: OMOPConditionOccurrence[] = [];
  const visits: OMOPVisitOccurrence[] = [];

  let procedureId = 1;
  let conditionId = 1;
  let visitId = 1;

  for (let i = 0; i < config.numPatients; i++) {
    const personId = i + 1;
    const age = Math.floor(rng.next() * 25 + 50); // 50-75 years old (screening age)

    persons.push({
      person_id: personId,
      gender_concept_id: rng.next() > 0.5 ? OMOP_CONCEPTS.MALE : OMOP_CONCEPTS.FEMALE,
      year_of_birth: 2024 - age,
      race_concept_id: OMOP_CONCEPTS.WHITE,
      ethnicity_concept_id: OMOP_CONCEPTS.NOT_HISPANIC,
    });

    // Risk factors (confounder) - family history, lifestyle
    const riskFactor = rng.normal(0, 1);

    // Treatment: Received screening colonoscopy (confounded by risk)
    const screeningProb = treatmentRate + config.confounding * riskFactor;
    const screened = rng.next() < Math.max(0.1, Math.min(0.9, screeningProb)) ? 1 : 0;

    // Outpatient visit
    visits.push({
      visit_occurrence_id: visitId++,
      person_id: personId,
      visit_concept_id: OMOP_CONCEPTS.OUTPATIENT,
      visit_start_date: indexDate,
      visit_end_date: indexDate,
      visit_type_concept_id: OMOP_CONCEPTS.EHR,
    });

    // Screening procedure
    if (screened === 1) {
      procedures.push({
        procedure_occurrence_id: procedureId++,
        person_id: personId,
        procedure_concept_id: OMOP_CONCEPTS.COLONOSCOPY,
        procedure_date: indexDate,
        procedure_type_concept_id: OMOP_CONCEPTS.EHR,
      });
    }

    // Outcome: Cancer diagnosis within 5 years
    // True causal effect = trueATE (positive = screening reduces cancer)
    const treatmentEffect = screened * config.trueATE;
    const cancerProb = 0.05 + riskFactor * 0.03 - treatmentEffect;
    const cancer = rng.next() < Math.max(0, Math.min(0.3, cancerProb)) ? 1 : 0;

    // Add cancer condition if diagnosed
    if (cancer === 1) {
      // Diagnosis occurs 1-5 years after screening/baseline
      const yearsToDetection = Math.floor(rng.next() * 5 + 1);
      const diagnosisDate = `${2024 + yearsToDetection}-01-01`;

      conditions.push({
        condition_occurrence_id: conditionId++,
        person_id: personId,
        condition_concept_id: OMOP_CONCEPTS.COLON_CANCER,
        condition_start_date: diagnosisDate,
        condition_type_concept_id: OMOP_CONCEPTS.EHR,
      });
    }
  }

  return {
    persons,
    conditions,
    drugs: [],
    measurements: [],
    procedures,
    visits,
  };
}

/**
 * Generate synthetic OMOP dataset based on scenario
 */
export function generateOMOPSyntheticData(config: OMOPSyntheticConfig): OMOPDataset {
  switch (config.scenario) {
    case 'diabetes':
      return generateDiabetesOMOP(config);
    case 'icu':
      return generateICUOMOP(config);
    case 'screening':
      return generateScreeningOMOP(config);
    default:
      throw new Error(`Unknown scenario: ${config.scenario}`);
  }
}

/**
 * Export OMOP dataset to JSON files (mimicking OMOP CDM structure)
 */
export function exportOMOPDataset(
  dataset: OMOPDataset,
  outputDir: string
): { [table: string]: string } {
  const files: { [table: string]: string } = {};

  if (dataset.persons.length > 0) {
    files.person = `${outputDir}/person.json`;
  }
  if (dataset.conditions.length > 0) {
    files.condition_occurrence = `${outputDir}/condition_occurrence.json`;
  }
  if (dataset.drugs.length > 0) {
    files.drug_exposure = `${outputDir}/drug_exposure.json`;
  }
  if (dataset.measurements.length > 0) {
    files.measurement = `${outputDir}/measurement.json`;
  }
  if (dataset.procedures.length > 0) {
    files.procedure_occurrence = `${outputDir}/procedure_occurrence.json`;
  }
  if (dataset.visits.length > 0) {
    files.visit_occurrence = `${outputDir}/visit_occurrence.json`;
  }

  return files;
}
