/**
 * Run billion-scale polypharmacy federated analysis
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  generatePolypharmacyOMOP,
  INTERACTION_TIERS,
  type PolypharmacyOMOPConfig,
  type CausalDataPoint,
} from '@harmonia/core';

interface RunPolypharmacyOptions {
  sites: string;
  patients: string;
  tier: string;
  output: string;
  seed: string;
  verbose: boolean;
  saveOmop: boolean;
  profile: 'US' | 'Japan' | 'Nordic' | 'India';
}

export const runPolypharmacyCommand = new Command('run-polypharmacy')
  .description('Run billion-scale polypharmacy federated causal inference')
  .option('--sites <number>', 'Number of federated sites', '10')
  .option('--patients <number>', 'Patients per site', '100000')
  .option(
    '--tier <1|2|3>',
    'Interaction tier (1=common 16%, 2=moderate 0.4%, 3=ultra-rare 0.064%)',
    '3'
  )
  .requiredOption('-o, --output <path>', 'Output directory for results')
  .option('--seed <number>', 'Random seed', '42')
  .option('-v, --verbose', 'Verbose output', false)
  .option('--save-omop', 'Save OMOP tables to disk (warning: large files)', false)
  .option('--profile <type>', 'Site profile: US, Japan, Nordic, or India', 'US')
  .action(async (options: RunPolypharmacyOptions) => {
    try {
      const numSites = parseInt(options.sites);
      const patientsPerSite = parseInt(options.patients);
      const interactionTier = parseInt(options.tier) as 1 | 2 | 3;
      const seed = parseInt(options.seed);

      if (![1, 2, 3].includes(interactionTier)) {
        console.error('❌ Error: --tier must be 1, 2, or 3');
        process.exit(1);
      }

      const tier = INTERACTION_TIERS[interactionTier - 1];

      console.log('🏥 OMOP-based Polypharmacy Federated Causal Inference\n');
      console.log('Configuration:');
      console.log(`  Sites:              ${numSites}`);
      console.log(`  Patients per site:  ${patientsPerSite.toLocaleString()}`);
      console.log(`  Total patients:     ${(numSites * patientsPerSite).toLocaleString()}`);
      console.log(`  Interaction tier:   ${interactionTier} - ${tier.name}`);
      console.log(`  Prevalence:         ${(tier.prevalence * 100).toFixed(3)}%`);
      console.log(
        `  True effect:        ${tier.trueEffect > 0 ? '+' : ''}${tier.trueEffect} ml/min/year`
      );
      console.log(`  Site profile:       ${options.profile}`);
      console.log(`  Random seed:        ${seed}`);
      console.log('');

      // Create output directory
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      const startTime = Date.now();

      console.log('📊 Generating OMOP CDM datasets...');

      const siteEstimates: Array<{
        n: number;
        nTreated: number;
        nControl: number;
        ate: number;
        se: number;
      }> = [];

      let totalBytes = 0;

      // Generate and analyze each site
      for (let siteId = 0; siteId < numSites; siteId++) {
        const config: PolypharmacyOMOPConfig = {
          numPatients: patientsPerSite,
          interactionTier,
          seed: seed + siteId,
          indexDate: '2024-01-01',
          siteProfile: options.profile,
        };

        const dataset = generatePolypharmacyOMOP(config);

        // Save OMOP tables if requested
        if (options.saveOmop) {
          const siteDir = path.join(options.output, `site_${siteId}`);
          fs.mkdirSync(siteDir, { recursive: true });

          const tables = [
            { name: 'person', data: dataset.persons },
            { name: 'condition_occurrence', data: dataset.conditions },
            { name: 'drug_exposure', data: dataset.drugs },
            { name: 'measurement', data: dataset.measurements },
          ];

          for (const table of tables) {
            if (table.data.length > 0) {
              const filePath = path.join(siteDir, `${table.name}.json`);
              fs.writeFileSync(filePath, JSON.stringify(table.data, null, 2));
            }
          }
        }

        // Extract causal data
        const causalData = extractPolypharmacyCausalData(dataset);

        // Compute site-level ATE
        const siteEstimate = computeSiteATE(causalData);
        siteEstimates.push(siteEstimate);

        // Actual bytes for this simplified estimator: {n, nTreated, nControl, ate, se} = 5 × float64 = 40 bytes
        // Full Newton-Raphson protocol (gradient+hessian+XWX+XWY, siteWorker.js): ~584 bytes per site
        totalBytes += Object.keys(siteEstimate).length * 8; // 40 bytes

        if (options.verbose && siteId < 3) {
          console.log(
            `  Site ${siteId}: n=${siteEstimate.n}, treated=${siteEstimate.nTreated}, ATE=${siteEstimate.ate.toFixed(3)}`
          );
        } else if (siteId % 100 === 0 && siteId > 0) {
          console.log(`  Generated ${siteId}/${numSites} sites...`);
        }
      }

      const generationTime = Date.now() - startTime;
      console.log(`✅ Generated ${numSites} sites in ${(generationTime / 1000).toFixed(2)}s`);
      console.log(
        `   Throughput: ${((numSites * patientsPerSite) / (generationTime / 1000)).toLocaleString()} patients/sec\n`
      );

      // Federated aggregation
      console.log('🔬 Running federated causal inference...\n');
      const federatedATE = aggregateFederatedATEs(siteEstimates);

      const totalTime = Date.now() - startTime;

      console.log('📈 Federated Results:');
      console.log(`  Total patients:          ${(numSites * patientsPerSite).toLocaleString()}`);
      console.log(
        `  Patients in target tier: ${Math.floor(numSites * patientsPerSite * tier.prevalence).toLocaleString()}`
      );
      console.log(
        `  Estimated ATE:           ${federatedATE.ate > 0 ? '+' : ''}${federatedATE.ate.toFixed(2)} ml/min/year`
      );
      console.log(
        `  95% CI:                  [${federatedATE.ci_lower.toFixed(2)}, ${federatedATE.ci_upper.toFixed(2)}]`
      );
      console.log(
        `  P-value:                 ${federatedATE.pvalue < 0.0001 ? '<0.0001' : federatedATE.pvalue.toFixed(4)}`
      );
      console.log(
        `  True effect:             ${tier.trueEffect > 0 ? '+' : ''}${tier.trueEffect} ml/min/year`
      );
      console.log('');

      console.log('⚡ Performance:');
      console.log(`  Total time:              ${(totalTime / 1000).toFixed(2)}s`);
      console.log(
        `  Throughput:              ${((numSites * patientsPerSite) / (totalTime / 1000)).toLocaleString()} patients/sec`
      );
      console.log('');

      const bytesPerSite = totalBytes / numSites;
      const fullProtocolBytesPerSite = 584; // full Newton-Raphson: gradient+hessian+XWX+XWY
      console.log('🔒 Privacy metrics:');
      console.log(`  Communication per site:  ${bytesPerSite} bytes (simplified; full NR protocol: ~${fullProtocolBytesPerSite} bytes)`);
      console.log(`  Total communication:     ${(totalBytes / 1024).toFixed(2)} KB`);
      console.log(
        `  Centralized equivalent:  ${((numSites * patientsPerSite * 200) / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Reduction factor:        ${Math.floor((numSites * patientsPerSite * 200) / totalBytes).toLocaleString()}x`
      );
      console.log('');

      // Save results
      const results = {
        config: {
          numSites,
          patientsPerSite,
          totalPatients: numSites * patientsPerSite,
          interactionTier,
          tierName: tier.name,
          tierPrevalence: tier.prevalence,
          trueEffect: tier.trueEffect,
          siteProfile: options.profile,
          seed,
        },
        federatedEstimate: federatedATE,
        performance: {
          totalTimeSeconds: totalTime / 1000,
          generationTimeSeconds: generationTime / 1000,
          throughputPatientsPerSec: (numSites * patientsPerSite) / (totalTime / 1000),
        },
        privacy: {
          bytesPerSite: totalBytes / numSites,
          fullProtocolBytesPerSite: 584,
          totalKB: totalBytes / 1024,
          reductionFactor: Math.floor((numSites * patientsPerSite * 200) / totalBytes),
        },
        siteEstimates: options.verbose ? siteEstimates : undefined,
      };

      const resultsPath = path.join(options.output, 'results.json');
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to: ${resultsPath}`);

      if (options.saveOmop) {
        console.log(`💾 OMOP tables saved to: ${options.output}/site_*`);
      }

      console.log('\n✨ Complete! OMOP CDM v5.4 format ready for OHDSI tools.');
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * Helper functions
 */

function extractPolypharmacyCausalData(dataset: any): CausalDataPoint[] {
  const data: CausalDataPoint[] = [];

  const drugsByPerson = new Map<number, Set<number>>();
  for (const drug of dataset.drugs) {
    if (!drugsByPerson.has(drug.person_id)) {
      drugsByPerson.set(drug.person_id, new Set());
    }
    drugsByPerson.get(drug.person_id)!.add(drug.drug_concept_id);
  }

  const measurementsByPerson = new Map<number, any[]>();
  for (const measurement of dataset.measurements) {
    if (!measurementsByPerson.has(measurement.person_id)) {
      measurementsByPerson.set(measurement.person_id, []);
    }
    measurementsByPerson.get(measurement.person_id)!.push(measurement);
  }

  for (const person of dataset.persons) {
    const personId = person.person_id;
    const drugs = drugsByPerson.get(personId) || new Set();
    const measurements = measurementsByPerson.get(personId) || [];

    const treatment = drugs.has(1594973) ? 1 : 0; // SGLT2I

    const baselineMeasurement = measurements.find(
      (m) => m.measurement_concept_id === 3049187 && m.measurement_date === '2023-12-01'
    );
    const followupMeasurement = measurements.find(
      (m) => m.measurement_concept_id === 3049187 && m.measurement_date === '2024-12-01'
    );

    if (baselineMeasurement && followupMeasurement) {
      const eGFRChange = followupMeasurement.value_as_number - baselineMeasurement.value_as_number;
      data.push({ treatment, outcome: eGFRChange });
    }
  }

  return data;
}

