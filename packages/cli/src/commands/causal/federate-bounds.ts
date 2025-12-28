/**
 * Federate bounds from multiple sites
 *
 * Aggregates partial identification bounds from multiple sites
 * without sharing patient-level data.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  federateATEBounds,
  formatFederatedBounds,
  computeCommunicationCost,
  type SiteBounds,
  type FederatedBounds,
} from '@harmonia/core';

interface FederateBoundsOptions {
  sites: string[];
  output?: string;
  strategy?: 'weighted-average' | 'conservative' | 'uniform' | 'inverse-width' | 'sqrt-n' | 'log-n' | 'power';
  minSites?: string;
  alpha?: string;
  trueAte?: string;
  verbose?: boolean;
}

/**
 * Load site bounds from JSON file
 */
function loadSiteBounds(sitePath: string): SiteBounds {
  const content = fs.readFileSync(sitePath, 'utf-8');
  const bounds = JSON.parse(content);

  if (!bounds.siteId) {
    // Use filename as siteId if not specified
    bounds.siteId = path.basename(sitePath, path.extname(sitePath));
  }

  return bounds as SiteBounds;
}

/**
 * Save federated bounds to JSON file
 */
function saveFederatedBounds(bounds: FederatedBounds, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(bounds, null, 2), 'utf-8');
}

export const federateBoundsCommand = new Command('federate-bounds')
  .description('Aggregate bounds from multiple sites')
  .requiredOption('-s, --sites <paths...>', 'Paths to site bounds files (JSON)')
  .option(
    '-o, --output <path>',
    'Output path for federated bounds (default: federated-bounds.json)'
  )
  .option(
    '--strategy <type>',
    'Aggregation strategy: weighted-average, conservative, uniform, inverse-width, sqrt-n, log-n, power (default: weighted-average)',
    'weighted-average'
  )
  .option('--min-sites <number>', 'Minimum number of sites required (default: 2)')
  .option('--alpha <value>', 'Power parameter for power strategy (default: 0.5)', parseFloat)
  .option('--true-ate <value>', 'True ATE value (for validation/simulation)', parseFloat)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (options: FederateBoundsOptions) => {
    try {
      console.log('🌐 Federating bounds from multiple sites...\n');

      // Load site bounds
      if (options.verbose) {
        console.log(`📂 Loading bounds from ${options.sites.length} sites:`);
        options.sites.forEach((site) => console.log(`   - ${site}`));
        console.log('');
      }

      const siteBounds: SiteBounds[] = options.sites.map((sitePath) => {
        const bounds = loadSiteBounds(sitePath);
        console.log(
          `✅ ${bounds.siteId}: [${bounds.lower.toFixed(3)}, ${bounds.upper.toFixed(3)}] (n=${bounds.sampleSize})`
        );
        return bounds;
      });

      console.log('');

      // Compute communication cost
      const cost = computeCommunicationCost(siteBounds);
      if (options.verbose) {
        console.log('📡 Communication cost:');
        console.log(`   ${cost.bytesPerSite} bytes/site`);
        console.log(`   ${cost.totalBytes} bytes total`);
        console.log('');
      }

      // Federate bounds
      const federated = federateATEBounds(siteBounds, {
        strategy: options.strategy as any,
        minSites: options.minSites !== undefined ? parseInt(options.minSites) : undefined,
        alpha: options.alpha,
      });

      // Display results
      console.log('📊 Federated Results:');
      console.log('='.repeat(60));
      console.log(formatFederatedBounds(federated));
      console.log('='.repeat(60));
      console.log(`Lower bound:    ${federated.lower.toFixed(4)}`);
      console.log(`Upper bound:    ${federated.upper.toFixed(4)}`);
      console.log(`Width:          ${federated.width.toFixed(4)}`);
      console.log(`Sites:          ${federated.numSites}`);
      console.log(`Total samples:  ${federated.totalSampleSize}`);
      console.log(`Strategy:       ${federated.strategy}`);

      // Check coverage if true ATE provided
      if (options.trueAte !== undefined) {
        const trueAteValue = Number(options.trueAte);
        const covered = trueAteValue >= federated.lower && trueAteValue <= federated.upper;
        console.log(
          `\n${covered ? '✅' : '❌'} Coverage: True ATE (${trueAteValue.toFixed(4)}) is ${covered ? 'inside' : 'outside'} federated bounds`
        );

        // Show individual site coverage
        if (options.verbose) {
          console.log('\n📋 Site-specific coverage:');
          siteBounds.forEach((site) => {
            const siteCovered = trueAteValue >= site.lower && trueAteValue <= site.upper;
            console.log(
              `   ${siteCovered ? '✅' : '❌'} ${site.siteId}: [${site.lower.toFixed(3)}, ${site.upper.toFixed(3)}]`
            );
          });
        }
      }

      // Save results
      const outputPath = options.output || 'federated-bounds.json';
      saveFederatedBounds(federated, outputPath);
      console.log(`\n💾 Saved federated bounds to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });
