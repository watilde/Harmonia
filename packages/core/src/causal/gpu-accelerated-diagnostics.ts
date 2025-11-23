/**
 * GPU-Accelerated Assumption Diagnostics
 *
 * Uses @tensorflow/tfjs-node or @tensorflow/tfjs-node-gpu for hardware acceleration
 * of computationally intensive operations like SMD calculations.
 *
 * Automatically falls back to CPU if GPU is not available.
 */

import * as tf from '@tensorflow/tfjs-node';
import type { Patient, ViolationDetails, ProgressCallback } from './assumption-diagnostics';

// Check if GPU backend is available (will be false in CPU-only environments)
let GPU_AVAILABLE = false;
let backendInitialized = false;

/**
 * Initialize TensorFlow backend and check for GPU availability
 */
async function initializeBackend(): Promise<void> {
  if (backendInitialized) return;

  try {
    await tf.ready();
    const backend = tf.getBackend();
    GPU_AVAILABLE = backend === 'tensorflow' && process.env.TF_FORCE_GPU_ALLOW_GROWTH === 'true';
    backendInitialized = true;
  } catch (error) {
    console.warn('TensorFlow GPU initialization failed, falling back to CPU:', error);
    GPU_AVAILABLE = false;
    backendInitialized = true;
  }
}

/**
 * Extract numerical matrix from patients for vectorized operations
 */
function extractCovariateMatrix(
  patients: Patient[],
  covariateNames: string[]
): { matrix: number[][]; validIndices: number[] } {
  const matrix: number[][] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const row: number[] = [];
    let valid = true;

    for (const covar of covariateNames) {
      let value: number;

      if (covar === 'age') {
        value = p.age ?? 0;
        if (p.age === undefined) valid = false;
      } else if (covar === 'gender') {
        value = p.gender === 'M' ? 1 : 0;
      } else {
        value = p.covariates?.[covar] ?? 0;
      }

      row.push(value);
    }

    if (valid) {
      matrix.push(row);
      validIndices.push(i);
    }
  }

  return { matrix, validIndices };
}

/**
 * Compute Standardized Mean Differences using TensorFlow
 *
 * This vectorizes the SMD computation for multiple covariates simultaneously,
 * taking advantage of GPU parallelization when available.
 */
export async function computeSMDsGPU(
  treated: Patient[],
  control: Patient[],
  covariateNames: string[],
  progressCallback?: ProgressCallback
): Promise<number[]> {
  await initializeBackend();

  progressCallback?.onProgress(
    'unconfoundedness-gpu',
    1,
    4,
    `Extracting covariate matrices (${GPU_AVAILABLE ? 'GPU' : 'CPU'} mode)`
  );

  // Extract numerical matrices
  const treatedData = extractCovariateMatrix(treated, covariateNames);
  const controlData = extractCovariateMatrix(control, covariateNames);

  if (treatedData.matrix.length === 0 || controlData.matrix.length === 0) {
    return [];
  }

  progressCallback?.onProgress('unconfoundedness-gpu', 2, 4, 'Creating tensors');

  // Create tensors (automatically uses GPU if available)
  const treatedTensor = tf.tensor2d(treatedData.matrix);
  const controlTensor = tf.tensor2d(controlData.matrix);

  try {
    progressCallback?.onProgress(
      'unconfoundedness-gpu',
      3,
      4,
      `Computing SMDs for ${covariateNames.length} covariates`
    );

    // Compute means: [numCovariates]
    const treatedMeans = tf.mean(treatedTensor, 0);
    const controlMeans = tf.mean(controlTensor, 0);

    // Compute standard deviations
    const treatedStd = tf.moments(treatedTensor, 0).variance.sqrt();
    const controlStd = tf.moments(controlTensor, 0).variance.sqrt();

    // Compute pooled standard deviation
    // pooled_std = sqrt((std_treated^2 + std_control^2) / 2)
    const pooledStd = treatedStd.square().add(controlStd.square()).div(2).sqrt();

    // Compute SMD = |mean_treated - mean_control| / pooled_std
    const meanDiff = treatedMeans.sub(controlMeans).abs();
    const smds = meanDiff.div(pooledStd.add(1e-10)); // Add epsilon to avoid division by zero

    progressCallback?.onProgress('unconfoundedness-gpu', 4, 4, 'Extracting results');

    // Extract to JavaScript array
    const smdsArray = (await smds.array()) as number[];

    // Cleanup tensors
    treatedTensor.dispose();
    controlTensor.dispose();
    treatedMeans.dispose();
    controlMeans.dispose();
    treatedStd.dispose();
    controlStd.dispose();
    pooledStd.dispose();
    meanDiff.dispose();
    smds.dispose();

    return smdsArray;
  } catch (error) {
    // Cleanup on error
    treatedTensor.dispose();
    controlTensor.dispose();
    throw error;
  }
}

/**
 * Compute propensity scores using vectorized operations
 */
