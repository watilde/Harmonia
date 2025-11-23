/**
 * CLI command for computing E-values for sensitivity analysis
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { computeEvalueFromATE, computeEvaluesForBounds, findTippingPoint, type ATEBounds } from '@harmonia/core';

export const computeEvalueCommand = new Command('compute-evalue')
  .description('Compute E-value for sensitivity analysis')
  .option('--ate <value>', 'Average treatment effect', parseFloat)
  .option('--baseline-risk <value>', 'Baseline outcome risk (0-1)', parseFloat)
  .option('--bounds-file <path>', 'Path to bounds JSON file (for bounds E-values)')
  .option('--output <path>', 'Output file path (JSON)')
  .option('--format <type>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      if (options.boundsFile) {
        // Compute E-values for bounds
        const boundsData = JSON.parse(readFileSync(options.boundsFile, 'utf-8'));
        const bounds: ATEBounds = boundsData;
        
        const evalues = computeEvaluesForBounds(bounds.lower, bounds.upper, options.baselineRisk);
        
        if (options.format === 'table') {
          console.log('\n┌─────────────────────────────────────────────────────────┐');
          console.log('│  E-values for Bounds Sensitivity Analysis              │');
          console.log('└─────────────────────────────────────────────────────────┘\n');
          
          console.log(`Bounds: [${bounds.lower.toFixed(4)}, ${bounds.upper.toFixed(4)}]`);
          console.log(`Width:  ${bounds.width.toFixed(4)}`);
          console.log(`Bounds Include Null: ${evalues.bounds_include_null ? 'Yes' : 'No'}`);
          console.log(`\nE-value (Conservative): ${evalues.conservative.evalue.toFixed(2)}`);
          console.log(`E-value (Optimistic):   ${evalues.optimistic.evalue.toFixed(2)}`);
          console.log(`\nConservative Interpretation:`);
          console.log(`  ${evalues.conservative.interpretation}`);
          console.log(`\nOptimistic Interpretation:`);
          console.log(`  ${evalues.optimistic.interpretation}`);
          console.log();
        } else {
          console.log(JSON.stringify(evalues, null, 2));
        }
        
        if (options.output) {
          writeFileSync(options.output, JSON.stringify(evalues, null, 2));
          console.log(`\n✓ E-values saved to: ${options.output}`);
        }
        
      } else if (options.ate !== undefined) {
        // Compute E-value from ATE
        const result = computeEvalueFromATE(options.ate, options.baselineRisk);
        const tippingPoint = findTippingPoint(options.ate, options.baselineRisk);
        
        if (options.format === 'table') {
          console.log('\n┌─────────────────────────────────────────────────────────┐');
          console.log('│  E-value Sensitivity Analysis                           │');
          console.log('└─────────────────────────────────────────────────────────┘\n');
          
          console.log(`Average Treatment Effect (ATE): ${options.ate.toFixed(4)}`);
          if (options.baselineRisk) {
            console.log(`Baseline Risk:                  ${options.baselineRisk.toFixed(4)}`);
          }
          console.log(`\nE-value:               ${result.evalue.toFixed(2)}`);
          console.log(`Robustness Level:      ${result.robustness_level}`);
          console.log(`Tipping Point:         ${tippingPoint.toFixed(2)}`);
          console.log(`\nInterpretation:`);
          console.log(`  ${result.interpretation}`);
          console.log();
        } else {
          const output = { ...result, tipping_point: tippingPoint };
          console.log(JSON.stringify(output, null, 2));
        }
        
        if (options.output) {
          const output = { ...result, tipping_point: tippingPoint };
          writeFileSync(options.output, JSON.stringify(output, null, 2));
          console.log(`\n✓ E-value saved to: ${options.output}`);
        }
        
      } else {
        console.error('Error: Must provide either --ate or --bounds-file');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Error computing E-value:', error);
      process.exit(1);
    }
  });
