/**
 * Worker thread for parallel assumption diagnostics
 *
 * This worker processes a single site's data independently,
 * enabling parallel processing of multiple sites.
 */

import { parentPort, workerData } from 'worker_threads';
import {
  assessAssumptions,
  getViolationDetails,
  type Patient,
  type AssumptionScores,
  type ViolationDetails,
  type ProgressCallback,
} from './assumption-diagnostics';

interface WorkerInput {
  siteId: string;
  patients: Patient[];
  includeDetails: boolean;
}

interface WorkerOutput {
  siteId: string;
  scores: AssumptionScores;
  violations?: ViolationDetails[];
  error?: string;
}

if (!parentPort) {
  throw new Error('This module must be run as a worker thread');
}

const input = workerData as WorkerInput;

try {
  // Create progress callback that sends messages to parent
  const progressCallback: ProgressCallback = {
    onProgress: (stage: string, current: number, total: number, message?: string) => {
      parentPort!.postMessage({
        type: 'progress',
        siteId: input.siteId,
        stage,
        current,
        total,
        message,
      });
    },
  };

  // Assess assumptions
  const scores = assessAssumptions(input.patients, progressCallback);

  // Get detailed violations if requested
  const violations = input.includeDetails
    ? getViolationDetails(input.patients, progressCallback)
    : undefined;

  // Send result
  const output: WorkerOutput = {
    siteId: input.siteId,
    scores,
    violations,
  };

  parentPort.postMessage({
    type: 'result',
    data: output,
  });
} catch (error) {
  // Send error
  const output: WorkerOutput = {
    siteId: input.siteId,
    scores: {
      unconfoundedness_score: 0,
      positivity_score: 0,
      specification_score: 0,
      overall_score: 0,
    },
    error: error instanceof Error ? error.message : String(error),
  };

  parentPort.postMessage({
    type: 'error',
    data: output,
  });
}