export async function estimatePropensityScoresGPU(
  patients: Patient[],
  progressCallback?: ProgressCallback
): Promise<number[]> {
  await initializeBackend();

  progressCallback?.onProgress(
    'positivity-gpu',
    1,
    3,
    `Estimating propensity scores (${GPU_AVAILABLE ? 'GPU' : 'CPU'} mode)`
  );

  // If propensity scores already provided, return them
  if (patients.length > 0 && patients[0].propensity_score !== undefined) {
    return patients.map((p) => p.propensity_score!);
  }

  // Extract age and treatment vectors
  const ages = patients.map((p) => p.age ?? 50);
  const treatments = patients.map((p) => p.treatment);

  progressCallback?.onProgress('positivity-gpu', 2, 3, 'Computing age-based propensity scores');

  // Create tensors
  const ageTensor = tf.tensor1d(ages);
  const treatmentTensor = tf.tensor1d(treatments);

  try {
    // For each patient, find similar patients (within 10 years) and compute proportion treated
    // This is still somewhat sequential, but we can batch it
    const propensityScores: number[] = [];
    const batchSize = 1000;

    for (let i = 0; i < patients.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, patients.length);
      const batchAges = ages.slice(i, batchEnd);

      // For each age in batch, compute distance to all ages
      const batchTensor = tf.tensor1d(batchAges);
      const ageDiffs = tf.abs(batchTensor.expandDims(1).sub(ageTensor.expandDims(0)));

      // Find patients within 10 years (mask)
      const mask = ageDiffs.lessEqual(10);

      // For each patient in batch, compute propensity score
      for (let j = 0; j < batchAges.length; j++) {
        const patientMask = mask.slice([j, 0], [1, -1]).squeeze();
        const similarTreatments = treatmentTensor.mul(patientMask.cast('float32'));
        const similarCount = patientMask.sum().dataSync()[0];
        const treatmentSum = similarTreatments.sum().dataSync()[0];
        const ps = similarCount > 0 ? treatmentSum / similarCount : 0.5;
        propensityScores.push(ps);

        similarTreatments.dispose();
        patientMask.dispose();
      }

      batchTensor.dispose();
      ageDiffs.dispose();
      mask.dispose();

      if ((i + batchSize) % 10000 === 0) {
        progressCallback?.onProgress(
          'positivity-gpu',
          2,
          3,
          `Processed ${i + batchSize}/${patients.length} patients`
        );
      }
    }

    progressCallback?.onProgress('positivity-gpu', 3, 3, 'Propensity score estimation complete');

    // Cleanup
    ageTensor.dispose();
    treatmentTensor.dispose();

    return propensityScores;
  } catch (error) {
    ageTensor.dispose();
    treatmentTensor.dispose();
    throw error;
  }
}

/**
 * GPU-accelerated unconfoundedness detection
 */
export async function detectUnconfoundednessViolationGPU(
  patients: Patient[],
  progressCallback?: ProgressCallback
): Promise<ViolationDetails> {
  // Split into treated and control
  progressCallback?.onProgress('unconfoundedness-gpu', 1, 5, 'Splitting treatment groups');
  const treated = patients.filter((p) => p.treatment === 1);
  const control = patients.filter((p) => p.treatment === 0);

  if (treated.length === 0 || control.length === 0) {
    return {
      assumption: 'unconfoundedness',
      score: 0,
      severity: 'severe',
      description: 'No treated or control patients',
      recommendation: 'Check data filtering and treatment assignment',
    };
  }

  // Get covariate names
  progressCallback?.onProgress('unconfoundedness-gpu', 2, 5, 'Extracting covariate names');
  const covariateNames: string[] = [];
  if (patients[0].age !== undefined) covariateNames.push('age');
  if (patients[0].gender !== undefined) covariateNames.push('gender');
  if (patients[0].covariates) {
    covariateNames.push(...Object.keys(patients[0].covariates));
  }

  if (covariateNames.length === 0) {
    return {
      assumption: 'unconfoundedness',
      score: 0.5,
      severity: 'moderate',
      description: 'No covariates available for balance assessment',
      recommendation: 'Measure and adjust for potential confounders',
    };
  }

  // Compute SMDs using GPU acceleration
  const smds = await computeSMDsGPU(treated, control, covariateNames, progressCallback);

  if (smds.length === 0) {
    return {
      assumption: 'unconfoundedness',
      score: 0,
      severity: 'severe',
      description: 'Failed to compute SMDs',
      recommendation: 'Check data quality and covariate availability',
    };
  }

  progressCallback?.onProgress('unconfoundedness-gpu', 5, 5, 'Computing final score');

  // Compute score based on SMD distribution
  const max_smd = Math.max(...smds);
  const mean_smd = smds.reduce((a, b) => a + b, 0) / smds.length;

  let score: number;
  if (max_smd < 0.05) {
    score = 1.0; // Excellent balance
  } else if (max_smd < 0.1) {
    score = 0.9; // Good balance
  } else if (max_smd < 0.2) {
    score = 0.7; // Acceptable balance
  } else if (max_smd < 0.5) {
    score = 0.4; // Moderate imbalance
  } else {
    score = 0.1; // Severe imbalance
  }

  const severity = classifySeverity(score);

  return {
    assumption: 'unconfoundedness',
    score,
    severity,
    description: `Covariate balance (GPU): max SMD = ${max_smd.toFixed(3)}, mean SMD = ${mean_smd.toFixed(3)}`,
    recommendation:
      severity === 'none'
        ? 'Proceed with standard causal inference'
        : severity === 'mild'
          ? 'Consider covariate adjustment or propensity score methods'
          : severity === 'moderate'
            ? 'Use partial identification (Manski bounds) or sensitivity analysis (E-values)'
            : 'Severe confounding detected. Use Manski bounds + E-values for safe inference',
  };
}

function classifySeverity(score: number): 'none' | 'mild' | 'moderate' | 'severe' {
  if (score >= 0.8) return 'none';
  if (score >= 0.6) return 'mild';
  if (score >= 0.4) return 'moderate';
  return 'severe';
}

/**
 * Check if GPU acceleration is available
 */
export async function isGPUAvailable(): Promise<boolean> {
  await initializeBackend();
  return GPU_AVAILABLE;
}

/**
 * Get backend information for diagnostics
 */
export async function getBackendInfo(): Promise<{
  backend: string;
  gpuAvailable: boolean;
  tensorflowVersion: string;
}> {
  await initializeBackend();
  return {
    backend: tf.getBackend(),
    gpuAvailable: GPU_AVAILABLE,
    tensorflowVersion: tf.version.tfjs,
  };
}
