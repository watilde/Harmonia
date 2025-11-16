/**
 * Generate synthetic causal inference data
 *
 * Creates synthetic observational data with known treatment effects
 * for validation and demonstration purposes.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { CausalDataPoint } from '@harmonia/core';

interface GenerateDataOptions {
  output: string;
  n?: string;
  trueAte?: string;
  confounding?: string;
  treatmentRate?: string;
  seed?: string;
  verbose?: boolean;
}

/**
 * Simple seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  normal(mean = 0, std = 1): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * std + mean;
  }
}

/**
 * Generate synthetic data with confounding
 */
function generateSyntheticData(
  n: number,
  trueATE: number,
  confounding: number,
  treatmentRate: number,
  seed: number
): CausalDataPoint[] {
  const rng = new SeededRandom(seed);
  const data: CausalDataPoint[] = [];

  for (let i = 0; i < n; i++) {
    // Generate confounder (e.g., health status)
    const confounder = rng.normal(0, 1);

    // Treatment assignment influenced by confounder
    const treatmentPropensity =
      treatmentRate + confounding * (1 / (1 + Math.exp(-confounder)) - 0.5);
    const treatment = rng.next() < treatmentPropensity ? 1 : 0;

    // Outcome influenced by both treatment and confounder
    let outcome = 0.5; // Baseline
    outcome += treatment * trueATE; // Treatment effect
    outcome += confounding * (1 / (1 + Math.exp(-confounder)) - 0.5); // Confounding effect
    outcome += rng.normal(0, 0.1); // Noise

    // Clip to [0, 1]
    outcome = Math.max(0, Math.min(1, outcome));

    data.push({
      treatment: treatment as 0 | 1,
      outcome,
    });
  }

  return data;
}

/**
 * Save data to JSON or CSV
 */
function saveData(data: CausalDataPoint[], outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = path.extname(outputPath).toLowerCase();

  if (ext === '.json') {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  } else if (ext === '.csv') {
    const header = 'treatment,outcome\n';
    const rows = data.map((d) => `${d.treatment},${d.outcome}`).join('\n');
    fs.writeFileSync(outputPath, header + rows, 'utf-8');
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

export const generateDataCommand = new Command('generate-data')
  .description('Generate synthetic causal inference data')
  .requiredOption('-o, --output <path>', 'Output path for data (JSON or CSV)')
  .option('-n <number>', 'Number of observations (default: 1000)', parseInt)
  .option('--true-ate <value>', 'True average treatment effect (default: 0.15)', parseFloat)
  .option('--confounding <value>', 'Confounding strength 0-1 (default: 0.3)', parseFloat)
  .option('--treatment-rate <value>', 'Base treatment rate 0-1 (default: 0.5)', parseFloat)
  .option('--seed <number>', 'Random seed (default: 42)', parseInt)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options: GenerateDataOptions) => {
    try {
      const n = Number(options.n ?? 1000);
      const trueATE = Number(options.trueAte ?? 0.15);
      const confounding = Number(options.confounding ?? 0.3);
      const treatmentRate = Number(options.treatmentRate ?? 0.5);
      const seed = Number(options.seed ?? 42);

      console.log('🧬 Generating synthetic causal data...\n');

      if (options.verbose) {
        console.log('Parameters:');
        console.log(`  Sample size:     ${n}`);
        console.log(`  True ATE:        ${trueATE.toFixed(3)}`);
        console.log(`  Confounding:     ${confounding.toFixed(3)}`);
        console.log(`  Treatment rate:  ${treatmentRate.toFixed(3)}`);
        console.log(`  Seed:            ${seed}`);
        console.log('');
      }

      // Generate data
      const data = generateSyntheticData(n, trueATE, confounding, treatmentRate, seed);

      // Compute statistics
      const treated = data.filter((d) => d.treatment === 1);
      const control = data.filter((d) => d.treatment === 0);
      const treatedMean = treated.reduce((sum, d) => sum + d.outcome, 0) / treated.length;
      const controlMean = control.reduce((sum, d) => sum + d.outcome, 0) / control.length;
      const observedDiff = treatedMean - controlMean;

      console.log('📊 Generated data:');
      console.log(`  Total samples:   ${data.length}`);
      console.log(
        `  Treated:         ${treated.length} (${((treated.length / data.length) * 100).toFixed(1)}%)`
      );
      console.log(
        `  Control:         ${control.length} (${((control.length / data.length) * 100).toFixed(1)}%)`
      );
      console.log(`\n  Treated mean:    ${treatedMean.toFixed(4)}`);
      console.log(`  Control mean:    ${controlMean.toFixed(4)}`);
      console.log(`  Observed diff:   ${observedDiff.toFixed(4)}`);
      console.log(`  True ATE:        ${trueATE.toFixed(4)}`);
      console.log(`  Bias:            ${(observedDiff - trueATE).toFixed(4)} (due to confounding)`);

      // Save data
      saveData(data, options.output);
      console.log(`\n💾 Saved data to: ${options.output}`);

      if (options.verbose) {
        console.log(
          '\n💡 Tip: Use "harmonia causal compute-bounds" to compute bounds on this data'
        );
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });
