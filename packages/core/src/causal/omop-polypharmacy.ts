/**
 * OMOP Polypharmacy Generator for Core
 *
 * Extends OMOP synthetic data generation for polypharmacy scenarios
 * with 3 interaction tiers matching the manuscript.
 */

import type {
  OMOPDataset,
  OMOPPerson,
  OMOPConditionOccurrence,
  OMOPDrugExposure,
  OMOPMeasurement,
} from './omop-synthetic';
import { OMOP_CONCEPTS } from './omop-synthetic';

/**
 * Extended OMOP concepts for polypharmacy scenarios
 */
export const POLYPHARMACY_CONCEPTS = {
  // SGLT2 inhibitors (treatment)
  SGLT2I: 1594973, // Canagliflozin
  SGLT2I_ALT: 1597756, // Dapagliflozin

  // Common polypharmacy drugs
  ACE_INHIBITOR: 1308216, // Lisinopril
  ARB: 1367500, // Losartan
  BETA_BLOCKER: 1307046, // Metoprolol
  CALCIUM_CHANNEL_BLOCKER: 1328165, // Amlodipine
  STATIN: 1539403, // Atorvastatin
  ANTIPLATELET: 1112807, // Aspirin
  DIURETIC: 974166, // Furosemide

  // Conditions
  CKD_STAGE_3: 46271022,
  HYPERTENSION: 320128,
  HEART_FAILURE: 316139,

  // Outcomes
  EGFR: 3049187, // Estimated GFR
  CREATININE: 3016723,
  POTASSIUM: 3023103,

  ...OMOP_CONCEPTS,
};

/**
 * Polypharmacy interaction tiers from manuscript
 */
export interface PolypharmacyTier {
  name: string;
  prevalence: number;
  trueEffect: number; // ml/min/year (eGFR change)
  detectableAt: number; // minimum sample size
  drugCombination: number[]; // OMOP concept IDs
}

export const INTERACTION_TIERS: PolypharmacyTier[] = [
  {
    name: 'Interaction 1: Common polypharmacy',
    prevalence: 0.16, // 16%
    trueEffect: 2.0, // +2.0 ml/min/year (renal benefit)
    detectableAt: 1_000_000,
    drugCombination: [
      POLYPHARMACY_CONCEPTS.SGLT2I,
      POLYPHARMACY_CONCEPTS.ACE_INHIBITOR,
      POLYPHARMACY_CONCEPTS.STATIN,
    ],
  },
  {
    name: 'Interaction 2: Moderate polypharmacy',
    prevalence: 0.004, // 0.4%
    trueEffect: -1.5, // -1.5 ml/min/year (potential harm)
    detectableAt: 10_000_000,
    drugCombination: [
      POLYPHARMACY_CONCEPTS.SGLT2I,
      POLYPHARMACY_CONCEPTS.ACE_INHIBITOR,
      POLYPHARMACY_CONCEPTS.DIURETIC,
      POLYPHARMACY_CONCEPTS.BETA_BLOCKER,
    ],
  },
  {
    name: 'Interaction 3: Ultra-rare polypharmacy',
    prevalence: 0.00064, // 0.064%
    trueEffect: 1.5, // +1.5 ml/min/year (benefit)
    detectableAt: 1_000_000_000,
    drugCombination: [
      POLYPHARMACY_CONCEPTS.SGLT2I,
      POLYPHARMACY_CONCEPTS.ACE_INHIBITOR,
      POLYPHARMACY_CONCEPTS.ARB,
      POLYPHARMACY_CONCEPTS.CALCIUM_CHANNEL_BLOCKER,
      POLYPHARMACY_CONCEPTS.DIURETIC,
    ],
  },
];

/**
 * Configuration for polypharmacy OMOP data generation
 */
export interface PolypharmacyOMOPConfig {
  numPatients: number;
  interactionTier: 1 | 2 | 3;
  seed?: number;
  indexDate?: string;
  siteProfile?: 'US' | 'Japan' | 'Nordic' | 'India';
}

/**
 * Site-specific parameters
 */
interface SiteProfile {
  ageMean: number;
  ageSd: number;
  polypharmacyRate: number;
  confoundingStrength: number;
}

const SITE_PROFILES: Record<string, SiteProfile> = {
  US: {
    ageMean: 68,
    ageSd: 12,
    polypharmacyRate: 0.35,
    confoundingStrength: 1.2,
  },
  Japan: {
    ageMean: 72,
    ageSd: 10,
    polypharmacyRate: 0.28,
    confoundingStrength: 0.8,
  },
  Nordic: {
    ageMean: 65,
    ageSd: 11,
    polypharmacyRate: 0.22,
    confoundingStrength: 0.6,
  },
  India: {
    ageMean: 58,
    ageSd: 14,
    polypharmacyRate: 0.18,
    confoundingStrength: 1.0,
  },
};

