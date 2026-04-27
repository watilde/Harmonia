/**
 * Multi-seed stability test: runs TestOptimizedRunner with 3 different base seeds
 * to assess result reproducibility across random draws.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const TestOptimizedRunner = require('./testOptimized');

const BASE_SEEDS = [42, 100, 200];
const OUTPUT_DIR = path.join(__dirname, '../results/multi_seed_test');

async function runAllSeeds() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allResults = [];

  for (const baseSeed of BASE_SEEDS) {
    console.log(`\n=== Running seed ${baseSeed} ===`);
    const config = {
      totalPatients: 1_000_000,
      nSites: 10,
      patientsPerSite: 100_000,
      batchSize: os.cpus().length,
      outputDir: path.join(OUTPUT_DIR, `seed_${baseSeed}`),
      checkpointInterval: 2,
      baseSeed,
    };

    const runner = new TestOptimizedRunner(config);
    const result = await runner.run();
    allResults.push({ baseSeed, result });
  }

  const summary = {
    seeds: BASE_SEEDS,
    interaction1: allResults.map((r) => ({
      baseSeed: r.baseSeed,
      ate: r.result.causalEstimates.subgroupEffects.interaction1.ate,
      n: r.result.causalEstimates.subgroupEffects.interaction1.n,
    })),
    interaction2: allResults.map((r) => ({
      baseSeed: r.baseSeed,
      ate: r.result.causalEstimates.subgroupEffects.interaction2.ate,
      n: r.result.causalEstimates.subgroupEffects.interaction2.n,
    })),
    interaction3: allResults.map((r) => ({
      baseSeed: r.baseSeed,
      ate: r.result.causalEstimates.subgroupEffects.interaction3.ate,
      n: r.result.causalEstimates.subgroupEffects.interaction3.n,
    })),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== MULTI-SEED SUMMARY ===');
  console.log('Interaction1 (true ATE = +3.0):');
  summary.interaction1.forEach((r) => {
    const dev = (((3.0 - r.ate) / 3.0) * 100).toFixed(1);
    console.log(`  seed=${r.baseSeed}: ATE=${r.ate.toFixed(4)}, n=${r.n}, deviation=${dev}%`);
  });
  console.log('Interaction2 (true eGFR ~+1.0):');
  summary.interaction2.forEach((r) => {
    console.log(`  seed=${r.baseSeed}: ATE=${r.ate.toFixed(4)}, n=${r.n}`);
  });
  console.log('Interaction3 (true eGFR ~+1.0–+3.0):');
  summary.interaction3.forEach((r) => {
    console.log(`  seed=${r.baseSeed}: ATE=${r.ate.toFixed(4)}, n=${r.n}`);
  });

  console.log(`\nSummary saved to ${OUTPUT_DIR}/summary.json`);
  return summary;
}

runAllSeeds()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
