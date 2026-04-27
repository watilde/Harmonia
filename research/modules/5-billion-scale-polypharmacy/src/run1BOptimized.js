/**
 * 1 BILLION PATIENT RUN - Optimized with Worker Threads
 *
 * Final production run with maximum performance
 */

const TestOptimizedRunner = require('./testOptimized');
const path = require('path');
const os = require('os');

const CONFIG_1B = {
  totalPatients: 1_000_000_000, // 1 Billion
  nSites: 1000, // 1000 sites
  patientsPerSite: 1_000_000, // 1M per site
  batchSize: os.cpus().length, // Use all CPU cores
  outputDir: path.join(__dirname, '../results/optimized_1billion_run'),
  checkpointInterval: os.cpus().length * 25, // Checkpoint every 25 batches
};

class Runner1B extends TestOptimizedRunner {
  constructor() {
    super(CONFIG_1B);
  }
}

if (require.main === module) {
  console.log('🚀 Starting 1 BILLION OPTIMIZED run with Worker threads');
  console.log(
    `📊 Configuration: ${CONFIG_1B.nSites} sites × ${CONFIG_1B.patientsPerSite.toLocaleString()} patients/site`
  );
  console.log(`⚡ Using ${CONFIG_1B.batchSize} CPU cores in parallel`);
  console.log(`💾 Checkpoints every ${CONFIG_1B.checkpointInterval} sites`);
  console.log('');
  console.log('⏱️  Estimated time: ~11 minutes (based on 1.56M pts/s throughput)');
  console.log('');

  const runner = new Runner1B();
  const startTime = Date.now();

  runner
    .run()
    .then((results) => {
      const elapsedMinutes = (Date.now() - startTime) / 60000;
      const elapsedHours = elapsedMinutes / 60;

      console.log('\n🎉 1 BILLION OPTIMIZED RUN COMPLETE! 🎉\n');
      console.log('=== PERFORMANCE ===');
      console.log(`Total patients: ${results.performance.totalPatients.toLocaleString()}`);
      console.log(
        `Total time: ${elapsedHours.toFixed(2)} hours (${elapsedMinutes.toFixed(1)} min, ${results.performance.elapsedSeconds.toFixed(0)}s)`
      );
      console.log(`Throughput: ${results.performance.throughput.toLocaleString()} patients/sec`);
      console.log(`CPU cores used: ${results.performance.cpuCores}`);
      console.log('');

      // Compare with in-memory version
      const inMemoryTime = 7692.894; // seconds (from previous run)
      const inMemoryThroughput = 129990; // pts/s
      const speedup = (inMemoryTime / results.performance.elapsedSeconds).toFixed(2);
      const throughputGain = (results.performance.throughput / inMemoryThroughput).toFixed(2);

      console.log('=== COMPARISON with In-Memory Version ===');
      console.log(
        `In-Memory: ${(inMemoryTime / 3600).toFixed(2)} hours (${inMemoryThroughput.toLocaleString()} pts/s)`
      );
      console.log(
        `Optimized: ${elapsedHours.toFixed(2)} hours (${results.performance.throughput.toLocaleString()} pts/s)`
      );
      console.log(`Speedup: ${speedup}× faster 🚀`);
      console.log(`Throughput gain: ${throughputGain}× higher`);
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
      console.log('=== INTERACTION 3 (Primary Focus) ===');
      const int3 = results.causalEstimates.subgroupEffects.interaction3;
      console.log(`  ATE: ${int3.ate?.toFixed(4)} ml/min/year`);
      console.log(`  Subgroup n: ${int3.n.toLocaleString()} patients`);
      console.log(`  Expected: ~1.46 (from in-memory run: 632,776 patients)`);
      console.log('');
      console.log(`Results saved to: ${results.configuration.outputDir}/final_results.json`);
      console.log('');
      console.log('🏆 MILESTONE ACHIEVED: 1 Billion Patient Analysis Complete!');
      console.log('📄 Update manuscript with new performance metrics');
      console.log(`   - Time: ${elapsedHours.toFixed(2)} hours (vs. 2.14 hours in-memory)`);
      console.log(`   - Throughput: ${results.performance.throughput.toLocaleString()} pts/s`);
      console.log(`   - Speedup: ${speedup}× faster with Worker threads`);

      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 1 BILLION RUN FAILED');
      console.error('Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = Runner1B;