/**
 * Seeded random number generator
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
 * Generate OMOP polypharmacy dataset
 */
export function generatePolypharmacyOMOP(config: PolypharmacyOMOPConfig): OMOPDataset {
  const tier = INTERACTION_TIERS[config.interactionTier - 1];
  const rng = new SeededRandom(config.seed ?? 42);
  const indexDate = config.indexDate ?? '2024-01-01';
  const siteParams = SITE_PROFILES[config.siteProfile ?? 'US'];

  const persons: OMOPPerson[] = [];
  const conditions: OMOPConditionOccurrence[] = [];
  const drugs: OMOPDrugExposure[] = [];
  const measurements: OMOPMeasurement[] = [];

  let conditionId = 1;
  let drugId = 1;
  let measurementId = 1;

  for (let i = 0; i < config.numPatients; i++) {
    const personId = i + 1;

    // Demographics
    const age = Math.floor(rng.normal(siteParams.ageMean, siteParams.ageSd));
    persons.push({
      person_id: personId,
      gender_concept_id:
        rng.next() > 0.5 ? POLYPHARMACY_CONCEPTS.MALE : POLYPHARMACY_CONCEPTS.FEMALE,
      year_of_birth: 2024 - Math.max(40, Math.min(90, age)),
      race_concept_id: POLYPHARMACY_CONCEPTS.WHITE,
      ethnicity_concept_id: POLYPHARMACY_CONCEPTS.NOT_HISPANIC,
    });

    // Determine if patient is in target interaction tier
    const inTargetTier = rng.next() < tier.prevalence;

    // Baseline conditions
    const hasCKD = age > 65 && rng.next() < 0.6;
    if (hasCKD) {
      conditions.push({
        condition_occurrence_id: conditionId++,
        person_id: personId,
        condition_concept_id: POLYPHARMACY_CONCEPTS.CKD_STAGE_3,
        condition_start_date: '2023-01-01',
        condition_type_concept_id: POLYPHARMACY_CONCEPTS.EHR,
      });
    }

    if (rng.next() < 0.7) {
      conditions.push({
        condition_occurrence_id: conditionId++,
        person_id: personId,
        condition_concept_id: POLYPHARMACY_CONCEPTS.HYPERTENSION,
        condition_start_date: '2022-01-01',
        condition_type_concept_id: POLYPHARMACY_CONCEPTS.EHR,
      });
    }

    // Drug exposures
    if (inTargetTier) {
      for (const drugConceptId of tier.drugCombination) {
        drugs.push({
          drug_exposure_id: drugId++,
          person_id: personId,
          drug_concept_id: drugConceptId,
          drug_exposure_start_date: indexDate,
          drug_type_concept_id: POLYPHARMACY_CONCEPTS.EHR,
        });
      }
    } else {
      const receiveSGLT2i = rng.next() < 0.5;
      if (receiveSGLT2i) {
        drugs.push({
          drug_exposure_id: drugId++,
          person_id: personId,
          drug_concept_id: POLYPHARMACY_CONCEPTS.SGLT2I,
          drug_exposure_start_date: indexDate,
          drug_type_concept_id: POLYPHARMACY_CONCEPTS.EHR,
        });

        const numOtherDrugs = Math.floor(rng.next() * 3);
        const availableDrugs = tier.drugCombination.filter(
          (d) => d !== POLYPHARMACY_CONCEPTS.SGLT2I
        );

        for (let j = 0; j < Math.min(numOtherDrugs, availableDrugs.length - 1); j++) {
          drugs.push({
            drug_exposure_id: drugId++,
            person_id: personId,
            drug_concept_id: availableDrugs[j],
            drug_exposure_start_date: indexDate,
            drug_type_concept_id: POLYPHARMACY_CONCEPTS.EHR,
          });
        }
      }
    }

    // Baseline eGFR
    const baselineEGFR = rng.normal(45, 10);
    measurements.push({
      measurement_id: measurementId++,
      person_id: personId,
      measurement_concept_id: POLYPHARMACY_CONCEPTS.EGFR,
      measurement_date: '2023-12-01',
      value_as_number: Math.max(15, Math.min(60, baselineEGFR)),
      unit_concept_id: 8795,
    });

    // Follow-up eGFR with causal effect
    const causalEffect = inTargetTier ? tier.trueEffect : 0;
    const followupEGFR = baselineEGFR + causalEffect + rng.normal(0, 3);

    measurements.push({
      measurement_id: measurementId++,
      person_id: personId,
      measurement_concept_id: POLYPHARMACY_CONCEPTS.EGFR,
      measurement_date: '2024-12-01',
      value_as_number: Math.max(10, Math.min(70, followupEGFR)),
      unit_concept_id: 8795,
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
