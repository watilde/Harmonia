#!/usr/bin/env ts-node
/**
 * Split OMOP CSV data from AWS into per-site federated datasets.
 *
 * Pure TypeScript implementation (ts-node)
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

type Scenario = 'simple' | 'diabetes' | 'icu' | 'screening';

interface SplitOptions {
  input: string;
  output: string;
  numSites: number;
  scenario: Scenario;
  seed: number;
}

interface BasePatient {
  person_id: string;
  treatment: 0 | 1;
  outcome: 0 | 1;
  age: number;
  gender?: string;
  [key: string]: unknown;
}

type CsvRow = Record<string, string>;

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

function parseArgs(): SplitOptions {
  const args = process.argv.slice(2);
  const options: SplitOptions = {
    input: '',
    output: '',
    numSites: 3,
    scenario: 'simple',
    seed: 42,
  };

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case '--input':
        options.input = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--num-sites':
        options.numSites = parseInt(args[++i], 10);
        break;
      case '--scenario':
        options.scenario = args[++i] as Scenario;
        break;
      case '--seed':
        options.seed = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  if (!options.input || !options.output) {
    console.error('❌ Error: --input and --output are required');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage: ts-node split-omop-csv.ts [options]

Options:
  --input <dir>       Directory containing OMOP CSV files (required)
  --output <dir>      Output directory for split JSON files (required)
  --num-sites <n>     Number of sites to split into (default: 3)
  --scenario <name>   Clinical scenario: simple, diabetes, icu, screening (default: simple)
  --seed <n>          Random seed for reproducibility (default: 42)
  --help, -h          Show this help message

Example:
  ts-node split-omop-csv.ts \\
    --input research/data-generation/omop-data/small/ \\
    --output research/data-generation/splits/small/ \\
    --num-sites 3 \\
    --scenario simple
`);
}

function loadOmopCsv(csvPath: string): CsvRow[] {
  console.log(`  Reading ${path.basename(csvPath)}...`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

function extractSimplePatients(omopDir: string, random: SeededRandom): BasePatient[] {
  console.log('📋 Using simple extraction (random treatment/outcome)...');

  const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));

  const patients = persons.map<BasePatient>((person) => {
    const yearOfBirth = parseInt(person.year_of_birth, 10);
    const age = 2023 - yearOfBirth;

    const treatment: 0 | 1 = random.next() < 0.5 ? 1 : 0;
    const outcomeProb = treatment === 1 ? 0.6 : 0.4;
    const outcome: 0 | 1 = random.next() < outcomeProb ? 1 : 0;

    return {
      person_id: person.person_id,
      treatment,
      outcome,
      age,
      gender: person.gender_concept_id,
    };
  });

  console.log(`   ✅ Created ${patients.length} patients`);
  return patients;
}

function extractDiabetesPatients(omopDir: string, random: SeededRandom): BasePatient[] {
  console.log('📋 Extracting diabetes patients from OMOP tables...');

  try {
    const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));
    const drugs = loadOmopCsv(path.join(omopDir, 'drug_exposure.csv'));
    const measurements = loadOmopCsv(path.join(omopDir, 'measurement.csv'));

    console.log(
      `   Loaded: ${persons.length} persons, ${drugs.length} drugs, ${measurements.length} measurements`
    );

    const hba1cByPerson: Record<string, number[]> = {};
    for (const meas of measurements) {
      const value = parseFloat(meas.value_as_number);
      if (!Number.isNaN(value) && value > 0 && value < 20) {
        if (!hba1cByPerson[meas.person_id]) {
          hba1cByPerson[meas.person_id] = [];
        }
        hba1cByPerson[meas.person_id].push(value);
      }
    }

    const drugByPerson: Record<string, 0 | 1> = {};
    for (const drug of drugs) {
      const concept = Number(drug.drug_concept_id);
      drugByPerson[drug.person_id] = concept > 10000000 ? 1 : 0;
    }

    const patients: BasePatient[] = [];
    for (const person of persons) {
      const personId = person.person_id;
      if (hba1cByPerson[personId] && drugByPerson[personId] !== undefined) {
        const sortedValues = hba1cByPerson[personId].sort((a, b) => a - b);
        const baselineHba1c = sortedValues[0];
        const finalHba1c =
          sortedValues.length > 1 ? sortedValues[sortedValues.length - 1] : baselineHba1c;
        const outcome: 0 | 1 = finalHba1c < 7 ? 1 : 0;
        const treatment = drugByPerson[personId];
        const age = 2023 - parseInt(person.year_of_birth, 10);

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
    const err = error as Error;
    console.log(`   ⚠️  Diabetes extraction failed: ${err.message}`);
    console.log('   Falling back to simple extraction...');
    return extractSimplePatients(omopDir, random);
  }
}

function extractIcuPatients(omopDir: string, random: SeededRandom): BasePatient[] {
  console.log('📋 Extracting ICU patients from OMOP tables...');

  try {
    const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));
    const visits = loadOmopCsv(path.join(omopDir, 'visit_occurrence.csv'));
    const procedures = loadOmopCsv(path.join(omopDir, 'procedure_occurrence.csv'));

    console.log(
      `   Loaded: ${persons.length} persons, ${visits.length} visits, ${procedures.length} procedures`
    );

    const icuVisits = new Set<string>();
    for (const visit of visits) {
      const concept = parseInt(visit.visit_concept_id, 10);
      if (concept === 9203 || concept === 262 || concept > 9000) {
        icuVisits.add(visit.person_id);
      }
    }

    const procedureByPerson: Record<string, number[]> = {};
    for (const proc of procedures) {
      if (!procedureByPerson[proc.person_id]) {
        procedureByPerson[proc.person_id] = [];
      }
      procedureByPerson[proc.person_id].push(parseInt(proc.procedure_concept_id, 10));
    }

    const patients: BasePatient[] = [];
    for (const person of persons) {
      if (icuVisits.has(person.person_id)) {
        const proceduresForPerson = procedureByPerson[person.person_id] ?? [];
        const treatment: 0 | 1 = proceduresForPerson.some((p) => p > 4_000_000) ? 1 : 0;
        const age = 2023 - parseInt(person.year_of_birth, 10);
        const survivalProb =
          treatment === 1
            ? Math.max(0.2, Math.min(0.9, 0.7 - (age - 50) * 0.01))
            : Math.max(0.1, Math.min(0.8, 0.5 - (age - 50) * 0.01));
        const outcome: 0 | 1 = random.next() < survivalProb ? 1 : 0;

        patients.push({
          person_id: person.person_id,
          treatment,
          outcome,
          age,
          num_procedures: proceduresForPerson.length,
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
    const err = error as Error;
    console.log(`   ⚠️  ICU extraction failed: ${err.message}`);
    console.log('   Falling back to simple extraction...');
    return extractSimplePatients(omopDir, random);
  }
}

function extractScreeningPatients(omopDir: string, random: SeededRandom): BasePatient[] {
  console.log('📋 Extracting screening patients from OMOP tables...');

  try {
    const persons = loadOmopCsv(path.join(omopDir, 'person.csv'));
    const observations = loadOmopCsv(path.join(omopDir, 'observation.csv'));
    const conditions = loadOmopCsv(path.join(omopDir, 'condition_occurrence.csv'));

    console.log(
      `   Loaded: ${persons.length} persons, ${observations.length} observations, ${conditions.length} conditions`
    );

    const screeningByPerson: Record<string, number> = {};
    for (const obs of observations) {
      screeningByPerson[obs.person_id] = (screeningByPerson[obs.person_id] ?? 0) + 1;
    }

    const conditionsByPerson: Record<string, string[]> = {};
    for (const cond of conditions) {
      if (!conditionsByPerson[cond.person_id]) {
        conditionsByPerson[cond.person_id] = [];
      }
      conditionsByPerson[cond.person_id].push(cond.condition_concept_id);
    }

    const patients: BasePatient[] = [];
    for (const person of persons) {
      const screeningCount = screeningByPerson[person.person_id] ?? 0;
      if (screeningCount > 0) {
        const treatment: 0 | 1 = screeningCount >= 3 ? 1 : 0;
        const age = 2023 - parseInt(person.year_of_birth, 10);
        const conditionsForPerson = conditionsByPerson[person.person_id] ?? [];
        const hasConditions = conditionsForPerson.length > 0;

        const outcomeProb =
          treatment === 1 ? (hasConditions ? 0.7 : 0.9) : hasConditions ? 0.4 : 0.8;
        const outcome: 0 | 1 = random.next() < outcomeProb ? 1 : 0;

        patients.push({
          person_id: person.person_id,
          treatment,
          outcome,
          age,
          screening_count: screeningCount,
          num_conditions: conditionsForPerson.length,
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
    const err = error as Error;
    console.log(`   ⚠️  Screening extraction failed: ${err.message}`);
    console.log('   Falling back to simple extraction...');
    return extractSimplePatients(omopDir, random);
  }
}

function splitPatientsBySite(
  patients: BasePatient[],
  numSites: number,
  random: SeededRandom
): BasePatient[][] {
  const treated = patients.filter((p) => p.treatment === 1);
  const control = patients.filter((p) => p.treatment === 0);

  const shuffledTreated = random.shuffle(treated);
  const shuffledControl = random.shuffle(control);

  const sitePatients: BasePatient[][] = Array.from({ length: numSites }, () => []);

  shuffledTreated.forEach((patient, i) => {
    const siteIdx = i % numSites;
    sitePatients[siteIdx].push(patient);
  });

  shuffledControl.forEach((patient, i) => {
    const siteIdx = i % numSites;
    sitePatients[siteIdx].push(patient);
  });

  return sitePatients.map((site) => random.shuffle(site));
}

function exportSiteData(
  sitePatients: BasePatient[],
  outputPath: string,
  siteId: string,
  scenario: Scenario
): void {
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

function main(): void {
  const options = parseArgs();

  console.log('🏥 Splitting OMOP data for federated learning');
  console.log(`   Input:    ${options.input}`);
  console.log(`   Output:   ${options.output}`);
  console.log(`   Sites:    ${options.numSites}`);
  console.log(`   Scenario: ${options.scenario}`);
  console.log('');

  const random = new SeededRandom(options.seed);

  if (!fs.existsSync(options.input)) {
    console.error(`❌ Error: Input directory not found: ${options.input}`);
    process.exit(1);
  }

  let patients: BasePatient[];
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

  console.log(`\n🔀 Splitting ${patients.length} patients into ${options.numSites} sites...`);
  const sitePatients = splitPatientsBySite(patients, options.numSites, random);

  console.log('\n💾 Exporting site data:');
  sitePatients.forEach((sitePats, idx) => {
    const siteId = `Hospital-${idx + 1}`;
    const outputPath = path.join(options.output, `site${idx + 1}.json`);
    exportSiteData(sitePats, outputPath, siteId, options.scenario);
  });

  const metadata = {
    num_sites: options.numSites,
    scenario: options.scenario,
    total_patients: patients.length,
    total_treated: patients.filter((p) => p.treatment === 1).length,
    total_control: patients.filter((p) => p.treatment === 0).length,
    source: options.input,
    generated_date: new Date().toISOString(),
  };

  fs.mkdirSync(options.output, { recursive: true });
  const metadataPath = path.join(options.output, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`\n✅ Split complete! Output: ${options.output}`);
  console.log(`   Total patients: ${patients.length}`);
  console.log(`   Sites: ${options.numSites}`);
}

main();
