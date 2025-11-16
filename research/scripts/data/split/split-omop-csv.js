#!/usr/bin/env node
/**
 * Split OMOP CSV data from AWS into per-site federated datasets.
 *
 * Pure Node.js implementation (no Python required)
 *
 * This script reads raw OMOP CSV files downloaded from AWS S3 and splits
 * patients into multiple sites for federated learning experiments.
 *
 * Usage:
 *   node split-omop-csv.js \
 *     --input research/data-generation/omop-data/small/ \
 *     --output research/data-generation/splits/small/ \
 *     --num-sites 3 \
 *     --scenario simple
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    numSites: 3,
    scenario: 'simple',
    seed: 42,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.input = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--num-sites':
        options.numSites = parseInt(args[++i]);
        break;
      case '--scenario':
        options.scenario = args[++i];
        break;
      case '--seed':
        options.seed = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node split-omop-csv.js [options]

Options:
  --input <dir>       Directory containing OMOP CSV files (required)
  --output <dir>      Output directory for split JSON files (required)
  --num-sites <n>     Number of sites to split into (default: 3)
  --scenario <name>   Clinical scenario: simple, diabetes, icu, screening (default: simple)
  --seed <n>          Random seed for reproducibility (default: 42)
  --help, -h          Show this help message

Example:
  node split-omop-csv.js \\
    --input research/data-generation/omop-data/small/ \\
    --output research/data-generation/splits/small/ \\
    --num-sites 3 \\
    --scenario simple
`);
        process.exit(0);
    }
  }

  if (!options.input || !options.output) {
    console.error('❌ Error: --input and --output are required');
    process.exit(1);
  }

  return options;
}

// Seeded random number generator
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// Load OMOP CSV file
function loadOmopCsv(csvPath) {
  console.log(`  Reading ${path.basename(csvPath)}...`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
  });
}

// Extract simple patients (random treatment/outcome)
function extractSimplePatients(omopDir, random) {
  console.log('📋 Using simple extraction (random treatment/outcome)...');

  const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));

  const patients = persons.map((person) => {
    const personId = person.person_id;
    const yearOfBirth = parseInt(person.year_of_birth);
    const age = 2023 - yearOfBirth;

    // Random treatment assignment (50/50)
    const treatment = random.next() < 0.5 ? 1 : 0;

    // Outcome depends on treatment (simulate effect)
    const outcomeProb = treatment === 1 ? 0.6 : 0.4;
    const outcome = random.next() < outcomeProb ? 1 : 0;

    return {
      person_id: personId,
      treatment,
      outcome,
      age,
      gender: person.gender_concept_id,
    };
  });

  console.log(`   ✅ Created ${patients.length} patients`);
  return patients;
}

// Extract diabetes patients (more realistic)
function extractDiabetesPatients(omopDir, random) {
  console.log('📋 Extracting diabetes patients from OMOP tables...');

  try {
    const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));
    const drugs = loadOmopCsv(path.join(omopDir, 'drug_exposure.csv'));
    const measurements = loadOmopCsv(path.join(omopDir, 'measurement.csv'));

    console.log(
      `   Loaded: ${persons.length} persons, ${drugs.length} drugs, ${measurements.length} measurements`
    );

    // Group measurements by person (HbA1c values)
    const hba1cByPerson = {};
    for (const meas of measurements) {
      const personId = meas.person_id;
      const value = parseFloat(meas.value_as_number);

      if (!isNaN(value) && value > 0 && value < 20) {
        // Plausible HbA1c range
        if (!hba1cByPerson[personId]) {
          hba1cByPerson[personId] = [];
        }
        hba1cByPerson[personId].push(value);
      }
    }

    // Group drugs by person
    const drugByPerson = {};
    for (const drug of drugs) {
      const personId = drug.person_id;
      const drugConcept = drug.drug_concept_id;

      // Simple heuristic: higher concept IDs tend to be newer drugs (treatment)
      // Or if specific drug names are in the data
      const treatment = parseInt(drugConcept) > 10000000 ? 1 : 0;
      drugByPerson[personId] = treatment;
    }

    // Extract patients with complete data
    const patients = [];
    for (const person of persons) {
      const personId = person.person_id;

      if (hba1cByPerson[personId] && drugByPerson[personId] !== undefined) {
        const hba1cValues = hba1cByPerson[personId].sort((a, b) => a - b);
        const baselineHba1c = hba1cValues[0];
        const finalHba1c =
          hba1cValues.length > 1 ? hba1cValues[hba1cValues.length - 1] : baselineHba1c;

        // Outcome: HbA1c < 7%
        const outcome = finalHba1c < 7.0 ? 1 : 0;
        const treatment = drugByPerson[personId];

        const yearOfBirth = parseInt(person.year_of_birth);
        const age = 2023 - yearOfBirth;

        patients.push({
          person_id: personId,
          treatment,
          outcome,
          age,
          baseline_hba1c: Math.round(baselineHba1c * 10) / 10,
          final_hba1c: Math.round(finalHba1c * 10) / 10,
          gender: person.gender_concept_id,
        });
      }
    }

    if (patients.length < 100) {
      console.log(`   ⚠️  Only ${patients.length} patients with complete diabetes data`);
      console.log('   Falling back to simple extraction...');
      return extractSimplePatients(omopDir, random);
    }

    console.log(`   ✅ Extracted ${patients.length} diabetes patients`);
    return patients;
  } catch (error) {
    console.log(`   ⚠️  Diabetes extraction failed: ${error.message}`);
    console.log('   Falling back to simple extraction...');
    return extractSimplePatients(omopDir, random);
  }
}

// Extract ICU patients
function extractIcuPatients(omopDir, random) {
  console.log('📋 Extracting ICU patients from OMOP tables...');

  try {
    const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));
    const visits = loadOmopCsv(path.join(omopDir, 'visit_occurrence.csv'));
    const procedures = loadOmopCsv(path.join(omopDir, 'procedure_occurrence.csv'));

    console.log(
      `   Loaded: ${persons.length} persons, ${visits.length} visits, ${procedures.length} procedures`
    );

    // ICU visit concept IDs (typically 9203, 262 for ICU/intensive care)
    const icuVisits = new Set();
    for (const visit of visits) {
      const visitConcept = parseInt(visit.visit_concept_id);
      // Simplified: visits with higher IDs tend to be more intensive
      if (visitConcept === 9203 || visitConcept === 262 || visitConcept > 9000) {
        icuVisits.add(visit.person_id);
      }
    }

    // Procedures by person (mechanical ventilation as treatment proxy)
    const procedureByPerson = {};
    for (const proc of procedures) {
      const personId = proc.person_id;
      const procConcept = parseInt(proc.procedure_concept_id);

      if (!procedureByPerson[personId]) {
        procedureByPerson[personId] = [];
      }
      procedureByPerson[personId].push(procConcept);
    }

    // Extract ICU patients
    const patients = [];
    for (const person of persons) {
      const personId = person.person_id;

      if (icuVisits.has(personId)) {
        const yearOfBirth = parseInt(person.year_of_birth);
        const age = 2023 - yearOfBirth;

        // Treatment: had mechanical ventilation (high procedure concept IDs)
        const procedures = procedureByPerson[personId] || [];
        const treatment = procedures.some((p) => p > 4000000) ? 1 : 0;

        // Outcome: survival (simulated based on age and treatment)
        // Younger + treatment = better survival
        const survivalProb =
          treatment === 1
            ? Math.max(0.2, Math.min(0.9, 0.7 - (age - 50) * 0.01))
            : Math.max(0.1, Math.min(0.8, 0.5 - (age - 50) * 0.01));
        const outcome = random.next() < survivalProb ? 1 : 0;

        patients.push({
          person_id: personId,
          treatment,
          outcome,
          age,
          num_procedures: procedures.length,
          gender: person.gender_concept_id,
        });
      }
    }

    if (patients.length < 100) {
      console.log(`   ⚠️  Only ${patients.length} ICU patients found`);
      console.log('   Falling back to simple extraction...');
      return extractSimplePatients(omopDir, random);
    }

    console.log(`   ✅ Extracted ${patients.length} ICU patients`);
    return patients;
  } catch (error) {
    console.log(`   ⚠️  ICU extraction failed: ${error.message}`);
    console.log('   Falling back to simple extraction...');
    return extractSimplePatients(omopDir, random);
  }
}

// Extract screening patients
function extractScreeningPatients(omopDir, random) {
  console.log('📋 Extracting screening patients from OMOP tables...');

  try {
    const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));
    const observations = loadOmopCsv(path.join(omopDir, 'observation.csv'));
    const conditions = loadOmopCsv(path.join(omopDir, 'condition_occurrence.csv'));

    console.log(
      `   Loaded: ${persons.length} persons, ${observations.length} observations, ${conditions.length} conditions`
    );

    // Observations by person (screening tests)
    const screeningByPerson = {};
    for (const obs of observations) {
      const personId = obs.person_id;
      if (!screeningByPerson[personId]) {
        screeningByPerson[personId] = 0;
      }
      screeningByPerson[personId]++;
    }

    // Conditions by person (disease detection)
    const conditionsByPerson = {};
    for (const cond of conditions) {
      const personId = cond.person_id;
      if (!conditionsByPerson[personId]) {
        conditionsByPerson[personId] = [];
      }
      conditionsByPerson[personId].push(cond.condition_concept_id);
    }

    // Extract patients who had screening
    const patients = [];
    for (const person of persons) {
      const personId = person.person_id;
      const screeningCount = screeningByPerson[personId] || 0;

      if (screeningCount > 0) {
        const yearOfBirth = parseInt(person.year_of_birth);
        const age = 2023 - yearOfBirth;

        // Treatment: had regular screening (>=3 observations)
        const treatment = screeningCount >= 3 ? 1 : 0;

        // Outcome: early disease detection (has conditions + regular screening = better)
        const conditions = conditionsByPerson[personId] || [];
        const hasConditions = conditions.length > 0;

        // Early detection helps outcome
        const outcomeProb =
          treatment === 1
            ? hasConditions
              ? 0.7
              : 0.9 // Treatment + detection = good
            : hasConditions
              ? 0.4
              : 0.8; // No treatment + detection = worse
        const outcome = random.next() < outcomeProb ? 1 : 0;

        patients.push({
          person_id: personId,
          treatment,
          outcome,
          age,
          screening_count: screeningCount,
          num_conditions: conditions.length,
          gender: person.gender_concept_id,
        });
      }
    }

    if (patients.length < 100) {
      console.log(`   ⚠️  Only ${patients.length} screening patients found`);
      console.log('   Falling back to simple extraction...');
      return extractSimplePatients(omopDir, random);
    }

    console.log(`   ✅ Extracted ${patients.length} screening patients`);
    return patients;
  } catch (error) {
    console.log(`   ⚠️  Screening extraction failed: ${error.message}`);
    console.log('   Falling back to simple extraction...');
    return extractSimplePatients(omopDir, random);
  }
}

// Split patients into sites with balanced treatment/control
function splitPatientsBySite(patients, numSites, random) {
  // Separate by treatment status
  const treated = patients.filter((p) => p.treatment === 1);
  const control = patients.filter((p) => p.treatment === 0);

  // Shuffle both groups
  const shuffledTreated = random.shuffle(treated);
  const shuffledControl = random.shuffle(control);

  // Initialize site arrays
  const sitePatients = Array.from({ length: numSites }, () => []);

  // Round-robin distribution
  shuffledTreated.forEach((patient, i) => {
    const siteIdx = i % numSites;
    sitePatients[siteIdx].push(patient);
  });

  shuffledControl.forEach((patient, i) => {
    const siteIdx = i % numSites;
    sitePatients[siteIdx].push(patient);
  });

  // Shuffle each site's patients
  return sitePatients.map((site) => random.shuffle(site));
}

// Export site data to JSON
function exportSiteData(sitePatients, outputPath, siteId, scenario) {
  const nTotal = sitePatients.length;
  const nTreated = sitePatients.filter((p) => p.treatment === 1).length;
  const nControl = nTotal - nTreated;

  const siteData = {
    metadata: {
      site_id: siteId,
      scenario,
      n_patients: nTotal,
      n_treated: nTreated,
      n_control: nControl,
      split_date: new Date().toISOString(),
    },
    patients: sitePatients,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(siteData, null, 2));

  console.log(`  ✅ ${siteId}: ${nTotal} patients (${nTreated} treated, ${nControl} control)`);
}

// Main function
function main() {
  const options = parseArgs();

  console.log('🏥 Splitting OMOP data for federated learning');
  console.log(`   Input:    ${options.input}`);
  console.log(`   Output:   ${options.output}`);
  console.log(`   Sites:    ${options.numSites}`);
  console.log(`   Scenario: ${options.scenario}`);
  console.log('');

  // Initialize seeded random
  const random = new SeededRandom(options.seed);

  // Check if input directory exists
  if (!fs.existsSync(options.input)) {
    console.error(`❌ Error: Input directory not found: ${options.input}`);
    process.exit(1);
  }

  // Extract patients based on scenario
  let patients;
  switch (options.scenario) {
    case 'diabetes':
      patients = extractDiabetesPatients(options.input, random);
      break;
    case 'icu':
      patients = extractIcuPatients(options.input, random);
      break;
    case 'screening':
      patients = extractScreeningPatients(options.input, random);
      break;
    case 'simple':
    default:
      patients = extractSimplePatients(options.input, random);
      break;
  }

  // Split patients by site
  console.log(`\n🔀 Splitting ${patients.length} patients into ${options.numSites} sites...`);
  const sitePatients = splitPatientsBySite(patients, options.numSites, random);

  // Export per-site data
  console.log('\n💾 Exporting site data:');
  sitePatients.forEach((sitePats, idx) => {
    const siteId = `Hospital-${idx + 1}`;
    const outputPath = path.join(options.output, `site${idx + 1}.json`);
    exportSiteData(sitePats, outputPath, siteId, options.scenario);
  });

  // Export metadata
  const metadata = {
    num_sites: options.numSites,
    scenario: options.scenario,
    total_patients: patients.length,
    total_treated: patients.filter((p) => p.treatment === 1).length,
    total_control: patients.filter((p) => p.treatment === 0).length,
    source: options.input,
    generated_date: new Date().toISOString(),
  };

  const metadataPath = path.join(options.output, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`\n✅ Split complete! Output: ${options.output}`);
  console.log(`   Total patients: ${patients.length}`);
  console.log(`   Sites: ${options.numSites}`);
}

// Run main
if (require.main === module) {
  main();
}

module.exports = { extractSimplePatients, splitPatientsBySite };