function computeSiteATE(data: CausalDataPoint[]) {
  const treated = data.filter((d) => d.treatment === 1);
  const control = data.filter((d) => d.treatment === 0);

  const treatedMean = treated.reduce((sum, d) => sum + d.outcome, 0) / treated.length;
  const controlMean = control.reduce((sum, d) => sum + d.outcome, 0) / control.length;

  const ate = treatedMean - controlMean;

  const treatedVar =
    treated.reduce((sum, d) => sum + Math.pow(d.outcome - treatedMean, 2), 0) / treated.length;
  const controlVar =
    control.reduce((sum, d) => sum + Math.pow(d.outcome - controlMean, 2), 0) / control.length;
  const se = Math.sqrt(treatedVar / treated.length + controlVar / control.length);

  return {
    n: data.length,
    nTreated: treated.length,
    nControl: control.length,
    ate,
    se,
  };
}

function aggregateFederatedATEs(siteEstimates: Array<{ n: number; ate: number; se: number }>) {
  const weights = siteEstimates.map((s) => 1 / (s.se * s.se));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const ate = siteEstimates.reduce((sum, s, i) => sum + s.ate * weights[i], 0) / totalWeight;
  const se = Math.sqrt(1 / totalWeight);

  const z = ate / se;
  const pvalue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    ate,
    se,
    ci_lower: ate - 1.96 * se,
    ci_upper: ate + 1.96 * se,
    z,
    pvalue,
  };
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}
