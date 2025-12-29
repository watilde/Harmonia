/**
 * CLI command for automatic inference mode selection
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { determineInferenceMode, determineFederatedMode } from '@harmonia/core';

export const selectInferenceModeCommand = new Command('select-inference-mode')
  .description('Automatically select appropriate causal inference mode')
  .option('--data-file <path>', 'Path to assumption scores JSON file (for single-site)')
  .option('--sites-file <path>', 'Path to multi-site assumption scores JSON (for federated)')
  .option('--output <path>', 'Output file path (JSON)')
  .option('--format <type>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      if (options.sitesFile) {
        // Federated mode selection
        const sitesData = JSON.parse(readFileSync(options.sitesFile, 'utf-8'));
        const sitesArray = sitesData.sites || sitesData;

        if (!Array.isArray(sitesArray) || sitesArray.length === 0) {
          console.error('Error: sites-file must contain an array of site assumption scores');
          process.exit(1);
        }

        // Convert array to Map
        const siteScoresMap = new Map();
        for (const site of sitesArray) {
          siteScoresMap.set(site.site_id, site.scores);
        }

        const decision = determineFederatedMode(siteScoresMap);

        if (options.format === 'table') {
          console.log('\n┌──────────────────────────────────────────────────────────────────┐');
          console.log('│  Federated Inference Mode Selection                             │');
          console.log('└──────────────────────────────────────────────────────────────────┘\n');

          console.log(`Number of Sites: ${siteScoresMap.size}`);
          console.log(`\nRecommended Mode: ${decision.overall_mode.toUpperCase()}`);
          console.log(`Safest Mode: ${decision.safest_mode.toUpperCase()}\n`);

          console.log('Mode Distribution:');
          console.log(
            `  Point Estimate: ${(decision.mode_distribution.point_estimate * 100).toFixed(0)}%`
          );
          console.log(`  Bounds:         ${(decision.mode_distribution.bounds * 100).toFixed(0)}%`);
          console.log(
            `  Sensitivity:    ${(decision.mode_distribution.sensitivity * 100).toFixed(0)}%`
          );
          console.log();

          console.log('Site-Specific Recommendations:');
          console.log('─'.repeat(70));
          for (const [site_id, site_decision] of decision.site_modes.entries()) {
            const indicator =
              site_decision.mode === 'point-estimate'
                ? '✓'
                : site_decision.mode === 'bounds'
                  ? '⚠'
                  : '!';
            console.log(
              `  ${indicator} ${site_id.padEnd(15)} → ${site_decision.mode.padEnd(20)} (confidence: ${(site_decision.confidence * 100).toFixed(0)}%)`
            );
          }
          console.log();

          console.log('Recommendation:');
          console.log(`  ${decision.recommendation}`);
          console.log();
        } else {
          // Convert Map to array for JSON serialization
          const output = {
            ...decision,
            site_modes: Array.from(decision.site_modes.entries()).map(
              ([site_id, mode_decision]: [string, any]) => ({
                site_id,
                ...mode_decision,
              })
            ),
          };
          console.log(JSON.stringify(output, null, 2));
        }

        if (options.output) {
          const output = {
            ...decision,
            site_modes: Array.from(decision.site_modes.entries()).map(
              ([site_id, mode_decision]: [string, any]) => ({
                site_id,
                ...mode_decision,
              })
            ),
          };
          writeFileSync(options.output, JSON.stringify(output, null, 2));
          console.log(`✓ Mode selection saved to: ${options.output}`);
        }
      } else if (options.dataFile) {
        // Single-site mode selection
        const data = JSON.parse(readFileSync(options.dataFile, 'utf-8'));

        // Expect data to have assumption scores
        const scores = data.scores || data;

        if (
          !scores.unconfoundedness_score ||
          !scores.positivity_score ||
          !scores.specification_score
        ) {
          console.error(
            'Error: data-file must contain assumption scores (unconfoundedness_score, positivity_score, specification_score, overall_score)'
          );
          console.error(
            'Tip: First run "harmonia causal diagnose-assumptions" to get these scores'
          );
          process.exit(1);
        }

        const decision = determineInferenceMode(scores);

        if (options.format === 'table') {
          console.log('\n┌──────────────────────────────────────────────────────────────────┐');
          console.log('│  Inference Mode Selection                                        │');
          console.log('└──────────────────────────────────────────────────────────────────┘\n');

          console.log(`Recommended Mode: ${decision.mode.toUpperCase()}`);
          console.log(`Confidence: ${(decision.confidence * 100).toFixed(1)}%\n`);

          console.log('Assumption Scores:');
          console.log('─'.repeat(70));
          console.log(`  Unconfoundedness: ${scores.unconfoundedness_score.toFixed(3)}`);
          console.log(`  Positivity:       ${scores.positivity_score.toFixed(3)}`);
          console.log(`  Specification:    ${scores.specification_score.toFixed(3)}`);
          console.log(`  Overall:          ${scores.overall_score.toFixed(3)}\n`);

          console.log('Reason:');
          console.log(`  ${decision.reason}\n`);

          console.log('Assumptions Met:');
          for (const met of decision.assumptions_met) {
            console.log(`  ✓ ${met}`);
          }

          if (decision.assumptions_violated.length > 0) {
            console.log('\nAssumptions Violated:');
            for (const violated of decision.assumptions_violated) {
              console.log(`  ✗ ${violated}`);
            }
          }
          console.log();

          console.log('Recommendation:');
          console.log(`  ${decision.recommendation}`);
          console.log();
        } else {
          console.log(JSON.stringify(decision, null, 2));
        }

        if (options.output) {
          writeFileSync(options.output, JSON.stringify(decision, null, 2));
          console.log(`✓ Mode selection saved to: ${options.output}`);
        }
      } else {
        console.error(
          'Error: Must provide either --data-file (single-site) or --sites-file (federated)'
        );
        process.exit(1);
      }
    } catch (error) {
      console.error('Error selecting inference mode:', error);
      process.exit(1);
    }
  });
