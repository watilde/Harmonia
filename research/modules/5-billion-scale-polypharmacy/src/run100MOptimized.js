/**
 * 100 MILLION PATIENT RUN - Optimized with Worker Threads
 *
 * Validation run before scaling to 1 billion
 */

const TestOptimizedRunner = require('./testOptimized');
const path = require('path');
const os = require('os');

const CONFIG_100M = {
  totalPatients: 100_000_000, // 100 Million
  nSites: 100, // 100 sites
  patientsPerSite: 1_000_000, // 1M per site
  batchSize: os.cpus().length, // Use all CPU cores
  outputDir: path.join(__dirname, '../results/optimized_100million_run'),
  checkpointInterval: os.cpus().length * 5, // Checkpoint every 5 batches
};

class Runner100M extends TestOptimizedRunner {
  constructor() {
    super(CONFIG_100M);
  }
}

if (require.main === module) {
  console.log('🚀 Starting 100M OPTIMIZED run with Worker threads');
  console.log(
    `📊 Configuration: ${CONFIG_100M.nSites} sites × ${CONFIG_100M.patientsPerSite.toLocaleString()} patients/site`
  );
  console.log(`⚡ Using ${CONFIG_100M.batchSize} CPU cores in parallel`);
  console.log('');

  const runner = new Runner100M();
  const startTime = Date.now();

  runner
    .run()
    .then((results) => {
      const elapsedMinutes = (Date.now() - startTime) / 60000;

      console.log('\n🎉 100M OPTIMIZED RUN COMPLETE! 🎉\n');
      console.log('=== RESULTS ===');
      console.log(`Total patients: ${results.performance.totalPatients.toLocaleString()}`);
      console.log(
        `Total time: ${elapsedMinutes.toFixed(2)} minutes (${results.performance.elapsedSeconds.toFixed(1)}s)`
      );
      console.log(`Throughput: ${results.performance.throughput.toLocaleString()} patients/sec`);
      console.log('');
      console.log('=== CAUSAL ESTIMATES ===');
      console.log(
        `Propensity beta: [${results.causalEstimates.propensityBeta.map((b) => b.toFixed(4)).join(', ')}]`
      );
      console.log(`Overall ATE: ${results.causalEstimates.overallATE.toFixed(4)}`);
      console.log('');
      console.log('=== SUBGROUP EFFECTS ===');
      Object.entries(results.causalEstimates.subgroupEffects).forEach(([name, effect]) => {
        console.log(
          `  ${name}: ATE=${effect.ate?.toFixed(4) || 'N/A'}, n=${effect.n.toLocaleString()}`
        );
      });
      console.log('');
      console.log(`Results saved to: ${results.configuration.outputDir}/final_results.json`);
      console.log('');
      console.log('✅ Ready for 1 BILLION scale!');

      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 100M RUN FAILED');
      console.error('Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = Runner100M;
