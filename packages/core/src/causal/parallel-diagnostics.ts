/**
 * Parallel Assumption Diagnostics using Worker Threads
 *
 * Enables concurrent processing of multiple sites for better performance
 * on large datasets.
 */

import { Worker } from 'worker_threads';
import { resolve } from 'path';
import { cpus } from 'os';
import type { Patient, AssumptionScores, ViolationDetails } from './assumption-diagnostics';

export interface SiteData {
  siteId: string;
  patients: Patient[];
}

export interface ParallelDiagnosticResult {
  siteId: string;
  scores: AssumptionScores;
  violations?: ViolationDetails[];
  error?: string;
}

export interface ParallelProgressCallback {
  onSiteProgress: (
    siteId: string,
    stage: string,
    current: number,
    total: number,
    message?: string
  ) => void;
  onOverallProgress: (completed: number, total: number) => void;
}

/**
 * Run assumption diagnostics in parallel across multiple sites
 */
export async function diagnoseAssumptionsParallel(
  sites: SiteData[],
  options: {
    includeDetails?: boolean;
    maxWorkers?: number;
    progressCallback?: ParallelProgressCallback;
  } = {}
): Promise<ParallelDiagnosticResult[]> {
  const {
    includeDetails = false,
    maxWorkers = Math.min(cpus().length, sites.length),
    progressCallback,
  } = options;

  const results: ParallelDiagnosticResult[] = [];
  const workerPath = resolve(__dirname, 'assumption-diagnostics-worker.js');

  return new Promise((resolve) => {
    let completed = 0;
    let siteIndex = 0;
    const activeWorkers: Worker[] = [];

    // Function to spawn a worker for the next site
    const spawnWorker = () => {
      if (siteIndex >= sites.length) {
        // No more sites to process
        if (completed === sites.length) {
          // All done
          resolve(results);
        }
        return;
      }

      const site = sites[siteIndex];
      siteIndex++;

      const worker = new Worker(workerPath, {
        workerData: {
          siteId: site.siteId,
          patients: site.patients,
          includeDetails,
        },
      });

      activeWorkers.push(worker);

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          progressCallback?.onSiteProgress(
            msg.siteId,
            msg.stage,
            msg.current,
            msg.total,
            msg.message
          );
        } else if (msg.type === 'result' || msg.type === 'error') {
          results.push(msg.data);
          completed++;
          progressCallback?.onOverallProgress(completed, sites.length);

          // Clean up worker
          const workerIndex = activeWorkers.indexOf(worker);
          if (workerIndex > -1) {
            activeWorkers.splice(workerIndex, 1);
          }
          void worker.terminate();

          // Spawn next worker
          spawnWorker();
        }
      });

      worker.on('error', (error) => {
        results.push({
          siteId: site.siteId,
          scores: {
            unconfoundedness_score: 0,
            positivity_score: 0,
            specification_score: 0,
            overall_score: 0,
          },
          error: error.message,
        });
        completed++;
        progressCallback?.onOverallProgress(completed, sites.length);

        // Clean up worker
        const workerIndex = activeWorkers.indexOf(worker);
        if (workerIndex > -1) {
          activeWorkers.splice(workerIndex, 1);
        }
        void worker.terminate();

        // Spawn next worker
        spawnWorker();
      });

      worker.on('exit', (code) => {
        if (code !== 0 && completed < sites.length) {
          // Worker crashed unexpectedly
          results.push({
            siteId: site.siteId,
            scores: {
              unconfoundedness_score: 0,
              positivity_score: 0,
              specification_score: 0,
              overall_score: 0,
            },
            error: `Worker exited with code ${code}`,
          });
          completed++;
          progressCallback?.onOverallProgress(completed, sites.length);

          // Spawn next worker
          spawnWorker();
        }
      });
    };

    // Spawn initial batch of workers
    for (let i = 0; i < maxWorkers; i++) {
      spawnWorker();
    }
  });
}

/**
 * Helper: Create a simple progress callback for CLI usage
 */
export function createCliProgressCallback(): ParallelProgressCallback {
  const siteStatus = new Map<string, { stage: string; progress: string }>();
  let lastUpdateTime = Date.now();

  return {
    onSiteProgress: (siteId, stage, current, total) => {
      const percentage = Math.round((current / total) * 100);
      const bar =
        '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
      siteStatus.set(siteId, {
        stage,
        progress: `[${bar}] ${percentage}%`,
      });

      // Throttle updates to avoid console spam
      const now = Date.now();
      if (now - lastUpdateTime > 200) {
        displayProgress(siteStatus);
        lastUpdateTime = now;
      }
    },

    onOverallProgress: (completed, total) => {
      console.log(`\n✓ Completed ${completed}/${total} sites\n`);
    },
  };
}

function displayProgress(siteStatus: Map<string, { stage: string; progress: string }>) {
  // Clear previous lines
  process.stdout.write('\x1b[2J\x1b[H');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Parallel Assumption Diagnostics Progress                    ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');

  siteStatus.forEach((status, siteId) => {
    const siteLabel = siteId.padEnd(12);
    const stageLabel = status.stage.padEnd(18);
    console.log(`║  ${siteLabel} │ ${stageLabel} │ ${status.progress}  ║`);
  });

  console.log('╚═══════════════════════════════════════════════════════════════╝');
}
