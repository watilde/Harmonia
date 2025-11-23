/**
 * CLI command for parallel diagnosis of causal assumption violations
 * across multiple sites
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  diagnoseAssumptionsParallel,
  createCliProgressCallback,
  type Patient,
  type SiteData,
} from '@harmonia/core';

export const diagnoseAssumptionsParallelCommand = new Command('diagnose-assumptions-parallel')
  .description('Diagnose causal assumptions in parallel across multiple sites')
  .requiredOption(
    '--data-dir <path>',
    'Directory containing site data files (site_1.json, site_2.json, ...)'
  )
  .option('--site-pattern <pattern>', 'Filename pattern for site files', 'site_*.json')
  .option('--output <path>', 'Output file path (JSON)')
  .option('--format <type>', 'Output format (json|table)', 'table')
  .option('--detailed', 'Show detailed violation information', false)
  .option(
    '--max-workers <number>',
    'Maximum number of parallel workers',
    (val) => parseInt(val),
    undefined
  )
  .action(async (options) => {
    try {
      // Find all site data files
      const dataDir = options.dataDir;
      const pattern = options.sitePattern;

      // Convert glob pattern to regex
      const regexPattern = pattern.replace(/[.]/g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);

      const files = readdirSync(dataDir).filter((f) => {
        const fullPath = join(dataDir, f);
        return statSync(fullPath).isFile() && regex.test(f);
      });

      if (files.length === 0) {
        console.error(
          `Error: No site data files found in ${dataDir} matching pattern ${options.sitePattern}`
        );
        process.exit(1);
      }

      // Load all site data
      console.log(`\n📁 Loading ${files.length} site data files...\n`);
      const sites: SiteData[] = [];

      for (const file of files) {
        const filePath = join(dataDir, file);
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        const patients: Patient[] = data.patients || data;

        if (!Array.isArray(patients) || patients.length === 0) {
          console.warn(`⚠️  Skipping ${file}: Invalid or empty patient array`);
          continue;
        }

        // Extract siteId from filename
        // e.g., "site-1-data.json" → "site_1" or "site_1.json" → "site_1"
        const siteId = file.replace('.json', '').replace('-data', '').replace(/-/g, '_');
        sites.push({
          siteId,
          patients,
        });

        console.log(`  ✓ ${siteId}: ${patients.length.toLocaleString()} patients`);
      }

      if (sites.length === 0) {
        console.error('Error: No valid site data loaded');
        process.exit(1);
      }

      const totalPatients = sites.reduce((sum, site) => sum + site.patients.length, 0);
      console.log(
        `\n📊 Total: ${sites.length} sites, ${totalPatients.toLocaleString()} patients\n`
      );

      // Create progress callback
      const progressCallback = createCliProgressCallback();

      console.log('🚀 Starting parallel diagnostics...\n');
      const startTime = Date.now();

      // Run parallel diagnostics
      const results = await diagnoseAssumptionsParallel(sites, {
        includeDetails: options.detailed,
        maxWorkers: options.maxWorkers,
        progressCallback,
      });

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ Diagnostics completed in ${elapsedTime}s\n`);

      // Display results
      if (options.format === 'table') {
        console.log('┌──────────────────────────────────────────────────────────────────┐');
        console.log('│  Federated Causal Assumptions Diagnostic Report                 │');
        console.log('└──────────────────────────────────────────────────────────────────┘\n');

        // Per-site results
        for (const result of results) {
          console.log(`\n${result.siteId.toUpperCase()}:`);
          console.log('─'.repeat(70));

          if (result.error) {
            console.log(`  ❌ Error: ${result.error}`);
            continue;
          }

          console.log(
            `  Unconfoundedness (Ignorability):    ${result.scores.unconfoundedness_score.toFixed(3)} ${getScoreBar(result.scores.unconfoundedness_score)}`
          );
          console.log(
            `  Positivity (Overlap):                ${result.scores.positivity_score.toFixed(3)} ${getScoreBar(result.scores.positivity_score)}`
          );
          console.log(
            `  Specification (Model Fit):           ${result.scores.specification_score.toFixed(3)} ${getScoreBar(result.scores.specification_score)}`
          );
          console.log(
            `  Overall Score:                       ${result.scores.overall_score.toFixed(3)} ${getScoreBar(result.scores.overall_score)}`
          );

          // Detailed violations
          if (options.detailed && result.violations) {
            console.log('\n  Detailed Violations:');
            for (const violation of result.violations) {
              console.log(`    • ${violation.assumption}: ${violation.description}`);
              console.log(`      Recommendation: ${violation.recommendation}`);
            }
          }
        }

        // Aggregate statistics
        console.log('\n\nAGGREGATE STATISTICS:');
        console.log('═'.repeat(70));

        const validResults = results.filter((r) => !r.error);
        if (validResults.length > 0) {
          const avgUnconfoundedness =
            validResults.reduce((sum, r) => sum + r.scores.unconfoundedness_score, 0) /
            validResults.length;
          const avgPositivity =
            validResults.reduce((sum, r) => sum + r.scores.positivity_score, 0) /
            validResults.length;
          const avgSpecification =
            validResults.reduce((sum, r) => sum + r.scores.specification_score, 0) /
            validResults.length;
          const avgOverall =
            validResults.reduce((sum, r) => sum + r.scores.overall_score, 0) / validResults.length;

          console.log(`  Average Unconfoundedness Score:    ${avgUnconfoundedness.toFixed(3)}`);
          console.log(`  Average Positivity Score:          ${avgPositivity.toFixed(3)}`);
          console.log(`  Average Specification Score:       ${avgSpecification.toFixed(3)}`);
          console.log(`  Average Overall Score:             ${avgOverall.toFixed(3)}`);

          console.log(`\n  Network-wide Interpretation:`);
          if (avgOverall >= 0.8) {
            console.log('    ✓ Assumptions appear satisfied across network');
            console.log('    → Federated point estimates likely reliable\n');
          } else if (avgOverall >= 0.6) {
            console.log('    ⚠ Moderate violations detected across network');
            console.log('    → Consider using bounds or sensitivity analysis\n');
          } else {
            console.log('    ✗ Severe violations detected across network');
            console.log('    → Use partial identification bounds required\n');
          }
        }
      } else {
        // JSON output
        console.log(JSON.stringify(results, null, 2));
      }

      // Save to file
      if (options.output) {
        writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(`\n✓ Diagnostics saved to: ${options.output}`);
      }
    } catch (error) {
      console.error('Error running parallel diagnostics:', error);
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
