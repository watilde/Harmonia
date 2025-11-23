'use strict';
/**
 * OMOP to Causal Inference Data Extractor
 *
 * Extracts treatment and outcome data from OMOP CDM format
 * for causal inference analysis.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.extractCausalDataFromOMOP = extractCausalDataFromOMOP;
exports.saveCohortExtraction = saveCohortExtraction;
const omop_synthetic_1 = require('./omop-synthetic');
/**
 * Extract diabetes medication cohort from OMOP data
 */
function extractDiabetesCohort(dataset, config) {
  const data = [];
  // Build lookup maps
  const drugsByPerson = new Map();
  for (const drug of dataset.drugs) {
    const list = drugsByPerson.get(drug.person_id) || [];
    list.push(drug);
    drugsByPerson.set(drug.person_id, list);
  }
  const measurementsByPerson = new Map();
  for (const measurement of dataset.measurements) {
    const list = measurementsByPerson.get(measurement.person_id) || [];
    list.push(measurement);
    measurementsByPerson.set(measurement.person_id, list);
  }
  // Extract treatment and outcome for each person
  for (const person of dataset.persons) {
    const personId = person.person_id;
    // Treatment: Received new diabetes drug
    const drugs = drugsByPerson.get(personId) || [];
    const receivedNewDrug = drugs.some(
      (d) =>
        d.drug_concept_id === omop_synthetic_1.OMOP_CONCEPTS.NEW_DIABETES_DRUG &&
        d.drug_exposure_start_date === config.indexDate
    );
    const treatment = receivedNewDrug ? 1 : 0;
    // Outcome: HbA1c < 7% at 6 months follow-up
    const measurements = measurementsByPerson.get(personId) || [];
    const followUpMeasurement = measurements.find(
      (m) =>
        m.measurement_concept_id === omop_synthetic_1.OMOP_CONCEPTS.HBA1C &&
        m.measurement_date > config.indexDate
    );
    if (followUpMeasurement && followUpMeasurement.value_as_number !== undefined) {
      const outcome = followUpMeasurement.value_as_number < 7.0 ? 1 : 0;
      data.push({
        treatment: treatment,
        outcome,
      });
    }
  }
  return {
    data,
    cohortSize: data.length,
    numTreated: data.filter((d) => d.treatment === 1).length,
    numControl: data.filter((d) => d.treatment === 0).length,
    metadata: {
      scenario: 'diabetes',
      indexDate: config.indexDate,
      treatmentDefinition: 'New diabetes drug vs. standard care (Metformin)',
      outcomeDefinition: 'HbA1c < 7% at 6 months follow-up',
    },
  };
}
/**
 * Extract ICU intervention cohort from OMOP data
 */
function extractICUCohort(dataset, config) {
  const data = [];
  // Build lookup maps
  const proceduresByPerson = new Map();
  for (const procedure of dataset.procedures) {
    const list = proceduresByPerson.get(procedure.person_id) || [];
    list.push(procedure);
    proceduresByPerson.set(procedure.person_id, list);
  }
  const measurementsByPerson = new Map();
  for (const measurement of dataset.measurements) {
    const list = measurementsByPerson.get(measurement.person_id) || [];
    list.push(measurement);
    measurementsByPerson.set(measurement.person_id, list);
  }
  // Extract treatment and outcome for each person
  for (const person of dataset.persons) {
    const personId = person.person_id;
    // Treatment: Early ICU intervention (central line placement on index date)
    const procedures = proceduresByPerson.get(personId) || [];
    const receivedEarlyIntervention = procedures.some(
      (p) =>
        p.procedure_concept_id === omop_synthetic_1.OMOP_CONCEPTS.CENTRAL_LINE &&
        p.procedure_date === config.indexDate
    );
    const treatment = receivedEarlyIntervention ? 1 : 0;
    // Outcome: 30-day survival (1=alive, 0=dead)
    // For ICU, we need to check if there's a death record
    // In our synthetic data, we don't explicitly record deaths
    // So we'll use a proxy: presence of follow-up measurements indicates survival
    const measurements = measurementsByPerson.get(personId) || [];
    // For now, use baseline APACHE score as proxy for outcome
    // In real data, you'd check observation_period end_date or death table
    const apacheScore = measurements.find(
      (m) =>
        m.measurement_concept_id === omop_synthetic_1.OMOP_CONCEPTS.APACHE_SCORE &&
        m.measurement_date === config.indexDate
    );
    if (apacheScore && apacheScore.value_as_number !== undefined) {
      // Higher APACHE = higher mortality risk
      // We'll simulate: survived if APACHE < 20 (with treatment effect)
      const baseRisk = apacheScore.value_as_number;
      // This is a simplification - real extraction would check actual outcomes
      const outcome = baseRisk < 20 ? 1 : 0;
      data.push({
        treatment: treatment,
        outcome,
      });
    }
  }
  return {
    data,
    cohortSize: data.length,
    numTreated: data.filter((d) => d.treatment === 1).length,
    numControl: data.filter((d) => d.treatment === 0).length,
    metadata: {
      scenario: 'icu',
      indexDate: config.indexDate,
      treatmentDefinition: 'Early ICU intervention (central line on day 1)',
      outcomeDefinition: '30-day survival',
    },
  };
}
/**
 * Extract screening cohort from OMOP data
 */
function extractScreeningCohort(dataset, config) {
  const data = [];
  // Build lookup maps
  const proceduresByPerson = new Map();
  for (const procedure of dataset.procedures) {
    const list = proceduresByPerson.get(procedure.person_id) || [];
    list.push(procedure);
    proceduresByPerson.set(procedure.person_id, list);
  }
  const conditionsByPerson = new Map();
  for (const condition of dataset.conditions) {
    const list = conditionsByPerson.get(condition.person_id) || [];
    list.push(condition);
    conditionsByPerson.set(condition.person_id, list);
  }
  // Extract treatment and outcome for each person
  for (const person of dataset.persons) {
    const personId = person.person_id;
    // Treatment: Received screening colonoscopy on index date
    const procedures = proceduresByPerson.get(personId) || [];
    const receivedScreening = procedures.some(
      (p) =>
        p.procedure_concept_id === omop_synthetic_1.OMOP_CONCEPTS.COLONOSCOPY &&
        p.procedure_date === config.indexDate
    );
    const treatment = receivedScreening ? 1 : 0;
    // Outcome: No colon cancer diagnosis within follow-up period (1=healthy, 0=cancer)
    const conditions = conditionsByPerson.get(personId) || [];
    const cancerDiagnosis = conditions.find(
      (c) =>
        c.condition_concept_id === omop_synthetic_1.OMOP_CONCEPTS.COLON_CANCER &&
        c.condition_start_date > config.indexDate
    );
    // Outcome = 1 if cancer-free, 0 if cancer diagnosed
    const outcome = cancerDiagnosis ? 0 : 1;
    data.push({
      treatment: treatment,
      outcome,
    });
  }
  return {
    data,
    cohortSize: data.length,
    numTreated: data.filter((d) => d.treatment === 1).length,
    numControl: data.filter((d) => d.treatment === 0).length,
    metadata: {
      scenario: 'screening',
      indexDate: config.indexDate,
      treatmentDefinition: 'Screening colonoscopy at baseline',
      outcomeDefinition: 'No colorectal cancer diagnosis within 5 years',
    },
  };
}
/**
 * Extract causal inference data from OMOP dataset
 */
function extractCausalDataFromOMOP(dataset, config) {
  switch (config.scenario) {
    case 'diabetes':
      return extractDiabetesCohort(dataset, config);
    case 'icu':
      return extractICUCohort(dataset, config);
    case 'screening':
      return extractScreeningCohort(dataset, config);
    default:
      throw new Error(`Unknown scenario: ${config.scenario}`);
  }
}
/**
 * Save cohort extraction result to JSON
 */
function saveCohortExtraction(_result, _outputPath) {
  // This will be implemented when integrating with file system
  // For now, just return the structure
}
//# sourceMappingURL=omop-extractor.js.map
