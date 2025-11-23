#!/usr/bin/env ts-node
/**
 * Prepare MIMIC OMOP data for causal inference workflow.
 * Extracts treatment and outcome from condition_occurrence.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface PersonRow {
  person_id: string;
  gender_concept_id: string;
  year_of_birth: string;
}

interface ConditionRow {
  person_id: string;
  condition_concept_id: string;
}

interface VisitRow {
  person_id: string;
  visit_occurrence_id: string;
  visit_start_date: string;
  visit_end_date: string;
}

interface PersonAggregated {
  person_id: string;
  avg_los: number;
  visit_count: number;
  treatment: number;
  outcome: number;
  gender_concept_id?: string;
  year_of_birth?: string;
}

interface OutputRecord {
  patientId: string;
  treatment: number;
  outcome: number;
  age: number | null;
  gender: number | null;
  visit_count: number;
}

function prepareMimicData(inputDir: string, outputFile: string): number {
  console.log('📂 Loading MIMIC OMOP data...');

  // Load CSV files
  const personCsv = fs.readFileSync(path.join(inputDir, 'person.csv'), 'utf-8');
  const conditionCsv = fs.readFileSync(path.join(inputDir, 'condition_occurrence.csv'), 'utf-8');
  const visitCsv = fs.readFileSync(path.join(inputDir, 'visit_occurrence.csv'), 'utf-8');

  const personData: PersonRow[] = parse(personCsv, { columns: true, skip_empty_lines: true });
  const conditionData: ConditionRow[] = parse(conditionCsv, { columns: true, skip_empty_lines: true });
  const visitData: VisitRow[] = parse(visitCsv, { columns: true, skip_empty_lines: true });

  console.log(`   Loaded ${personData.length} persons`);
  console.log(`   Loaded ${conditionData.length} condition occurrences`);
  console.log(`   Loaded ${visitData.length} visits`);

  // For this demo, we'll use:
  // - Treatment: Presence of sepsis (concept_id 132797 for sepsis)
  // - Outcome: Length of stay > median (as a proxy for worse outcomes)

  // Calculate length of stay per visit
  interface VisitWithLOS extends VisitRow {
    los_days: number;
  }

  const visitsWithLOS: VisitWithLOS[] = visitData.map(visit => {
    const startDate = new Date(visit.visit_start_date);
    const endDate = new Date(visit.visit_end_date);
    const losDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return { ...visit, los_days: losDays };
  });

  // Get sepsis patients
  const sepsisConceptIds = [132797, 4011766, 4144583]; // Various sepsis concept IDs
  const sepsisPatients = new Set(
    conditionData
      .filter(row => sepsisConceptIds.includes(Number(row.condition_concept_id)))
      .map(row => row.person_id)
  );

  console.log(`   Found ${sepsisPatients.size} patients with sepsis`);

  // Aggregate by person
  const personVisitsMap = new Map<string, { totalLOS: number; visitCount: number }>();

  for (const visit of visitsWithLOS) {
    const existing = personVisitsMap.get(visit.person_id);
    if (existing) {
      existing.totalLOS += visit.los_days;
      existing.visitCount += 1;
    } else {
      personVisitsMap.set(visit.person_id, { totalLOS: visit.los_days, visitCount: 1 });
    }
  }

  const personVisits: PersonAggregated[] = Array.from(personVisitsMap.entries()).map(
    ([person_id, { totalLOS, visitCount }]) => ({
      person_id,
      avg_los: totalLOS / visitCount,
      visit_count: visitCount,
      treatment: sepsisPatients.has(person_id) ? 1 : 0,
      outcome: 0, // Will be set later
    })
  );

  // Calculate median LOS
  const avgLOSValues = personVisits.map(p => p.avg_los).sort((a, b) => a - b);
  const medianLOS = avgLOSValues[Math.floor(avgLOSValues.length / 2)];

  // Set outcome (above median LOS)
  for (const person of personVisits) {
    person.outcome = person.avg_los > medianLOS ? 1 : 0;
  }

  // Add demographics
  const personDemographicsMap = new Map<string, { gender_concept_id?: string; year_of_birth?: string }>();
  for (const person of personData) {
    personDemographicsMap.set(person.person_id, {
      gender_concept_id: person.gender_concept_id,
      year_of_birth: person.year_of_birth,
    });
  }

  for (const person of personVisits) {
    const demographics = personDemographicsMap.get(person.person_id);
    if (demographics) {
      person.gender_concept_id = demographics.gender_concept_id;
      person.year_of_birth = demographics.year_of_birth;
    }
  }

  console.log(`\n📊 Data summary:`);
  console.log(`   Total patients:     ${personVisits.length}`);
  const treatedCount = personVisits.filter(p => p.treatment === 1).length;
  console.log(`   Treated (sepsis):   ${treatedCount} (${((treatedCount / personVisits.length) * 100).toFixed(1)}%)`);
  const outcomeCount = personVisits.filter(p => p.outcome === 1).length;
  console.log(`   High LOS outcome:   ${outcomeCount} (${((outcomeCount / personVisits.length) * 100).toFixed(1)}%)`);
  console.log(`   Median LOS:         ${medianLOS.toFixed(1)} days`);

  // Convert to format expected by CLI (treatment, outcome, optionally confounders)
  const outputData: OutputRecord[] = personVisits.map(person => ({
    patientId: person.person_id,
    treatment: person.treatment,
    outcome: person.outcome,
    age: person.year_of_birth ? 2180 - Number(person.year_of_birth) : null,
    gender: person.gender_concept_id ? Number(person.gender_concept_id) : null,
    visit_count: person.visit_count,
  }));

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save as JSON
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Saved ${outputData.length} patient records to ${outputFile}`);

  // Also save as CSV for direct CLI use
  const csvFile = outputFile.replace('.json', '.csv');
  const csvContent = stringify(outputData, { header: true });
  fs.writeFileSync(csvFile, csvContent);
  console.log(`💾 Saved CSV to ${csvFile}`);

  return outputData.length;
}

// Main execution
if (require.main === module) {
  const inputDir = process.argv[2] || 'research/data/raw/omop-data/mimic-demo';
  const outputFile = process.argv[3] || 'research/cli-workflows/output/mimic-data.json';

  try {
    const count = prepareMimicData(inputDir, outputFile);
    console.log(`\n✅ Success! Prepared ${count} patient records for causal inference.`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`, error);
    process.exit(1);
  }
}

export { prepareMimicData };
