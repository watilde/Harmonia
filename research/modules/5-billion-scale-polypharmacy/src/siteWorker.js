/**
 * Worker Thread for parallel site processing
 * Each worker handles one site's computation independently
 */

const { parentPort, workerData } = require('worker_threads');
const { PolypharmacyDataGenerator } = require('./dataGenerator');

// Extract worker data
const { siteId, patientsPerSite, profile, seed, beta } = workerData;

// Create data generator for this site
const generator = new PolypharmacyDataGenerator(patientsPerSite, siteId, profile, seed);

// Compute all statistics in single pass
const p_prop = 5;
let gradient = new Array(p_prop).fill(0);
let hessian = Array(p_prop)
  .fill(0)
  .map(() => new Array(p_prop).fill(0));

const p_outcome = 6;
let XWX = Array(p_outcome)
  .fill(0)
  .map(() => new Array(p_outcome).fill(0));
let XWY = new Array(p_outcome).fill(0);

const subgroups = {
  interaction1: {
    treated_sum: 0,
    treated_weight: 0,
    control_sum: 0,
    control_weight: 0,
    nTreated: 0,
    nControl: 0,
  },
  interaction2: {
    treated_sum: 0,
    treated_weight: 0,
    control_sum: 0,
    control_weight: 0,
    nTreated: 0,
    nControl: 0,
  },
  interaction3: {
    treated_sum: 0,
    treated_weight: 0,
    control_sum: 0,
    control_weight: 0,
    nTreated: 0,
    nControl: 0,
  },
  overall: {
    treated_sum: 0,
    treated_weight: 0,
    control_sum: 0,
    control_weight: 0,
    nTreated: 0,
    nControl: 0,
  },
};

let nPatients = 0;

// SINGLE PASS through all patients
for (const patient of generator.generateStream(0, patientsPerSite)) {
  if (patient.hba1cBaseline === null || patient.egfrBaseline === null) continue;

  const x_ps = [
    1,
    patient.age / 100,
    patient.bmi / 100,
    patient.hba1cBaseline / 10,
    patient.egfrBaseline / 100,
  ];

  let logit = 0;
  for (let j = 0; j < p_prop; j++) {
    logit += beta[j] * x_ps[j];
  }
  const prob = 1 / (1 + Math.exp(-logit));

  // Propensity statistics
  const residual = patient.treatmentSglt2i - prob;
  for (let j = 0; j < p_prop; j++) {
    gradient[j] += x_ps[j] * residual;
  }

  const weight_prop = prob * (1 - prob);
  for (let j = 0; j < p_prop; j++) {
    for (let k = 0; k < p_prop; k++) {
      hessian[j][k] += x_ps[j] * x_ps[k] * weight_prop;
    }
  }

  // Outcome statistics
  const ipw_weight = patient.treatmentSglt2i === 1 ? 1 / prob : 1 / (1 - prob);
  const stableWeight = Math.min(ipw_weight, 10);

  const x_outcome = [
    1,
    patient.treatmentSglt2i,
    patient.age / 100,
    patient.bmi / 100,
    patient.hba1cBaseline / 10,
    patient.egfrBaseline / 100,
  ];

  const y = patient.egfrChange;

  for (let j = 0; j < p_outcome; j++) {
    XWY[j] += stableWeight * x_outcome[j] * y;
    for (let k = 0; k < p_outcome; k++) {
      XWX[j][k] += stableWeight * x_outcome[j] * x_outcome[k];
    }
  }

  // Subgroup statistics
  const groups = ['overall'];
  if (patient.interaction1Indicator === 1) groups.push('interaction1');
  if (patient.interaction2Indicator === 1) groups.push('interaction2');
  if (patient.interaction3Indicator === 1) groups.push('interaction3');

  for (const group of groups) {
    if (patient.treatmentSglt2i === 1) {
      subgroups[group].treated_sum += stableWeight * y;
      subgroups[group].treated_weight += stableWeight;
      subgroups[group].nTreated++;
    } else {
      subgroups[group].control_sum += stableWeight * y;
      subgroups[group].control_weight += stableWeight;
      subgroups[group].nControl++;
    }
  }

  nPatients++;
}

// Compute subgroup ATEs
const subgroupResults = {};
for (const [name, stats] of Object.entries(subgroups)) {
  const mean_treated = stats.treated_weight > 0 ? stats.treated_sum / stats.treated_weight : 0;
  const mean_control = stats.control_weight > 0 ? stats.control_sum / stats.control_weight : 0;

  subgroupResults[name] = {
    ate: mean_treated - mean_control,
    n: stats.nTreated + stats.nControl,
    nTreated: stats.nTreated,
    nControl: stats.nControl,
  };
}

// Send results back to main thread
parentPort.postMessage({
  siteId,
  propensity: {
    gradient,
    hessian,
    nPatients,
  },
  outcome: {
    XWX,
    XWY,
    nPatients,
  },
  subgroups: subgroupResults,
});
