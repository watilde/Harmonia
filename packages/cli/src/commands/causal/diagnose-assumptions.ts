/**
 * CLI command for diagnosing causal assumption violations
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import {
  assessAssumptions,
  getViolationDetails,
  assessAssumptionsAdaptive,
  getViolationDetailsAdaptive,
  type Patient,
  type ProgressCallback,
} from '@harmonia/core';

export const diagnoseAssumptionsCommand = new Command('diagnose-assumptions')
  .description('Diagnose violations of causal inference assumptions')
  .requiredOption('--data-file <path>', 'Path to patient data JSON file')
  .option('--output <path>', 'Output file path (JSON)')
  .option('--format <type>', 'Output format (json|table)', 'table')
  .option('--detailed', 'Show detailed violation information', false)
  .option('--use-gpu', 'Enable GPU acceleration (adaptive by default)', false)
  .option('--force-cpu', 'Force CPU computation (disable GPU)', false)
  .option(
    '--gpu-threshold <number>',
    'Minimum patients for GPU (default: 10000)',
    (val) => parseInt(val),
    10000
  )
  .action(async (options) => {
    try {
      // Read patient data
      const patientsData = JSON.parse(readFileSync(options.dataFile, 'utf-8'));
      const patients: Patient[] = patientsData.patients || patientsData;

      if (!Array.isArray(patients) || patients.length === 0) {
        console.error('Error: data-file must contain an array of patient records');
        process.exit(1);
      }

      console.log(`\n📊 Processing ${patients.length.toLocaleString()} patients...\n`);

      // Create progress callback
      const progressCallback: ProgressCallback = {
        onProgress: (stage: string, current: number, total: number, message?: string) => {
          const percentage = Math.round((current / total) * 100);
          const bar =
            '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
          const stageLabel = stage.padEnd(22);
          process.stdout.write(`\r⏳ [${bar}] ${percentage}% | ${stageLabel} | ${message || ''}`);
          if (current === total) {
            console.log(); // New line after completion
          }
        },
      };

      // Assess assumptions with adaptive backend selection
      let scores: any;

      if (options.useGpu || (!options.forceCpu && patients.length >= options.gpuThreshold)) {
        // Use adaptive diagnostics (GPU if available and beneficial)
        scores = await assessAssumptionsAdaptive(patients, {
          forceGPU: options.useGpu,
          forceCPU: options.forceCpu,
          gpuThreshold: options.gpuThreshold,
          progressCallback,
        });

        if (scores.backend) {
          console.log(
            `\n  ℹ️  Backend: ${scores.backend.toUpperCase()}${scores.backendInfo ? ` (TensorFlow ${scores.backendInfo.tensorflowVersion})` : ''}\n`
          );
        }
      } else {
        // Use standard CPU diagnostics
        scores = assessAssumptions(patients, progressCallback);
        console.log('\n  ℹ️  Backend: CPU\n');
      }

      console.log(); // Extra newline after all progress

      if (options.format === 'table') {
        console.log('\n┌──────────────────────────────────────────────────────────────────┐');
        console.log('│  Causal Assumptions Diagnostic Report                           │');
        console.log('└──────────────────────────────────────────────────────────────────┘\n');

        console.log(`Total Patients: ${patients.length}\n`);

        console.log('Assumption Scores (0.0 = severe violation, 1.0 = perfect):');
        console.log('─'.repeat(70));
        console.log(
          `  Unconfoundedness (Ignorability):    ${scores.unconfoundedness_score.toFixed(3)} ${getScoreBar(scores.unconfoundedness_score)}`
        );
        console.log(
          `  Positivity (Overlap):                ${scores.positivity_score.toFixed(3)} ${getScoreBar(scores.positivity_score)}`
        );
        console.log(
          `  Specification (Model Fit):           ${scores.specification_score.toFixed(3)} ${getScoreBar(scores.specification_score)}`
        );
        console.log('─'.repeat(70));
        console.log(
          `  Overall Score:                       ${scores.overall_score.toFixed(3)} ${getScoreBar(scores.overall_score)}\n`
        );

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
          console.log('\n📋 Generating detailed violation analysis...\n');
          const violations =
            options.useGpu || (!options.forceCpu && patients.length >= options.gpuThreshold)
              ? await getViolationDetailsAdaptive(patients, {
                  forceGPU: options.useGpu,
                  forceCPU: options.forceCpu,
                  gpuThreshold: options.gpuThreshold,
                  progressCallback,
                })
              : getViolationDetails(patients, progressCallback);

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
        const violations = options.detailed
          ? options.useGpu || (!options.forceCpu && patients.length >= options.gpuThreshold)
            ? await getViolationDetailsAdaptive(patients, {
                forceGPU: options.useGpu,
                forceCPU: options.forceCpu,
                gpuThreshold: options.gpuThreshold,
                progressCallback,
              })
            : getViolationDetails(patients, progressCallback)
          : undefined;
        const output = options.detailed ? { scores, violations } : { scores };
        console.log(JSON.stringify(output, null, 2));
      }

      if (options.output) {
        const violations = options.detailed
          ? options.useGpu || (!options.forceCpu && patients.length >= options.gpuThreshold)
            ? await getViolationDetailsAdaptive(patients, {
                forceGPU: options.useGpu,
                forceCPU: options.forceCpu,
                gpuThreshold: options.gpuThreshold,
                progressCallback,
              })
            : getViolationDetails(patients, progressCallback)
          : undefined;
        const output = options.detailed ? { scores, violations } : { scores };
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
