/**
 * Generate synthetic OMOP CDM data for causal inference
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateOMOPSyntheticData,
  extractCausalDataFromOMOP,
  type OMOPSyntheticConfig,
  type OMOPExtractionConfig,
} from '@harmonia/core';

interface GenerateOMOPDataOptions {
  output: string;
  scenario: 'diabetes' | 'icu' | 'screening';
  n: string;
  trueAte?: string;
  confounding?: string;
  treatmentRate?: string;
  seed: string;
  indexDate: string;
  extractCausal: boolean;
  verbose: boolean;
}

export const generateOMOPDataCommand = new Command('generate-omop-data')
  .description('Generate synthetic OMOP CDM data for causal inference')
  .requiredOption('-o, --output <path>', 'Output directory for OMOP tables')
  .requiredOption('--scenario <type>', 'Clinical scenario: diabetes, icu, or screening')
  .option('-n <number>', 'Number of patients (default: 1000)', '1000')
  .option('--true-ate <value>', 'True average treatment effect (default: varies by scenario)')
  .option('--confounding <value>', 'Confounding strength 0-1 (default: varies by scenario)')
  .option('--treatment-rate <value>', 'Base treatment rate 0-1 (default: varies by scenario)')
  .option('--seed <number>', 'Random seed (default: 42)', '42')
  .option('--index-date <date>', 'Index date YYYY-MM-DD (default: 2024-01-01)', '2024-01-01')
  .option('--extract-causal', 'Also extract causal inference data (default: false)', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options: GenerateOMOPDataOptions) => {
    try {
      console.log('🏥 Generating OMOP CDM synthetic data...\n');

      // Parse options
      const n = Number(options.n);
      const seed = Number(options.seed);
      const scenario = options.scenario;

      // Default values by scenario
      let trueATE: number;
      let confounding: number;
      let treatmentRate: number;

      switch (scenario) {
        case 'diabetes':
          trueATE = 0.15;
          confounding = 0.3;
          treatmentRate = 0.5;
          break;
        case 'icu':
          trueATE = -0.1;
          confounding = 0.4;
          treatmentRate = 0.4;
          break;
        case 'screening':
          trueATE = 0.2;
          confounding = 0.25;
          treatmentRate = 0.35;
          break;
        default:
          throw new Error(`Unknown scenario: ${scenario}`);
      }

      // Override with command-line options
      if (options.trueAte) trueATE = Number(options.trueAte);
      if (options.confounding) confounding = Number(options.confounding);
      if (options.treatmentRate) treatmentRate = Number(options.treatmentRate);

      const config: OMOPSyntheticConfig = {
        numPatients: n,
        scenario,
        trueATE,
        confounding,
        treatmentRate,
        seed,
        indexDate: options.indexDate,
      };

      if (options.verbose) {
        console.log('Configuration:');
        console.log(`  Scenario:        ${scenario}`);
        console.log(`  Patients:        ${n}`);
        console.log(`  True ATE:        ${trueATE}`);
        console.log(`  Confounding:     ${confounding}`);
        console.log(`  Treatment rate:  ${treatmentRate}`);
        console.log(`  Seed:            ${seed}`);
        console.log(`  Index date:      ${options.indexDate}`);
        console.log('');
      }

      // Generate OMOP data
      console.log('📊 Generating OMOP tables...');
      const dataset = generateOMOPSyntheticData(config);

      // Create output directory
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      // Save OMOP tables as JSON files
      const tables = [
        { name: 'person', data: dataset.persons },
        { name: 'condition_occurrence', data: dataset.conditions },
        { name: 'drug_exposure', data: dataset.drugs },
        { name: 'measurement', data: dataset.measurements },
        { name: 'procedure_occurrence', data: dataset.procedures },
        { name: 'visit_occurrence', data: dataset.visits },
      ];

      let savedCount = 0;
      for (const table of tables) {
        if (table.data.length > 0) {
          const tablePath = path.join(options.output, `${table.name}.json`);
          fs.writeFileSync(tablePath, JSON.stringify(table.data, null, 2), 'utf-8');
          savedCount++;

          if (options.verbose) {
            console.log(`  ✓ ${table.name}: ${table.data.length} rows`);
          }
        }
      }

      console.log(`\n✅ Saved ${savedCount} OMOP tables to: ${options.output}`);

      // Extract causal inference data if requested
      if (options.extractCausal) {
        console.log('\n🔬 Extracting causal inference data...');

        const extractConfig: OMOPExtractionConfig = {
          scenario,
          indexDate: options.indexDate || '2024-01-01',
          followUpDays: 180, // 6 months
        };

        const cohort = extractCausalDataFromOMOP(dataset, extractConfig);

        console.log('\n📈 Cohort Summary:');
        console.log(`  Total patients:  ${cohort.cohortSize}`);
        console.log(
          `  Treated:         ${cohort.numTreated} (${((cohort.numTreated / cohort.cohortSize) * 100).toFixed(1)}%)`
        );
        console.log(
          `  Control:         ${cohort.numControl} (${((cohort.numControl / cohort.cohortSize) * 100).toFixed(1)}%)`
        );
        console.log('');
        console.log('Treatment:');
        console.log(`  ${cohort.metadata.treatmentDefinition}`);
        console.log('Outcome:');
        console.log(`  ${cohort.metadata.outcomeDefinition}`);

        // Save causal data
        const causalPath = path.join(options.output, 'causal-data.json');
        fs.writeFileSync(causalPath, JSON.stringify(cohort.data, null, 2), 'utf-8');

        console.log(`\n💾 Saved causal inference data to: ${causalPath}`);
      }

      console.log('\n✅ OMOP data generation complete!');
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });
