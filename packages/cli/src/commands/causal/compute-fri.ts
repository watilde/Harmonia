/**
 * CLI command for computing Federated Robustness Index (FRI)
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { 
  computeFRI, 
  compareFRIStrategies,
  assessHeterogeneity,
  type SiteEvalue,
  type WeightingStrategy
} from '@harmonia/core';

export const computeFRICommand = new Command('compute-fri')
  .description('Compute Federated Robustness Index from multi-site E-values')
  .requiredOption('--sites-file <path>', 'Path to site E-values JSON file')
  .option('--strategy <type>', 'Weighting strategy (sample-size|sqrt|log|equal)', 'sample-size')
  .option('--compare-strategies', 'Compare all weighting strategies', false)
  .option('--output <path>', 'Output file path (JSON)')
  .option('--format <type>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      // Read site E-values
      const sitesData = JSON.parse(readFileSync(options.sitesFile, 'utf-8'));
      const siteEvalues: SiteEvalue[] = sitesData.sites || sitesData;
      
      if (!Array.isArray(siteEvalues) || siteEvalues.length === 0) {
        console.error('Error: sites-file must contain an array of site E-values');
        process.exit(1);
      }
      
      if (options.compareStrategies) {
        // Compare all strategies
        const comparison = compareFRIStrategies(siteEvalues);
        
        if (options.format === 'table') {
          console.log('\n┌──────────────────────────────────────────────────────────────────┐');
          console.log('│  Federated Robustness Index (FRI) - Strategy Comparison         │');
          console.log('└──────────────────────────────────────────────────────────────────┘\n');
          
          console.log('Strategy         Min E    Med E    Avg E    Std E    Robustness');
          console.log('─'.repeat(70));
          
          const strategies: WeightingStrategy[] = ['sample-size', 'sqrt', 'log', 'equal'];
          
          for (const strategy of strategies) {
            const fri = comparison[strategy];
            const line = [
              strategy.padEnd(15),
              fri.min_evalue.toFixed(2).padStart(7),
              fri.median_evalue.toFixed(2).padStart(7),
              fri.weighted_avg_evalue.toFixed(2).padStart(7),
              fri.std_evalue.toFixed(2).padStart(7),
              fri.overall_robustness.padEnd(10)
            ].join('  ');
            console.log(line);
          }
          console.log();
        } else {
          console.log(JSON.stringify(comparison, null, 2));
        }
        
        if (options.output) {
          writeFileSync(options.output, JSON.stringify(comparison, null, 2));
          console.log(`✓ Strategy comparison saved to: ${options.output}`);
        }
        
      } else {
        // Compute single FRI
        const strategy = options.strategy as WeightingStrategy;
        const fri = computeFRI(siteEvalues, strategy);
        const het = assessHeterogeneity(siteEvalues);
        
        if (options.format === 'table') {
          console.log('\n┌──────────────────────────────────────────────────────────────────┐');
          console.log('│  Federated Robustness Index (FRI)                                │');
          console.log('└──────────────────────────────────────────────────────────────────┘\n');
          
          console.log(`Weighting Strategy: ${fri.weighting_strategy}`);
          console.log(`Total Sample Size:  ${fri.total_sample_size}`);
          console.log(`Number of Sites:    ${fri.site_evalues.length}`);
          console.log();
          
          console.log('Core Metrics:');
          console.log(`  Minimum E-value (worst-case):    ${fri.min_evalue.toFixed(2)}`);
          console.log(`  Median E-value (typical):        ${fri.median_evalue.toFixed(2)}`);
          console.log(`  Weighted Average E-value:        ${fri.weighted_avg_evalue.toFixed(2)}`);
          console.log(`  Standard Deviation (heterog):    ${fri.std_evalue.toFixed(2)}`);
          console.log();
          
          console.log('Site Details:');
          console.log(`  Worst robustness:  ${fri.worst_site} (E-value: ${fri.min_evalue.toFixed(2)})`);
          console.log(`  Best robustness:   ${fri.best_site} (E-value: ${Math.max(...fri.site_evalues.map((s: SiteEvalue) => s.evalue)).toFixed(2)})`);
          console.log();
          
          console.log('Overall Assessment:');
          console.log(`  Robustness Level: ${fri.overall_robustness.toUpperCase()}`);
          console.log(`  Interpretation:   ${fri.interpretation}`);
          console.log();
          
          console.log('Heterogeneity Assessment:');
          console.log(`  Coefficient of variation: ${het.coefficient_of_variation.toFixed(3)}`);
          console.log(`  Range:                    ${het.range.toFixed(2)}`);
          console.log(`  IQR:                      ${het.iqr.toFixed(2)}`);
          console.log(`  ${het.interpretation}`);
          console.log();
          
          console.log('Site-Specific E-values:');
          for (const site of fri.site_evalues) {
            console.log(`  ${site.site_id.padEnd(15)} E-value: ${site.evalue.toFixed(2)}  (n=${site.sample_size})`);
          }
          console.log();
        } else {
          console.log(JSON.stringify({ fri, heterogeneity: het }, null, 2));
        }
        
        if (options.output) {
          writeFileSync(options.output, JSON.stringify({ fri, heterogeneity: het }, null, 2));
          console.log(`✓ FRI saved to: ${options.output}`);
        }
      }
      
    } catch (error) {
      console.error('Error computing FRI:', error);
      process.exit(1);
    }
  });
