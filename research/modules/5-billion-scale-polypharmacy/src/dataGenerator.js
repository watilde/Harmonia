/**
 * High-performance polypharmacy data generator using Worker threads
 *
 * Features:
 * - Stream-based processing for billion-scale data
 * - Worker thread pool for CPU parallelization
 * - Memory-efficient chunked generation
 * - Embedded ground truth causal effects
 */

// Removed worker_threads import - using Piscina instead

class GroundTruth {
  constructor() {
    // Primary effect (detectable at 100K)
    this.primaryHbA1cReduction = -0.8;

    // Interaction 1 (detectable at 1M)
    this.interaction1RenalBoost = 2.0;
    this.interaction1ThresholdHbA1c = 8.0;

    // Interaction 2 (detectable at 10M)
    this.interaction2DehydrationRisk = 3.0;
    this.interaction2HospIncrease = 0.05; // 5% absolute

    // Interaction 3 (detectable at 1B)
    this.interaction3AeIncrease = 0.02; // 2% absolute
    this.interaction3Prevalence = 0.00075; // ~1/1333
  }
}

class RandomGenerator {
  constructor(seed) {
    this.seed = seed;
    this.m = 2147483647;
    this.a = 16807;
  }

  next() {
    this.seed = (this.seed * this.a) % this.m;
    return (this.seed - 1) / (this.m - 1);
  }

  normal(mean = 0, std = 1) {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z0;
  }

  binomial(n = 1, p = 0.5) {
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (this.next() < p) count++;
    }
    return count;
  }

  uniform(min, max) {
    return min + (max - min) * this.next();
  }
}

class SiteParameters {
  static getProfile(profileType) {
    const profiles = {
      US: {
        polypharmacyRate: 0.35,
        ageMean: 68,
        ageSd: 12,
        bmiMean: 29,
        bmiSd: 6,
        missingRate: 0.15,
        confoundingStrength: 1.2,
      },
      Japan: {
        polypharmacyRate: 0.28,
        ageMean: 72,
        ageSd: 10,
        bmiMean: 23,
        bmiSd: 3.5,
        missingRate: 0.05,
        confoundingStrength: 0.8,
      },
      Nordic: {
        polypharmacyRate: 0.22,
        ageMean: 65,
        ageSd: 11,
        bmiMean: 26,
        bmiSd: 4,
        missingRate: 0.08,
        confoundingStrength: 0.6,
      },
      India: {
        polypharmacyRate: 0.18,
        ageMean: 58,
        ageSd: 14,
        bmiMean: 24,
        bmiSd: 4.5,
        missingRate: 0.25,
        confoundingStrength: 1.5,
      },
    };
    return profiles[profileType] || profiles.US;
  }
}

class PolypharmacyDataGenerator {
  constructor(nPatients, siteId, profile, seed) {
    this.nPatients = nPatients;
    this.siteId = siteId;
    this.profile = profile;
    this.rng = new RandomGenerator(seed + siteId);
    this.gt = new GroundTruth();
    this.siteParams = SiteParameters.getProfile(profile);
  }

  generatePatient(patientId) {
    // Step 1: Baseline covariates
    const age = Math.max(
      40,
      Math.min(95, this.rng.normal(this.siteParams.ageMean, this.siteParams.ageSd))
    );

    const bmi = Math.max(
      15,
      Math.min(45, this.rng.normal(this.siteParams.bmiMean, this.siteParams.bmiSd))
    );

    const raceAsian = this.rng.binomial(1, this.profile === 'US' ? 0.15 : 0.85);

    const hba1cBaseline = Math.max(5.5, Math.min(12.0, this.rng.normal(7.8, 1.2)));

    const ses = this.rng.normal(0, 1);

    // CKD stage
    const ckdStage = this.generateCkdStage(age, bmi);
    const egfrBaseline = this.ckdToEgfr(ckdStage);

    // Step 2: 5-drug baseline regimen
    const metformin = this.rng.binomial(1, 0.85);
    const aceInhibitor = this.rng.binomial(1, 0.7);
    const statin = this.rng.binomial(1, 0.75);
    const diuretic = this.generateDiuretic(age, egfrBaseline, ses);
    const aspirin = this.rng.binomial(1, 0.65);
    const loopDiuretic = this.rng.binomial(1, 0.15 * (ckdStage >= 3) * (age > 70));

    // Step 3: Treatment assignment (SGLT2i)
    const treatmentProb = this.computeTreatmentPropensity(
      age,
      bmi,
      hba1cBaseline,
      egfrBaseline,
      ses
    );
    const treatment = this.rng.binomial(1, treatmentProb);

    // Step 4: Outcomes with ground truth
    const outcomes = this.generateOutcomes(
      treatment,
      age,
      bmi,
      raceAsian,
      hba1cBaseline,
      egfrBaseline,
      diuretic,
      loopDiuretic,
      ckdStage,
      ses
    );

    // Step 5: Apply missingness (MNAR)
    const missingProb = this.siteParams.missingRate * (1 + 0.5 * Math.max(0, Math.min(3, -ses)));
    const missing = this.rng.binomial(1, missingProb);

    return {
      patientId,
      siteId: this.siteId,
      age,
      bmi,
      raceAsian,
      hba1cBaseline: missing ? null : hba1cBaseline,
      egfrBaseline: missing ? null : egfrBaseline,
      ckdStage,
      ses,
      metformin,
      aceInhibitor,
      statin,
      diuretic,
      loopDiuretic,
      aspirin,
      treatmentSglt2i: treatment,
      ...outcomes,
    };
  }

  generateCkdStage(age, bmi) {
    const logit = -3.0 + 0.04 * age + 0.05 * bmi + this.rng.normal(0, 0.5);
    const probCkd = 1 / (1 + Math.exp(-logit));

    if (probCkd > 0.85) return 5;
    if (probCkd > 0.7) return 4;
    if (probCkd > 0.5) return 3;
    if (probCkd > 0.3) return 2;
    return 1;
  }

  ckdToEgfr(ckdStage) {
    const ranges = {
      1: [90, 120],
      2: [60, 89],
      3: [30, 59],
      4: [15, 29],
      5: [5, 14],
    };
    const [min, max] = ranges[ckdStage];
    return this.rng.uniform(min, max);
  }

  generateDiuretic(age, egfr, ses) {
    const logit = -1.5 + 0.03 * age - 0.02 * egfr + 0.3 * ses;
    const prob = 1 / (1 + Math.exp(-logit));
    return this.rng.binomial(1, prob);
  }

  computeTreatmentPropensity(age, bmi, hba1c, egfr, ses) {
    const confStrength = this.siteParams.confoundingStrength;
    const logit =
      -2.0 + 0.02 * age + 0.05 * bmi + 0.3 * hba1c - 0.01 * egfr + confStrength * 0.5 * ses;
    const prob = 1 / (1 + Math.exp(-logit));
    return Math.max(0.01, Math.min(0.99, prob));
  }

  generateOutcomes(
    treatment,
    age,
    bmi,
    raceAsian,
    hba1cBaseline,
    egfrBaseline,
    diuretic,
    loopDiuretic,
    ckdStage,
    ses
  ) {
    // Outcome 1: HbA1c change (primary)
    const hba1cChange =
      -0.5 +
      this.gt.primaryHbA1cReduction * treatment +
      0.01 * age -
      0.3 * ses +
      this.rng.normal(0, 0.8);

    // Outcome 2: eGFR change (Interaction 1: needs 1M)
    let egfrChange = -2.0 - 0.05 * age - 0.5 * (ckdStage >= 3) + this.rng.normal(0, 3.0);

    const interaction1 = hba1cBaseline > this.gt.interaction1ThresholdHbA1c && diuretic;
    egfrChange += treatment * (1.0 + this.gt.interaction1RenalBoost * interaction1);

    // Outcome 3: Hospitalization (Interaction 2: needs 10M)
    let hospLogit = -3.0 + 0.04 * age + 0.3 * (ckdStage >= 4) - 0.02 * egfrBaseline;
    let hospProb = 1 / (1 + Math.exp(-hospLogit));

    const interaction2 = raceAsian && age > 75 && bmi < 22;
    hospProb += treatment * interaction2 * this.gt.interaction2HospIncrease;
    hospProb = Math.max(0, Math.min(1, hospProb));

    const hospitalization = this.rng.binomial(1, hospProb);

    // Outcome 4: Adverse Event (Interaction 3: needs 1B)
    let aeLogit = -4.0 + 0.05 * age + 0.5 * (ckdStage >= 3);
    let aeProb = 1 / (1 + Math.exp(-aeLogit));

    const interaction3 = egfrBaseline >= 30 && egfrBaseline <= 45 && loopDiuretic && age > 80;
    aeProb += treatment * interaction3 * this.gt.interaction3AeIncrease;
    aeProb = Math.max(0, Math.min(1, aeProb));

    const adverseEvent = this.rng.binomial(1, aeProb);

    return {
      hba1cChange,
      egfrChange,
      hospitalization,
      adverseEvent,
      interaction1Indicator: interaction1 ? 1 : 0,
      interaction2Indicator: interaction2 ? 1 : 0,
      interaction3Indicator: interaction3 ? 1 : 0,
    };
  }

  // Generate batch of patients (legacy array return)
  generateBatch(startId, batchSize) {
    const patients = [];
    for (let i = 0; i < batchSize; i++) {
      patients.push(this.generatePatient(startId + i));
    }
    return patients;
  }

  // STREAMING generation: yields one patient at a time (O(1) memory)
  *generateStream(startId, batchSize) {
    for (let i = 0; i < batchSize; i++) {
      yield this.generatePatient(startId + i);
    }
  }
}

// Piscina worker export
module.exports = ({ nPatients, siteId, profile, seed, startId, batchSize }) => {
  const generator = new PolypharmacyDataGenerator(nPatients, siteId, profile, seed);
  const batch = generator.generateBatch(startId, batchSize);
  return { batch, siteId };
};

// Also export classes for direct usage
module.exports.PolypharmacyDataGenerator = PolypharmacyDataGenerator;
module.exports.GroundTruth = GroundTruth;
module.exports.SiteParameters = SiteParameters;
