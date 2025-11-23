/**
 * Adaptive Assumption Diagnostics
 *
 * Automatically selects between GPU-accelerated and CPU-based diagnostics
 * based on:
 * 1. GPU availability
 * 2. Dataset size (GPU overhead only worth it for large datasets)
 * 3. User preferences
 */

import type {
  Patient,
  ViolationDetails,
  AssumptionScores,
  ProgressCallback,
} from './assumption-diagnostics';
import {
  detectUnconfoundednessViolation,
  detectPositivityViolation,
  detectSpecificationViolation,
  assessAssumptions as assessAssumptionsCPU,
} from './assumption-diagnostics';
import {
  detectUnconfoundednessViolationGPU,
  isGPUAvailable,
  getBackendInfo,
} from './gpu-accelerated-diagnostics';

// Threshold for GPU acceleration (below this, CPU is faster due to overhead)
const GPU_THRESHOLD_PATIENTS = 10000;

export interface AdaptiveDiagnosticOptions {
  forceGPU?: boolean;
  forceCPU?: boolean;
  gpuThreshold?: number;
  progressCallback?: ProgressCallback;
}

/**
 * Automatically select the best diagnostic method based on dataset size and hardware
 */
export async function assessAssumptionsAdaptive(
  patients: Patient[],
  options: AdaptiveDiagnosticOptions = {}
): Promise<AssumptionScores & { backend: 'cpu' | 'gpu'; backendInfo?: any }> {
  const {
    forceGPU = false,
    forceCPU = false,
    gpuThreshold = GPU_THRESHOLD_PATIENTS,
    progressCallback,
  } = options;

  // Determine which backend to use
  let useGPU = false;

  if (forceCPU) {
    useGPU = false;
    progressCallback?.onProgress('backend-selection', 1, 1, 'Using CPU (forced)');
  } else if (forceGPU) {
    useGPU = await isGPUAvailable();
    if (!useGPU) {
      progressCallback?.onProgress(
        'backend-selection',
        1,
        1,
        'GPU forced but not available, falling back to CPU'
      );
    } else {
      progressCallback?.onProgress('backend-selection', 1, 1, 'Using GPU (forced)');
    }
  } else {
    // Automatic selection based on data size and GPU availability
    const gpuAvailable = await isGPUAvailable();
    const datasetLargeEnough = patients.length >= gpuThreshold;

    useGPU = gpuAvailable && datasetLargeEnough;

    if (useGPU) {
      progressCallback?.onProgress(
        'backend-selection',
        1,
        1,
        `Using GPU acceleration (${patients.length.toLocaleString()} patients)`
      );
    } else if (gpuAvailable && !datasetLargeEnough) {
      progressCallback?.onProgress(
        'backend-selection',
        1,
        1,
        `Using CPU (dataset too small for GPU: ${patients.length.toLocaleString()} < ${gpuThreshold.toLocaleString()})`
      );
    } else {
      progressCallback?.onProgress(
        'backend-selection',
        1,
        1,
        `Using CPU (GPU not available, ${patients.length.toLocaleString()} patients)`
      );
    }
  }

  // Run diagnostics with selected backend
  if (useGPU) {
    return await assessAssumptionsGPU(patients, progressCallback);
  } else {
    const scores = assessAssumptionsCPU(patients, progressCallback);
    return { ...scores, backend: 'cpu' };
  }
}

/**
 * GPU-accelerated assumption assessment
 */
async function assessAssumptionsGPU(
  patients: Patient[],
  progressCallback?: ProgressCallback
): Promise<AssumptionScores & { backend: 'gpu'; backendInfo: any }> {
  // Get backend info
  const backendInfo = await getBackendInfo();

  progressCallback?.onProgress('overall-gpu', 1, 3, 'Assessing unconfoundedness (GPU)');
  const unconfoundedness = await detectUnconfoundednessViolationGPU(patients, progressCallback);

  // For now, use CPU for positivity and specification (can be GPU-accelerated later)
  progressCallback?.onProgress('overall-gpu', 2, 3, 'Assessing positivity (CPU fallback)');
  const positivity = detectPositivityViolation(patients, progressCallback);

  progressCallback?.onProgress('overall-gpu', 3, 3, 'Assessing specification (CPU fallback)');
  const specification = detectSpecificationViolation(patients, progressCallback);

  // Overall score: geometric mean (conservative)
  const overall_score = Math.pow(
    unconfoundedness.score * positivity.score * specification.score,
    1 / 3
  );

  return {
    unconfoundedness_score: unconfoundedness.score,
    positivity_score: positivity.score,
    specification_score: specification.score,
    overall_score,
    backend: 'gpu',
    backendInfo,
  };
}

/**
 * Get all violation details using adaptive backend selection
 */
export async function getViolationDetailsAdaptive(
  patients: Patient[],
  options: AdaptiveDiagnosticOptions = {}
): Promise<ViolationDetails[]> {
  const { progressCallback } = options;

  // For detailed analysis, we compute all three violations
  // Only unconfoundedness is GPU-accelerated for now
  const useGPU =
    !options.forceCPU &&
    (await isGPUAvailable()) &&
    patients.length >= (options.gpuThreshold ?? GPU_THRESHOLD_PATIENTS);

  if (useGPU) {
    progressCallback?.onProgress('violations-gpu', 1, 3, 'Computing violations (GPU)');
    return [
      await detectUnconfoundednessViolationGPU(patients, progressCallback),
      detectPositivityViolation(patients, progressCallback),
      detectSpecificationViolation(patients, progressCallback),
    ];
  } else {
    progressCallback?.onProgress('violations-cpu', 1, 3, 'Computing violations (CPU)');
    return [
      detectUnconfoundednessViolation(patients, progressCallback),
      detectPositivityViolation(patients, progressCallback),
      detectSpecificationViolation(patients, progressCallback),
    ];
  }
}

/**
 * Benchmark CPU vs GPU performance
 */
export async function benchmarkBackends(
  patients: Patient[],
  iterations: number = 3
): Promise<{
  cpu: { avgTime: number; scores: AssumptionScores };
  gpu: { avgTime: number; scores: AssumptionScores } | null;
  speedup: number | null;
}> {
  console.log(
    `\n🔬 Benchmarking backends with ${patients.length.toLocaleString()} patients (${iterations} iterations)...\n`
  );

  // Benchmark CPU
  const cpuTimes: number[] = [];
  let cpuScores: AssumptionScores | null = null;

  console.log('  Testing CPU backend...');
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    cpuScores = assessAssumptionsCPU(patients);
    const elapsed = Date.now() - start;
    cpuTimes.push(elapsed);
    console.log(`    Iteration ${i + 1}: ${elapsed}ms`);
  }

  const cpuAvg = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
  console.log(`  CPU Average: ${cpuAvg.toFixed(1)}ms\n`);

  // Benchmark GPU (if available)
  const gpuAvailable = await isGPUAvailable();
  let gpuResult: { avgTime: number; scores: AssumptionScores } | null = null;
  let speedup: number | null = null;

  if (gpuAvailable) {
    const gpuTimes: number[] = [];
    let gpuScores: AssumptionScores | null = null;

    console.log('  Testing GPU backend...');
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      gpuScores = await assessAssumptionsGPU(patients);
      const elapsed = Date.now() - start;
      gpuTimes.push(elapsed);
      console.log(`    Iteration ${i + 1}: ${elapsed}ms`);
    }

    const gpuAvg = gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length;
    speedup = cpuAvg / gpuAvg;
    console.log(`  GPU Average: ${gpuAvg.toFixed(1)}ms`);
    console.log(`  Speedup: ${speedup.toFixed(2)}x\n`);

    gpuResult = { avgTime: gpuAvg, scores: gpuScores! };
  } else {
    console.log('  GPU not available, skipping GPU benchmark\n');
  }

  return {
    cpu: { avgTime: cpuAvg, scores: cpuScores! },
    gpu: gpuResult,
    speedup,
  };
}
