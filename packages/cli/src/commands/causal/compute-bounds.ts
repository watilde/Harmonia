/**
 * Compute partial identification bounds for causal inference
 *
 * This command computes ATE bounds from observational data using
 * Manski's partial identification framework.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  computeATEBounds,
  formatBounds,
  checkCoverage,
  type CausalDataPoint,
  type ATEBounds,
} from '@harmonia/core';

interface ComputeBoundsOptions {
  data: string;
  output?: string;
  assumption?: 'worst-case' | 'mtr' | 'mts' | 'mtr-mts';
  yMin?: string;
  yMax?: string;
  siteId?: string;
  trueAte?: string;
  verbose?: boolean;
}

interface BoundsWithSite extends ATEBounds {
  siteId?: string;
}

/**
 * Load data from JSON or CSV file
 */
function loadData(dataPath: string): CausalDataPoint[] {
  const ext = path.extname(dataPath).toLowerCase();
  const content = fs.readFileSync(dataPath, 'utf-8');

  if (ext === '.json') {
    return JSON.parse(content);
  } else if (ext === '.csv') {
    // Simple CSV parser for treatment,outcome,weight format
    const lines = content.trim().split('\n');
    const header = lines[0].toLowerCase().split(',');
    const treatmentIdx = header.indexOf('treatment');
    const outcomeIdx = header.indexOf('outcome');
    const weightIdx = header.indexOf('weight');

    if (treatmentIdx === -1 || outcomeIdx === -1) {
      throw new Error('CSV must have "treatment" and "outcome" columns');
    }

    return lines.slice(1).map((line) => {
      const values = line.split(',');
      const point: CausalDataPoint = {
        treatment: parseInt(values[treatmentIdx]) as 0 | 1,
        outcome: parseFloat(values[outcomeIdx]),
      };

      if (weightIdx !== -1) {
        point.weight = parseFloat(values[weightIdx]);
      }

      return point;
    });
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

/**
 * Save bounds to JSON file
 */
function saveBounds(bounds: BoundsWithSite, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(bounds, null, 2), 'utf-8');
}

export const computeBoundsCommand = new Command('compute-bounds')
  .description('Compute partial identification bounds on ATE')
  .requiredOption(
    '-d, --data <path>',
    'Path to data file (JSON or CSV with treatment, outcome columns)'
  )
  .option('-o, --output <path>', 'Output path for bounds (default: bounds.json)')
  .option(
    '-a, --assumption <type>',
    'Assumption level: worst-case, mtr, mts, mtr-mts (default: worst-case)',
    'worst-case'
  )
  .option('--y-min <value>', 'Minimum outcome value (default: 0)', parseFloat)
  .option('--y-max <value>', 'Maximum outcome value (default: 1)', parseFloat)
  .option('-s, --site-id <id>', 'Site identifier (for federated aggregation)')
  .option('--true-ate <value>', 'True ATE value (for validation/simulation)', parseFloat)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options: ComputeBoundsOptions) => {
    try {
      console.log('🔬 Computing partial identification bounds...\n');

      // Load data
      if (options.verbose) {
        console.log(`📂 Loading data from: ${options.data}`);
      }
      const data = loadData(options.data);
      console.log(
        `✅ Loaded ${data.length} observations (${data.filter((d) => d.treatment === 1).length} treated, ${data.filter((d) => d.treatment === 0).length} control)\n`
      );

      // Compute bounds
      const bounds = computeATEBounds(data, {
        assumption: options.assumption,
        yMin: options.yMin !== undefined ? Number(options.yMin) : undefined,
        yMax: options.yMax !== undefined ? Number(options.yMax) : undefined,
      });

      // Display results
      console.log('📊 Results:');
      console.log('─'.repeat(60));
      console.log(formatBounds(bounds));
      console.log('─'.repeat(60));
      console.log(`Lower bound: ${bounds.lower.toFixed(4)}`);
      console.log(`Upper bound: ${bounds.upper.toFixed(4)}`);
      console.log(`Width:       ${bounds.width.toFixed(4)}`);
      console.log(`Sample size: ${bounds.sampleSize}`);
      console.log(`Assumption:  ${bounds.assumption}`);

      // Check coverage if true ATE provided
      if (options.trueAte !== undefined) {
        const trueAteValue = Number(options.trueAte);
        const covered = checkCoverage(bounds, trueAteValue);
        console.log(
          `\n${covered ? '✅' : '❌'} Coverage: True ATE (${trueAteValue.toFixed(4)}) is ${covered ? 'inside' : 'outside'} bounds`
        );
      }

      // Save results
      const outputPath = options.output || 'bounds.json';
      const boundsWithSite: BoundsWithSite = {
        ...bounds,
        ...(options.siteId && { siteId: options.siteId }),
      };
      saveBounds(boundsWithSite, outputPath);
      console.log(`\n💾 Saved bounds to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });
