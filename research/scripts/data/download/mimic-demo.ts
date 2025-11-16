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

const BASE_URL = 'https://physionet.org/files/mimic-iv-demo-omop/0.9';
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
  'metadata',
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
const ESSENTIAL_TABLES = ['person', 'visit_occurrence', 'condition_occurrence'];

const repoRoot = path.resolve(__dirname, '../../../..');
const dataDir = path.join(repoRoot, 'research/data-generation/omop-data/mimic-demo');

type DownloadTool = 'wget' | 'curl';

async function main(): Promise<void> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MIMIC-IV Demo OMOP CDM Data Download');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`${COLORS.blue}Dataset:${COLORS.reset}  MIMIC-IV demo in OMOP CDM v5.3`);
  console.log(`${COLORS.blue}Source:${COLORS.reset}   PhysioNet (https://doi.org/10.13026/p1f5-7x35)`);
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

    printCredentialNotice();

    const downloadTool = detectDownloadTool();
    const option = await promptMenu(rl);

    switch (option) {
      case '1':
        await performDownload(downloadTool);
        await summarize();
        break;
      case '2':
        printManualInstructions();
        break;
      default:
        console.log('');
        console.log('Download cancelled.');
    }
  } finally {
    rl.close();
  }
}

function printCredentialNotice(): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PhysioNet Access Requirements');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('This dataset requires PhysioNet credentialing:');
  console.log('');
  console.log('1. Create account: https://physionet.org/register/');
  console.log('2. Complete CITI training: https://physionet.org/about/citi-course/');
  console.log('3. Request access: https://physionet.org/content/mimic-iv-demo-omop/0.9/');
  console.log('4. Accept data use agreement');
  console.log('');
  console.log(`${COLORS.yellow}Note:${COLORS.reset} The demo dataset is publicly available after credentialing.`);
  console.log('');
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

async function promptYesNo(rl: ReturnType<typeof createInterface>, question: string): Promise<boolean> {
  const answer = (await rl.question(question)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function promptMenu(rl: ReturnType<typeof createInterface>): Promise<string> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Download Method');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Choose download method:');
  console.log('');
  console.log('  1) Direct download (requires PhysioNet credentials)');
  console.log('  2) Manual instructions (for credentialed access)');
  console.log('  3) Cancel');
  console.log('');
  const answer = (await rl.question('Select option [1-3]: ')).trim();
  if (['1', '2', '3'].includes(answer)) {
    return answer;
  }
  return '3';
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
      'No tables were downloaded. Please ensure your PhysioNet credentials are configured or use the manual instructions.'
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
      tool === 'wget'
        ? ['-q', '-O', destination, url]
        : ['-f', '-s', '-L', url, '-o', destination];

    const child = spawn(tool, args, { stdio: 'ignore' });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

function printManualInstructions(): void {
  console.log('');
  console.log(`${COLORS.blue}Manual Download Instructions${COLORS.reset}`);
  console.log('');
  console.log('1. Visit: https://physionet.org/content/mimic-iv-demo-omop/0.9/');
  console.log('2. Log in with PhysioNet credentials');
  console.log('3. Accept the data use agreement (if not already done)');
  console.log(`4. Download and extract CSV files to: ${dataDir}`);
  console.log('');
  console.log('Required files (essential): person, visit_occurrence, condition_occurrence,');
  console.log('drug_exposure, procedure_occurrence, measurement');
  console.log('');
  console.log('You can also use wget with credentials:');
  console.log('');
  console.log('  wget -r -N -c -np --user=USERNAME --ask-password \\');
  console.log('    https://physionet.org/files/mimic-iv-demo-omop/0.9/ \\');
  console.log(`    -P ${dataDir}`);
  console.log('');
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
  console.log('1. Split data into federated sites:');
  console.log('   cd research/data-generation');
  console.log('   npm install  # if not already done');
  console.log('   npx ts-node research/scripts/data/split/split-omop-csv.ts \\');
  console.log('     --input omop-data/mimic-demo/ \\');
  console.log('     --output splits/mimic-demo/ \\');
  console.log('     --num-sites 3 \\');
  console.log('     --scenario icu');
  console.log('');
  console.log('2. Run experiments:');
  console.log('   cd research/experiments');
  console.log('   npx ts-node icu-intervention/run-experiment-omop.ts');
  console.log('');
  console.log('3. View results:');
  console.log('   cat ../data-generation/results/mimic-demo/icu/comparison.txt');
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
  console.error(`${COLORS.red}✗ Error:${COLORS.reset} ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
