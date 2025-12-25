/**
 * OMOP CDM Data Generator for Polypharmacy Research
 *
 * Integrates with @harmonia/core OMOP functionality to generate
 * OMOP-formatted data for the polypharmacy research module.
 *
 * This enables:
 * 1. Direct compatibility with real OMOP databases
 * 2. Standard OHDSI vocabulary usage
 * 3. Federated analysis on OMOP-formatted data
 */

const path = require('path');

// Import core OMOP functionality
let generateOMOPSyntheticData, extractCausalDataFromOMOP;

try {
  // Try to import from compiled core package
  const coreOMOP = require('@harmonia/core');
  generateOMOPSyntheticData = coreOMOP.generateOMOPSyntheticData;
  extractCausalDataFromOMOP = coreOMOP.extractCausalDataFromOMOP;
} catch (e) {
  console.warn('Could not load @harmonia/core, using fallback OMOP generator');
  // Fallback: import TypeScript source directly
  try {
    require('ts-node/register');
    const omopSynthetic = require('../../../packages/core/src/causal/omop-synthetic');
    const omopExtractor = require('../../../packages/core/src/causal/omop-extractor');
    generateOMOPSyntheticData = omopSynthetic.generateOMOPSyntheticData;
    extractCausalDataFromOMOP = omopExtractor.extractCausalDataFromOMOP;
  } catch (tsError) {
    console.error('Failed to load OMOP functionality:', tsError.message);
  }
}

/**
 * OMOP Concept IDs for Polypharmacy Research
 *
 * Using standard OMOP vocabulary:
 * - Conditions: SNOMED-CT
 * - Drugs: RxNorm
 * - Measurements: LOINC
 */
const OMOP_CONCEPTS = {
  // Conditions (SNOMED)
  DIABETES_TYPE2: 201826,
  CKD_STAGE_3: 46271022,
  CKD_STAGE_4: 46271023,
  CKD_STAGE_5: 46271024,
  HYPERTENSION: 320128,

  // Drugs (RxNorm)
  SGLT2I_EMPAGLIFLOZIN: 1545653,
  SGLT2I_DAPAGLIFLOZIN: 1488564,
  METFORMIN: 6809,
  ACE_INHIBITOR: 1998,
  STATIN: 36567,
  LOOP_DIURETIC_FUROSEMIDE: 4603,
  THIAZIDE_DIURETIC: 317541,
  ASPIRIN: 1191,

  // Measurements (LOINC)
  HBA1C: 4184637,
  EGFR: 3049187,
  CREATININE: 3016723,
  BMI: 3038553,
};

/**
 * Generate OMOP CDM data for polypharmacy cohort
 *
 * @param {Object} config - Configuration
 * @param {number} config.nPatients - Number of patients
 * @param {number} config.siteId - Site identifier
 * @param {string} config.profile - Population profile (US, Japan, Nordic, India)
 * @param {number} config.seed - Random seed
 * @param {string} config.indexDate - Index date (YYYY-MM-DD)
 * @returns {Object} OMOP dataset
 */
function generatePolypharmacyOMOPData(config) {
  const {
    nPatients = 1000,
    siteId = 1,
    profile = 'US',
    seed = 42,
    indexDate = '2024-01-01',
  } = config;

  if (!generateOMOPSyntheticData) {
    throw new Error('OMOP functionality not available. Please install @harmonia/core.');
  }

  // Map polypharmacy scenario to OMOP diabetes scenario with extended configuration
  const omopConfig = {
    numPatients: nPatients,
    scenario: 'diabetes', // Base scenario
    trueATE: 1.46, // From manuscript: +1.46 ml/min/year eGFR slope
    confounding: profile === 'India' ? 0.4 : profile === 'US' ? 0.3 : 0.25,
    treatmentRate: 0.35, // SGLT2i treatment rate
    seed: seed + siteId,
    indexDate,

    // Extended configuration for polypharmacy
    polypharmacy: {
      enabled: true,
      metforminRate: 0.85,
      aceInhibitorRate: 0.7,
      statinRate: 0.75,
      diureticRate: 0.35,
      loopDiureticRate: 0.15,
      aspirinRate: 0.65,
    },

    // CKD prevalence by profile
    ckdPrevalence: profile === 'Japan' ? 0.45 : profile === 'Nordic' ? 0.35 : 0.4,
  };

  console.log(`Generating OMOP data for site ${siteId} (${profile} profile)...`);
  const dataset = generateOMOPSyntheticData(omopConfig);

  // Enhance dataset with site metadata
  dataset.metadata = {
    siteId,
    profile,
    generatedAt: new Date().toISOString(),
    nPatients,
    concepts: OMOP_CONCEPTS,
  };

  return dataset;
}

/**
 * Extract causal inference cohort from OMOP data
 *
 * Defines cohorts for polypharmacy research:
 * - Treatment: SGLT2 inhibitor exposure
 * - Outcome: eGFR decline at 6 months
 * - Rare subgroups: CKD Stage 3b + Loop Diuretic + Age>80
 *
 * @param {Object} omopDataset - OMOP dataset from generatePolypharmacyOMOPData
 * @param {Object} config - Extraction configuration
 * @returns {Object} Causal inference cohort
 */
function extractPolypharmacyCohort(omopDataset, config = {}) {
  const {
    indexDate = '2024-01-01',
    followUpDays = 180, // 6 months
    minAge = 18,
    requireBaseline = true,
  } = config;

  if (!extractCausalDataFromOMOP) {
    throw new Error('OMOP extractor not available. Please install @harmonia/core.');
  }

  const extractConfig = {
    scenario: 'diabetes',
    indexDate,
    followUpDays,

    // Treatment definition: SGLT2 inhibitor
    treatmentConcepts: [OMOP_CONCEPTS.SGLT2I_EMPAGLIFLOZIN, OMOP_CONCEPTS.SGLT2I_DAPAGLIFLOZIN],

    // Outcome: eGFR measurement
    outcomeConcepts: [OMOP_CONCEPTS.EGFR],

    // Covariates
    covariateConcepts: {
      conditions: [
        OMOP_CONCEPTS.DIABETES_TYPE2,
        OMOP_CONCEPTS.CKD_STAGE_3,
        OMOP_CONCEPTS.HYPERTENSION,
      ],
      drugs: [
        OMOP_CONCEPTS.METFORMIN,
        OMOP_CONCEPTS.ACE_INHIBITOR,
        OMOP_CONCEPTS.LOOP_DIURETIC_FUROSEMIDE,
      ],
      measurements: [OMOP_CONCEPTS.HBA1C, OMOP_CONCEPTS.EGFR, OMOP_CONCEPTS.BMI],
    },
  };

  console.log('Extracting causal cohort from OMOP data...');
  const cohort = extractCausalDataFromOMOP(omopDataset, extractConfig);

  // Identify rare subgroups
  cohort.rareSubgroups = identifyRareSubgroups(cohort.data);

  return cohort;
}

/**
 * Identify rare subgroups in cohort data
 *
 * @param {Array} cohortData - Causal inference data
 * @returns {Object} Rare subgroup statistics
 */
function identifyRareSubgroups(cohortData) {
  const subgroups = {
    interaction1: [], // HbA1c > 8.0 + Diuretic
    interaction2: [], // Asian + Age > 75 + Low BMI
    interaction3: [], // CKD 3b + Loop Diuretic + Age > 80
  };

  cohortData.forEach((patient) => {
    // Interaction 1: High HbA1c + Diuretic
    if (patient.hba1c > 8.0 && patient.diuretic === 1) {
      subgroups.interaction1.push(patient.patientId);
    }

    // Interaction 2: Asian + Elderly + Low BMI
    if (patient.raceAsian === 1 && patient.age > 75 && patient.bmi < 22) {
      subgroups.interaction2.push(patient.patientId);
    }

    // Interaction 3: CKD 3b + Loop Diuretic + Very Elderly
    if (
      patient.egfr >= 30 &&
      patient.egfr <= 45 &&
      patient.loopDiuretic === 1 &&
      patient.age > 80
    ) {
      subgroups.interaction3.push(patient.patientId);
    }
  });

  return {
    interaction1: {
      count: subgroups.interaction1.length,
      prevalence: subgroups.interaction1.length / cohortData.length,
      patientIds: subgroups.interaction1,
    },
    interaction2: {
      count: subgroups.interaction2.length,
      prevalence: subgroups.interaction2.length / cohortData.length,
      patientIds: subgroups.interaction2,
    },
    interaction3: {
      count: subgroups.interaction3.length,
      prevalence: subgroups.interaction3.length / cohortData.length,
      patientIds: subgroups.interaction3,
    },
  };
}

/**
 * Generate federated OMOP dataset across multiple sites
 *
 * @param {Object} config - Configuration
 * @param {number} config.nSites - Number of sites
 * @param {number} config.patientsPerSite - Patients per site
 * @param {Array<string>} config.profiles - Site profiles (e.g., ['US', 'Japan', 'Nordic'])
 * @param {number} config.seed - Base random seed
 * @returns {Array<Object>} Array of OMOP datasets, one per site
 */
function generateFederatedOMOPData(config) {
  const {
    nSites = 10,
    patientsPerSite = 1000,
    profiles = ['US', 'Japan', 'Nordic', 'India'],
    seed = 42,
    indexDate = '2024-01-01',
  } = config;

  console.log(`Generating federated OMOP data across ${nSites} sites...`);

  const sites = [];
  for (let siteId = 1; siteId <= nSites; siteId++) {
    const profile = profiles[(siteId - 1) % profiles.length];

    const siteDataset = generatePolypharmacyOMOPData({
      nPatients: patientsPerSite,
      siteId,
      profile,
      seed,
      indexDate,
    });

    sites.push(siteDataset);

    if (siteId % 10 === 0) {
      console.log(`  Generated ${siteId}/${nSites} sites`);
    }
  }

  console.log(`✓ Generated ${nSites} OMOP sites with ${nSites * patientsPerSite} total patients`);

  return sites;
}

module.exports = {
  generatePolypharmacyOMOPData,
  extractPolypharmacyCohort,
  identifyRareSubgroups,
  generateFederatedOMOPData,
  OMOP_CONCEPTS,
};
