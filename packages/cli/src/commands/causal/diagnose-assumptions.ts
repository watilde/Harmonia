/**
 * CLI command for diagnosing causal assumption violations
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { 
  assessAssumptions,
  getViolationDetails,
  type Patient
} from '@harmonia/core';

export const diagnoseAssumptionsCommand = new Command('diagnose-assumptions')
  .description('Diagnose violations of causal inference assumptions')
  .requiredOption('--data-file <path>', 'Path to patient data JSON file')
  .option('--output <path>', 'Output file path (JSON)')
  .option('--format <type>', 'Output format (json|table)', 'table')
  .option('--detailed', 'Show detailed violation information', false)
  .action(async (options) => {
    try {
      // Read patient data
      const patientsData = JSON.parse(readFileSync(options.dataFile, 'utf-8'));
      const patients: Patient[] = patientsData.patients || patientsData;
      
      if (!Array.isArray(patients) || patients.length === 0) {
        console.error('Error: data-file must contain an array of patient records');
        process.exit(1);
      }
      
      // Assess assumptions
      const scores = assessAssumptions(patients);
      
      if (options.format === 'table') {
        console.log('\n┌──────────────────────────────────────────────────────────────────┐');
        console.log('│  Causal Assumptions Diagnostic Report                           │');
        console.log('└──────────────────────────────────────────────────────────────────┘\n');
        
        console.log(`Total Patients: ${patients.length}\n`);
        
        console.log('Assumption Scores (0.0 = severe violation, 1.0 = perfect):');
        console.log('─'.repeat(70));
        console.log(`  Unconfoundedness (Ignorability):    ${scores.unconfoundedness_score.toFixed(3)} ${getScoreBar(scores.unconfoundedness_score)}`);
        console.log(`  Positivity (Overlap):                ${scores.positivity_score.toFixed(3)} ${getScoreBar(scores.positivity_score)}`);
        console.log(`  Specification (Model Fit):           ${scores.specification_score.toFixed(3)} ${getScoreBar(scores.specification_score)}`);
        console.log('─'.repeat(70));
        console.log(`  Overall Score:                       ${scores.overall_score.toFixed(3)} ${getScoreBar(scores.overall_score)}\n`);
        
        // Interpretation
        console.log('Interpretation:');
        if (scores.overall_score >= 0.8) {
          console.log('  ✓ All assumptions appear to be reasonably satisfied.');
          console.log('  → Point estimates are likely reliable.\n');
        } else if (scores.overall_score >= 0.6) {
          console.log('  ⚠ Some moderate violations detected.');
          console.log('  → Consider using bounds or sensitivity analysis.\n');
        } else {
          console.log('  ✗ Severe violations detected.');
          console.log('  → Use partial identification bounds or robust methods.\n');
        }
        
        // Detailed violations
        if (options.detailed) {
          const violations = getViolationDetails(patients);
          
          console.log('Detailed Violation Analysis:');
          console.log('─'.repeat(70));
          
          for (const violation of violations) {
            console.log(`\n${violation.assumption.toUpperCase()}:`);
            console.log(`  Score: ${violation.score.toFixed(3)}`);
            console.log(`  Severity: ${violation.severity}`);
            console.log(`  Description: ${violation.description}`);
            console.log(`  Recommendation: ${violation.recommendation}`);
          }
          console.log();
        }
        
      } else {
        const output = options.detailed 
          ? { scores, violations: getViolationDetails(patients) }
          : { scores };
        console.log(JSON.stringify(output, null, 2));
      }
      
      if (options.output) {
        const output = options.detailed 
          ? { scores, violations: getViolationDetails(patients) }
          : { scores };
        writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`\n✓ Diagnostics saved to: ${options.output}`);
      }
      
    } catch (error) {
      console.error('Error diagnosing assumptions:', error);
      process.exit(1);
    }
  });

/**
 * Generate visual score bar
 */
function getScoreBar(score: number): string {
  const barLength = 20;
  const filled = Math.round(score * barLength);
  const empty = barLength - filled;
  
  let bar = '[';
  bar += '█'.repeat(filled);
  bar += '░'.repeat(empty);
  bar += ']';
  
  // Color indicator
  if (score >= 0.8) {
    bar += ' ✓';
  } else if (score >= 0.6) {
    bar += ' ⚠';
  } else {
    bar += ' ✗';
  }
  
  return bar;
}
