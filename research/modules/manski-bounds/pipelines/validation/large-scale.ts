#!/usr/bin/env ts-node
/**
 * Large-Scale Validation for Manuscript v5.4
 *
 * Runs Manski bounds computation on Synthea data at multiple scales:
 * - 1k patients (small)
 * - 10k patients (medium)
 * - 100k patients (large)
 * - 500k patients (xlarge)
 * - 1M patients (xxlarge)
 *
 * Results saved to research/data/raw/results/large-scale-validation/
 *
 * USAGE (from modules/manski-bounds):
 *   # Run all scales
 *   npm run data:validate
 *
 *   # Run specific scales only
 *   npm run data:validate -- small medium large
 */

import * as fs from 'fs';
import * as path from 'path';
import { computeATEBounds } from '../../../../../packages/core/src/causal/partial-id';
import type { CausalDataPoint, ATEBounds } from '../../../../../packages/core/src/causal/partial-id';

interface ScaleTest {
  size: string;
  nPatients: number;
  dataPath: string;
}

interface ValidationResult {
  size: string;
  nPatients: number;
  processingTime: number; // milliseconds
  memoryUsed: number; // MB
  bounds: {
    worstCase: ATEBounds;
    mtr: ATEBounds;
    mts: ATEBounds;
    mtrMts: ATEBounds;
  };
  timestamp: string;
}

const ALL_SCALE_TESTS: ScaleTest[] = [
  {
    size: 'small',
    nPatients: 1000,
    dataPath: '../../../../data/raw/splits/1k/site1.json',
  },
  {
    size: 'medium',
    nPatients: 10000,
    dataPath: '../../../../data/raw/splits/10k/site1.json',
  },
  {
    size: 'large',
    nPatients: 100000,
    dataPath: '../../../../data/raw/splits/100k/site1.json',
  },
  {
    size: 'xlarge',
    nPatients: 500000,
    dataPath: '../../../../data/raw/splits/500k/site1.json',
  },
  {
    size: 'xxlarge',
    nPatients: 2800000,
    dataPath: '../../../../data/raw/splits/2.8m/site1.json',
  },
];

