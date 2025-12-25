/**
 * Run federated causal inference on OMOP CDM data
 * 
 * Demonstrates billion-scale federated analysis using OMOP-formatted data
 * for real-world compatibility.
 * 
 * Usage:
 *   node runOMOPFederated.js [options]
 * 
 * Options:
 *   --sites <n>        Number of sites (default: 1000)
 *   --patients <n>     Patients per site (default: 1000000)
 *   --extract          Extract causal cohort from OMOP data
 *   --analyze          Run federated causal analysis
 *   --output <dir>     Output directory for results
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

const {
  generateFederatedOMOPData,
  extractPolypharmacyCohort,
  OMOP_CONCEPTS,
} = require('./omopDataGenerator');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    nSites: 1000,
    patientsPerSite: 1000000,
    extract: false,
    analyze: false,
    output: './output/omop-federated',
    seed: 42,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sites':
        options.nSites = parseInt(args[++i]);
        break;
      case '--patients':
        options.patientsPerSite = parseInt(args[++i]);
        break;
      case '--extract':
        options.extract = true;
        break;
      case '--analyze':
        options.analyze = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--seed':
        options.seed = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
OMOP Federated Causal Inference Runner

Usage: node runOMOPFederated.js [options]

Options:
  --sites <n>        Number of sites (default: 1000)
  --patients <n>     Patients per site (default: 1000000)
  --extract          Extract causal cohort from OMOP data
  --analyze          Run federated causal analysis
  --output <dir>     Output directory (default: ./output/omop-federated)
  --seed <n>         Random seed (default: 42)
  --help             Show this help

Examples:
  # Generate 10 OMOP sites with 10K patients each
  node runOMOPFederated.js --sites 10 --patients 10000

  # Generate and extract causal cohort
  node runOMOPFederated.js --sites 100 --patients 100000 --extract

  # Full analysis: generate + extract + analyze
  node runOMOPFederated.js --sites 1000 --patients 1000000 --extract --analyze
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();
  
  console.log('='.repeat(60));
  console.log('OMOP Federated Causal Inference - Polypharmacy Research');
  console.log('='.repeat(60));
  console.log(`Configuration:`);
  console.log(`  Sites:             ${options.nSites}`);
  console.log(`  Patients per site: ${options.patientsPerSite}`);
  console.log(`  Total patients:    ${options.nSites * options.patientsPerSite}`);
  console.log(`  Extract cohort:    ${options.extract}`);
  console.log(`  Run analysis:      ${options.analyze}`);
  console.log(`  Output directory:  ${options.output}`);
  console.log('');

  // Create output directory
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
    console.log(`✓ Created output directory: ${options.output}\n`);
  }

  // Step 1: Generate OMOP data
  console.log('Step 1: Generating OMOP CDM data across sites...');
  const startGenTime = Date.now();

  const sites = generateFederatedOMOPData({
    nSites: options.nSites,
    patientsPerSite: options.patientsPerSite,
    profiles: ['US', 'Japan', 'Nordic', 'India'],
    seed: options.seed,
    indexDate: '2024-01-01',
  });

  const genDuration = (Date.now() - startGenTime) / 1000;
  const totalPatients = options.nSites * options.patientsPerSite;
  const throughput = Math.floor(totalPatients / genDuration);

  console.log(`\n✓ Generation complete in ${genDuration.toFixed(1)}s`);
  console.log(`  Throughput: ${throughput.toLocaleString()} patients/second\n`);

  // Save site metadata
  const metadata = {
    nSites: options.nSites,
    patientsPerSite: options.patientsPerSite,
    totalPatients,
    generationTime: genDuration,
    throughput,
    omopConcepts: OMOP_CONCEPTS,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(options.output, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  console.log(`✓ Saved metadata to ${path.join(options.output, 'metadata.json')}\n`);

  // Step 2: Extract causal cohorts (if requested)
  if (options.extract) {
    console.log('Step 2: Extracting causal inference cohorts...');
    const startExtractTime = Date.now();

    const cohorts = [];
    let totalCohortSize = 0;
    let totalInteraction3 = 0;

    for (let i = 0; i < sites.length; i++) {
      const cohort = extractPolypharmacyCohort(sites[i], {
        indexDate: '2024-01-01',
        followUpDays: 180,
      });

      cohorts.push({
        siteId: sites[i].metadata.siteId,
        cohortSize: cohort.cohortSize,
        numTreated: cohort.numTreated,
        numControl: cohort.numControl,
        rareSubgroups: cohort.rareSubgroups,
      });

      totalCohortSize += cohort.cohortSize;
      totalInteraction3 += cohort.rareSubgroups.interaction3.count;

      if ((i + 1) % 100 === 0) {
        console.log(`  Extracted ${i + 1}/${sites.length} sites`);
      }
    }

    const extractDuration = (Date.now() - startExtractTime) / 1000;

    console.log(`\n✓ Extraction complete in ${extractDuration.toFixed(1)}s`);
    console.log(`\nCohort Summary:`);
    console.log(`  Total cohort size:     ${totalCohortSize.toLocaleString()}`);
    console.log(`  Interaction 3 patients: ${totalInteraction3.toLocaleString()}`);
    console.log(`  Interaction 3 prevalence: ${((totalInteraction3 / totalCohortSize) * 100).toFixed(3)}%`);

    // Save cohort summary
    const cohortSummary = {
      totalCohortSize,
      totalInteraction3,
      prevalence: totalInteraction3 / totalCohortSize,
      siteCohorts: cohorts,
      extractionTime: extractDuration,
    };

    fs.writeFileSync(
      path.join(options.output, 'cohort-summary.json'),
      JSON.stringify(cohortSummary, null, 2)
    );
    console.log(`\n✓ Saved cohort summary to ${path.join(options.output, 'cohort-summary.json')}\n`);
  }

  // Step 3: Run federated analysis (if requested)
  if (options.analyze) {
    console.log('Step 3: Running federated causal analysis...');
    console.log('  (This step requires federated propensity score estimation)');
    console.log('  Implementation: Use siteWorker.js with OMOP-extracted cohort data\n');
    
    // TODO: Implement federated analysis using OMOP cohort data
    // This would integrate with existing siteWorker.js and testOptimized.js
    console.log('  Note: Full federated analysis integration coming in next update.');
  }

  console.log('='.repeat(60));
  console.log('OMOP Federated Analysis Complete');
  console.log('='.repeat(60));
  console.log(`\nResults saved to: ${options.output}`);
  console.log(`\nOMOP Tables Generated:`);
  console.log(`  - PERSON: Demographics`);
  console.log(`  - CONDITION_OCCURRENCE: Diagnoses (ICD-10, SNOMED)`);
  console.log(`  - DRUG_EXPOSURE: Medications (RxNorm)`);
  console.log(`  - MEASUREMENT: Labs (LOINC)`);
  console.log(`  - PROCEDURE_OCCURRENCE: Procedures (CPT)`);
  console.log(`  - VISIT_OCCURRENCE: Encounters`);
  console.log(`\nNext Steps:`);
  console.log(`  1. Inspect metadata.json for dataset statistics`);
  if (options.extract) {
    console.log(`  2. Review cohort-summary.json for rare subgroup prevalence`);
  }
  console.log(`  3. Use OMOP data with existing OHDSI tools (Atlas, Achilles)`);
  console.log(`  4. Run federated propensity score analysis with --analyze flag\n`);
}

// Run
main().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
