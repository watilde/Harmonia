/**
 * TEST SCRIPT for Optimized Billion Runner
 *
 * Start small (1M patients) to verify Worker threads work correctly
 */

const { Worker } = require('worker_threads');
const { Matrix, inverse } = require('ml-matrix');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_CONFIG = {
  totalPatients: 1_000_000, // 1M for testing
  nSites: 10, // 10 sites
  patientsPerSite: 100_000, // 100K per site
  batchSize: os.cpus().length,
  outputDir: path.join(__dirname, '../results/test_optimized_run'),
  checkpointInterval: 2,
  baseSeed: 42,
};

class TestOptimizedRunner {
  constructor(config = TEST_CONFIG) {
    this.config = config;
    this.startTime = Date.now();
    this.processedSites = 0;
    this.totalPatients = 0;
    this.beta = [0, 0, 0, 0, 0];
    this.cumulativeResults = {
      outcomeStats: [],
      subgroupStats: [],
      overlapStats: [],
    };

    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
  }

  log(message) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const throughput =
      this.totalPatients > 0
        ? Math.floor((this.totalPatients / (Date.now() - this.startTime)) * 1000)
        : 0;
    console.log(`[${elapsed}s | ${throughput.toLocaleString()} pts/s] ${message}`);
  }

  async processBatchWithWorkers(startSiteId, endSiteId) {
    this.log(
      `Processing batch: sites ${startSiteId}-${endSiteId} with ${endSiteId - startSiteId} worker threads`
    );

    const workerPromises = [];

    // Create worker for each site
    for (let siteId = startSiteId; siteId < endSiteId; siteId++) {
      const profile = ['US', 'Japan', 'Nordic', 'India'][siteId % 4];

      const workerPromise = new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'siteWorker.js'), {
          workerData: {
            siteId,
            patientsPerSite: this.config.patientsPerSite,
            profile,
            seed: (this.config.baseSeed ?? 42) + siteId,
            beta: this.beta,
          },
        });

        let hasResolved = false;

        worker.on('message', (result) => {
          if (!hasResolved) {
            hasResolved = true;
            resolve(result);
            worker.terminate();
          }
        });

        worker.on('error', (error) => {
          if (!hasResolved) {
            hasResolved = true;
            reject(error);
          }
        });

        worker.on('exit', (code) => {
          if (!hasResolved && code !== 0) {
            hasResolved = true;
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      workerPromises.push(workerPromise);
    }

    // Wait for all workers to complete
    const results = await Promise.all(workerPromises);

    // Update counters
    this.totalPatients += (endSiteId - startSiteId) * this.config.patientsPerSite;
    this.processedSites += endSiteId - startSiteId;

    this.log(`  ✅ All ${results.length} workers completed`);

    return results;
  }

  aggregatePropensityStatistics(localStats) {
    const p = 5;
    let totalGradient = new Array(p).fill(0);
    let totalHessian = Array(p)
      .fill(0)
      .map(() => new Array(p).fill(0));

    for (const stat of localStats) {
      for (let j = 0; j < p; j++) {
        totalGradient[j] += stat.propensity.gradient[j];
        for (let k = 0; k < p; k++) {
          totalHessian[j][k] += stat.propensity.hessian[j][k];
        }
      }
    }

    try {
      const H = new Matrix(totalHessian);
      const g = Matrix.columnVector(totalGradient);
      const H_inv = inverse(H);
      const update = H_inv.mmul(g);

      for (let j = 0; j < p; j++) {
        this.beta[j] += update.get(j, 0);
      }

      // Convergence: ||∇L(β)|| < ε  (first-order optimality: score function → 0).
      // This is one Newton step per batch; beta converges across batches.
      const gradientNorm = Math.sqrt(totalGradient.reduce((sum, g) => sum + g * g, 0));

      return {
        beta: this.beta,
        gradientNorm,
        converged: gradientNorm < 1e-4,
      };
    } catch (error) {
      this.log(`  ⚠️ Propensity aggregation error: ${error.message}`);
      return { beta: this.beta, gradientNorm: Infinity, converged: false };
    }
  }

  async run() {
    this.log(`🚀 Starting OPTIMIZED TEST: ${this.config.totalPatients.toLocaleString()} patients`);
    this.log(
      `Configuration: ${this.config.nSites} sites × ${this.config.patientsPerSite.toLocaleString()} patients/site`
    );
    this.log(`⚡ Worker threads: ${this.config.batchSize} cores in parallel`);

    try {
      // Process in batches
      for (let startSite = 0; startSite < this.config.nSites; startSite += this.config.batchSize) {
        const endSite = Math.min(startSite + this.config.batchSize, this.config.nSites);

        // Run workers and get results
        const batchResults = await this.processBatchWithWorkers(startSite, endSite);

        // Aggregate propensity score statistics
        const propensityResult = this.aggregatePropensityStatistics(batchResults);

        // Accumulate outcome, subgroup, and overlap statistics
        this.cumulativeResults.outcomeStats.push(...batchResults.map((r) => r.outcome));
        this.cumulativeResults.subgroupStats.push(...batchResults.map((r) => r.subgroups));
        this.cumulativeResults.overlapStats.push(...batchResults.map((r) => r.overlap));

        // Checkpoint
        if (endSite % this.config.checkpointInterval === 0) {
          const checkpoint = {
            processedSites: this.processedSites,
            totalPatients: this.totalPatients,
            beta: this.beta,
            timestamp: new Date().toISOString(),
            elapsedSeconds: (Date.now() - this.startTime) / 1000,
          };

          const checkpointPath = path.join(this.config.outputDir, `checkpoint_${endSite}.json`);
          fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
          this.log(
            `💾 Checkpoint ${endSite}: beta norm = ${propensityResult.gradientNorm.toFixed(6)}`
          );
        }

        if (global.gc) global.gc();
      }

      // Final aggregation
      this.log('📊 Final aggregation...');

      // Aggregate outcome statistics
      const p_outcome = 6;
      let totalXWX = Array(p_outcome)
        .fill(0)
        .map(() => new Array(p_outcome).fill(0));
      let totalXWY = new Array(p_outcome).fill(0);
      let totalN = 0;

      for (const stat of this.cumulativeResults.outcomeStats) {
        for (let j = 0; j < p_outcome; j++) {
          totalXWY[j] += stat.XWY[j];
          for (let k = 0; k < p_outcome; k++) {
            totalXWX[j][k] += stat.XWX[j][k];
          }
        }
        totalN += stat.nPatients;
      }

      const XWX = new Matrix(totalXWX);
      const XWY = Matrix.columnVector(totalXWY);
      const XWX_inv = inverse(XWX);
      const coefficients = XWX_inv.mmul(XWY);

      // Aggregate subgroup statistics
      const subgroupNames = ['overall', 'interaction1', 'interaction2', 'interaction3'];
      const aggregatedSubgroups = {};

      for (const name of subgroupNames) {
        let totalATE = 0;
        let totalN = 0;

        for (const siteSubgroups of this.cumulativeResults.subgroupStats) {
          const subgroup = siteSubgroups[name];
          if (subgroup && subgroup.n > 0) {
            totalATE += subgroup.ate * subgroup.n;
            totalN += subgroup.n;
          }
        }

        aggregatedSubgroups[name] = {
          ate: totalN > 0 ? totalATE / totalN : null,
          n: totalN,
        };
      }

      // Aggregate overlap counts and compute true conditional ATEs
      // True ATE = 1.0 + 2.0 * P(interaction1 | subgroup)
      let total_i2_n = 0, total_i2_also_i1 = 0;
      let total_i3_n = 0, total_i3_also_i1 = 0;
      for (const o of this.cumulativeResults.overlapStats) {
        total_i2_n += o.interaction2_n;
        total_i2_also_i1 += o.interaction2_also_interaction1;
        total_i3_n += o.interaction3_n;
        total_i3_also_i1 += o.interaction3_also_interaction1;
      }
      const p_i1_given_i2 = total_i2_n > 0 ? total_i2_also_i1 / total_i2_n : 0;
      const p_i1_given_i3 = total_i3_n > 0 ? total_i3_also_i1 / total_i3_n : 0;
      const trueConditionalATE = {
        interaction2: {
          p_interaction1_overlap: p_i1_given_i2,
          true_egfr_ate: 1.0 + 2.0 * p_i1_given_i2,
        },
        interaction3: {
          p_interaction1_overlap: p_i1_given_i3,
          true_egfr_ate: 1.0 + 2.0 * p_i1_given_i3,
        },
      };

      const results = {
        configuration: this.config,
        performance: {
          totalPatients: this.totalPatients,
          processedSites: this.processedSites,
          elapsedSeconds: (Date.now() - this.startTime) / 1000,
          throughput: Math.floor((this.totalPatients / (Date.now() - this.startTime)) * 1000),
          cpuCores: this.config.batchSize,
        },
        causalEstimates: {
          propensityBeta: this.beta,
          overallATE: coefficients.get(1, 0),
          subgroupEffects: aggregatedSubgroups,
          trueConditionalATE,
        },
        timestamp: new Date().toISOString(),
      };

      const resultsPath = path.join(this.config.outputDir, 'final_results.json');
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

      this.log(`✅ TEST COMPLETE! Results: ${resultsPath}`);
      this.log(`📈 Total time: ${(results.performance.elapsedSeconds / 60).toFixed(2)} minutes`);
      this.log(`⚡ Throughput: ${results.performance.throughput.toLocaleString()} patients/sec`);
      this.log(
        `🎯 Interaction 3 ATE: ${aggregatedSubgroups.interaction3.ate?.toFixed(4) || 'N/A'} (n=${aggregatedSubgroups.interaction3.n})`
      );

      return results;
    } catch (error) {
      this.log(`❌ ERROR: ${error.message}`);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const runner = new TestOptimizedRunner();
  runner
    .run()
    .then((results) => {
      console.log('\n🎉 TEST SUCCESSFUL! 🎉');
      console.log(`\nNext steps:`);
      console.log(`1. Review results: ${TEST_CONFIG.outputDir}/final_results.json`);
      console.log(`2. If test passed, scale up to 100M or 1B patients`);
      console.log(`3. Compare with in-memory version performance`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ TEST FAILED');
      console.error('Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = TestOptimizedRunner;