function loadCausalData(dataPath: string): CausalDataPoint[] {
  const fullPath = path.join(__dirname, dataPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Data file not found: ${fullPath}\nPlease run data:split commands first to generate split data`
    );
  }

  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  // Handle both formats: array of patients or site object with patients array
  const patients = Array.isArray(raw) ? raw : raw.patients || [];

  return patients.map((d: any) => ({
    treatment: d.treatment as 0 | 1,
    outcome: d.outcome,
  }));
}

function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

function formatMemory(mb: number): string {
  if (mb < 1024) return `${mb}MB`;
  return `${(mb / 1024).toFixed(2)}GB`;
}

async function runScaleTest(test: ScaleTest): Promise<ValidationResult> {
  console.log(
    `\n📊 Running scale test: ${test.size} (${test.nPatients.toLocaleString()} patients)`
  );
  console.log(`   Loading data from: ${test.dataPath}`);

  const startMemory = getMemoryUsageMB();
  const startTime = Date.now();

  // Load data
  const loadStart = Date.now();
  const data = loadCausalData(test.dataPath);
  const loadTime = Date.now() - loadStart;
  console.log(`   ✅ Loaded ${data.length.toLocaleString()} patients in ${formatTime(loadTime)}`);

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Compute bounds for all assumption levels
  console.log(`   🔢 Computing Manski bounds...`);
  const boundsStart = Date.now();

  const worstCase = computeATEBounds(data, { assumption: 'worst-case' });
  console.log(`      ✓ Worst-case computed`);

  const mtr = computeATEBounds(data, { assumption: 'mtr' });
  console.log(`      ✓ MTR computed`);

  const mts = computeATEBounds(data, { assumption: 'mts' });
  console.log(`      ✓ MTS computed`);

  const mtrMts = computeATEBounds(data, { assumption: 'mtr-mts' });
  console.log(`      ✓ MTR+MTS computed`);

  const boundsTime = Date.now() - boundsStart;
  const totalTime = Date.now() - startTime;
  const endMemory = getMemoryUsageMB();
  const memoryUsed = endMemory - startMemory;

  console.log(`   ⏱️  Bounds computation: ${formatTime(boundsTime)}`);
  console.log(`   ⏱️  Total time: ${formatTime(totalTime)}`);
  console.log(`   💾 Memory used: ${formatMemory(memoryUsed)}`);
  console.log(
    `   📏 Worst-case bounds: [${worstCase.lower.toFixed(3)}, ${worstCase.upper.toFixed(3)}]`
  );
  console.log(`   📏 MTR bounds: [${mtr.lower.toFixed(3)}, ${mtr.upper.toFixed(3)}]`);
  console.log(`   📏 MTR bound width: ${mtr.width.toFixed(3)}`);

  return {
    size: test.size,
    nPatients: test.nPatients,
    processingTime: totalTime,
    memoryUsed,
    bounds: {
      worstCase,
      mtr,
      mts,
      mtrMts,
    },
    timestamp: new Date().toISOString(),
  };
}

function printSummaryTable(results: ValidationResult[]) {
  console.log(`\n📊 Summary Table (for manuscript):\n`);
  console.log(
    '| Scale | N Patients | Processing Time | Memory Used | Worst-Case Width | MTR Width |'
  );
  console.log(
    '|-------|------------|-----------------|-------------|------------------|-----------|'
  );

  for (const result of results) {
    console.log(
      `| ${result.size} | ${result.nPatients.toLocaleString()} | ` +
        `${formatTime(result.processingTime)} | ${formatMemory(result.memoryUsed)} | ` +
        `${result.bounds.worstCase.width.toFixed(3)} | ` +
        `${result.bounds.mtr.width.toFixed(3)} |`
    );
  }
}

function printScalingAnalysis(results: ValidationResult[]) {
  if (results.length < 2) return;

  console.log(`\n📈 Scaling Analysis:\n`);

  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];

    const sizeRatio = curr.nPatients / prev.nPatients;
    const timeRatio = curr.processingTime / prev.processingTime;
    const memoryRatio = Math.abs(curr.memoryUsed) / Math.max(Math.abs(prev.memoryUsed), 1);

    const complexity =
      timeRatio < sizeRatio ? 'sublinear' : timeRatio > sizeRatio * 1.1 ? 'superlinear' : 'linear';

    console.log(`${prev.size} → ${curr.size} (${sizeRatio}x patients):`);
    console.log(`  Time scaling: ${timeRatio.toFixed(2)}x (${complexity})`);
    console.log(`  Memory scaling: ${memoryRatio.toFixed(2)}x`);
    console.log(
      `  Time per patient: ${((curr.processingTime / curr.nPatients) * 1000).toFixed(2)}μs`
    );
    console.log(
      `  MTR width convergence: ${prev.bounds.mtr.width.toFixed(3)} → ${curr.bounds.mtr.width.toFixed(3)}`
    );
  }

  // Overall analysis
  if (results.length >= 3) {
    const first = results[0];
    const last = results[results.length - 1];
    const overallSizeRatio = last.nPatients / first.nPatients;
    const overallTimeRatio = last.processingTime / first.processingTime;

    console.log(`\n📊 Overall Scaling (${first.size} → ${last.size}):`);
    console.log(`  Size increase: ${overallSizeRatio}x`);
    console.log(`  Time increase: ${overallTimeRatio.toFixed(2)}x`);
    console.log(
      `  Complexity: O(n^${(Math.log(overallTimeRatio) / Math.log(overallSizeRatio)).toFixed(2)})`
    );
  }
}

async function main() {
  console.log('🚀 Starting Large-Scale Validation for Manuscript v5.4');
  console.log('   Testing Synthea diabetes data at multiple scales');

  // Parse command line arguments for specific scales
  const args = process.argv.slice(2);
  let testsToRun = ALL_SCALE_TESTS;

  if (args.length > 0) {
    const requestedSizes = new Set(args);
    testsToRun = ALL_SCALE_TESTS.filter((t) => requestedSizes.has(t.size));
    console.log(`   Running selected scales: ${testsToRun.map((t) => t.size).join(', ')}`);
  } else {
    console.log(`   Running all scales: ${testsToRun.map((t) => t.size).join(', ')}`);
  }

  console.log(`\n⚠️  Note: Large scales (500k, 1M) require significant memory and time.`);
  console.log(`   Consider running with --expose-gc flag: node --expose-gc ...`);

  const results: ValidationResult[] = [];

  // Run all scale tests
  for (const test of testsToRun) {
    try {
      const result = await runScaleTest(test);
      results.push(result);

      // Force garbage collection between tests if available
      if (global.gc) {
        console.log(`   🗑️  Running garbage collection...`);
        global.gc();
      }
    } catch (error) {
      console.error(`❌ Error in ${test.size} test:`, error);
      console.error(`   Skipping this scale and continuing...`);
      // Continue with other tests
    }
  }

  if (results.length === 0) {
    console.error(`\n❌ No tests completed successfully. Please check data availability.`);
    process.exit(1);
  }

  // Save results
  const outputDir = path.join(__dirname, '../../raw/results/large-scale-validation');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'validation-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n✅ Validation complete!`);
  console.log(`   Results saved to: ${outputPath}`);
  console.log(`   Completed ${results.length}/${testsToRun.length} tests`);

  // Print summary
  printSummaryTable(results);
  printScalingAnalysis(results);

  // Print recommendations
  console.log(`\n💡 Recommendations for manuscript:`);
  console.log(`   - Include summary table in Results section`);
  console.log(`   - Emphasize scaling complexity in Discussion`);
  console.log(`   - Highlight memory efficiency for large datasets`);
  console.log(`   - Note convergence of MTR bound width with sample size`);
}

main().catch(console.error);
