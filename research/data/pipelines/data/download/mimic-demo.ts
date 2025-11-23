#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const BASE_URL = 'https://physionet.org/files/mimic-iv-demo-omop/0.9/1_omop_data_csv';
const TABLES = [
  'person',
  'visit_occurrence',
  'visit_detail',
  'condition_occurrence',
  'drug_exposure',
  'procedure_occurrence',
  'device_exposure',
  'measurement',
  'observation',
  'death',
  'note',
  'note_nlp',
  'specimen',
  'fact_relationship',
  'location',
  'care_site',
  'provider',
  'payer_plan_period',
  'cost',
  'drug_era',
  'dose_era',
  'condition_era',
  'cdm_source',
  'vocabulary',
  'concept',
  'concept_relationship',
  'concept_ancestor',
  'concept_synonym',
  'concept_class',
  'domain',
  'relationship',
];
const ESSENTIAL_TABLES = [
  'person',
  'visit_occurrence',
  'condition_occurrence',
  'drug_exposure',
  'measurement',
  'observation',
];

const repoRoot = path.resolve(__dirname, '../../../..');
const dataDir = path.join(repoRoot, 'data/raw/omop-data/mimic-demo');

type DownloadTool = 'wget' | 'curl';

async function main(): Promise<void> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MIMIC-IV Demo OMOP CDM Data Download');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`${COLORS.blue}Dataset:${COLORS.reset}  MIMIC-IV demo in OMOP CDM v5.3`);
  console.log(
    `${COLORS.blue}Source:${COLORS.reset}   PhysioNet (https://doi.org/10.13026/p1f5-7x35)`
  );
  console.log(`${COLORS.blue}Size:${COLORS.reset}     ~100 ICU patients (demo subset)`);
  console.log(`${COLORS.blue}Output:${COLORS.reset}   ${dataDir}`);
  console.log('');

  fs.mkdirSync(dataDir, { recursive: true });

  const rl = createInterface({ input, output });

  try {
    if (fs.existsSync(path.join(dataDir, 'person.csv'))) {
      const reuse = await promptYesNo(
        rl,
        `${COLORS.yellow}⚠️  Data already exists in ${dataDir}${COLORS.reset}\n   Do you want to re-download? (y/N): `
      );
      if (!reuse) {
        console.log(`${COLORS.green}✓ Using existing data${COLORS.reset}`);
        await summarize();
        return;
      }
      console.log('   Removing existing data...');
      for (const file of fs.readdirSync(dataDir)) {
        fs.rmSync(path.join(dataDir, file), { recursive: true, force: true });
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Download Information');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`${COLORS.green}✓ Public Access Available${COLORS.reset}`);
    console.log('  MIMIC-IV Demo OMOP CDM data is publicly accessible via HTTPS.');
    console.log('  No PhysioNet credentials required for demo dataset.');
    console.log('');
    console.log(`${COLORS.blue}Note:${COLORS.reset} Full MIMIC-IV requires credentialing.`);
    console.log('  Demo: 100 patients (no credentials needed)');
    console.log('  Full: 50,000+ patients (requires PhysioNet account + CITI training)');
    console.log('');

    const downloadTool = detectDownloadTool();
    await performDownload(downloadTool);
    await summarize();
  } finally {
    rl.close();
  }
}

function detectDownloadTool(): DownloadTool {
  if (commandExists('wget')) {
    return 'wget';
  }
  if (commandExists('curl')) {
    return 'curl';
  }
  throw new Error('Neither wget nor curl is available on this system.');
}

function commandExists(cmd: string): boolean {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

async function promptYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string
): Promise<boolean> {
  const answer = (await rl.question(question)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function performDownload(tool: DownloadTool): Promise<void> {
  console.log('');
  console.log(`${COLORS.blue}Direct Download Selected${COLORS.reset}`);
  console.log('');

  let success = 0;
  let failure = 0;

  for (const table of TABLES) {
    const fileName = `${table}.csv`;
    const url = `${BASE_URL}/${fileName}`;
    process.stdout.write(`  Downloading ${fileName}... `);
    const ok = await downloadFile(tool, url, path.join(dataDir, fileName));
    if (ok) {
      success += 1;
      process.stdout.write(`${COLORS.green}✓${COLORS.reset}\n`);
    } else {
      failure += 1;
      process.stdout.write(`${COLORS.yellow}⚠ Not available${COLORS.reset}\n`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Download Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  Successfully downloaded: ${success} files`);
  console.log(`  Not available/optional:  ${failure} files`);
  console.log('');

  if (success === 0) {
    throw new Error(
      'No tables were downloaded. Please check your internet connection and try again.'
    );
  }

  for (const table of ESSENTIAL_TABLES) {
    if (!fs.existsSync(path.join(dataDir, `${table}.csv`))) {
      throw new Error(`Missing essential table: ${table}.csv`);
    }
  }

  console.log(`${COLORS.green}✓ Download complete!${COLORS.reset}`);
  console.log('');
}

function downloadFile(tool: DownloadTool, url: string, destination: string): Promise<boolean> {
  return new Promise((resolve) => {
    const args =
      tool === 'wget' ? ['-q', '-O', destination, url] : ['-f', '-s', '-L', url, '-o', destination];

    const child = spawn(tool, args, { stdio: 'ignore' });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function summarize(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Downloaded Files');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith('.csv'))
    .map((file) => {
      const stats = fs.statSync(path.join(dataDir, file));
      return { name: file, size: formatFileSize(stats.size) };
    });

  for (const file of files) {
    console.log(`  ${file.name} (${file.size})`);
  }
  console.log('');

  const personPath = path.join(dataDir, 'person.csv');
  if (fs.existsSync(personPath)) {
    const patientCount = await countCsvRows(personPath);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Dataset Information');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`  Patients: ${patientCount}`);
    console.log('  Format:   OMOP CDM v5.3');
    console.log('  Source:   MIMIC-IV demo');
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Next Steps');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('1. Prepare data for causal inference:');
  console.log('   cd research/cli-workflows');
  console.log('   python3 prepare-mimic-data.py \\');
  console.log('     ../data/raw/omop-data/mimic-demo \\');
  console.log('     output/mimic/mimic-data.json');
  console.log('');
  console.log('2. Run causal inference analysis:');
  console.log('   # Compute partial identification bounds');
  console.log('   npx harmonia causal compute-bounds \\');
  console.log('     --data output/mimic/mimic-data.json \\');
  console.log('     --assumption mtr \\');
  console.log('     --output output/mimic/bounds.json');
  console.log('');
  console.log('   # Diagnose causal assumptions');
  console.log('   npx harmonia causal diagnose-assumptions \\');
  console.log('     --data-file output/mimic/mimic-data.json \\');
  console.log('     --format table');
  console.log('');
  console.log('   # Compute E-values for sensitivity analysis');
  console.log('   npx harmonia causal compute-evalue \\');
  console.log('     --bounds-file output/mimic/bounds.json \\');
  console.log('     --baseline-risk 0.44 \\');
  console.log('     --format table');
  console.log('');
  console.log('3. See documentation:');
  console.log('   cat research/cli-workflows/MIMIC_TEST_RESULTS.md');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`${COLORS.green}✓ Setup complete!${COLORS.reset}`);
  console.log('');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function countCsvRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\n') {
          count += 1;
        }
      }
    });
    stream.on('end', () => resolve(Math.max(count - 1, 0)));
  });
}

main().catch((error) => {
  console.error(
    `${COLORS.red}✗ Error:${COLORS.reset} ${error instanceof Error ? error.message : error}`
  );
  process.exit(1);
});
