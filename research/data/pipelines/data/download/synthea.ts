#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { promises as fsp } from 'fs';
import { spawn, spawnSync } from 'child_process';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const S3_BUCKET = 's3://synthea-omop';
const S3_NO_SIGN = '--no-sign-request';
const SCALES = ['1k', '100k', '2.3m'] as const;
type Scale = (typeof SCALES)[number];

interface CliOptions {
  listOnly: boolean;
  force: boolean;
  verify: boolean;
  scales: Scale[];
}

const repoRoot = path.resolve(__dirname, '../../../../..');

async function main(): Promise<void> {
  process.chdir(repoRoot);
  const options = parseArgs(process.argv.slice(2));

  if (options.listOnly) {
    ensureAwsCli();
    await listS3Data();
    return;
  }

  ensureAwsCli();
  const lzopAvailable = checkLzop();

  console.log('');
  console.log('================================================');
  console.log('📦 Synthea Data Downloader from S3');
  console.log('================================================');
  console.log('');
  console.log(`S3 Bucket: ${S3_BUCKET}/ (AWS Open Data Registry - Public)`);
  console.log(`Scales: ${options.scales.join(', ')}`);
  console.log(`Force: ${options.force}`);
  console.log('Authentication: Not required (public bucket)');
  console.log('');

  let success = 0;
  let failure = 0;

  for (const scale of options.scales) {
    const ok = await downloadScale(scale, options.force, lzopAvailable);
    if (ok) {
      success += 1;
    } else {
      failure += 1;
    }
  }

  console.log('================================================');
  console.log('');
  if (failure === 0) {
    console.log(`${COLORS.green}✅ All downloads completed successfully!${COLORS.reset}`);
    console.log(`   Downloaded: ${success}/${options.scales.length} scales`);
  } else {
    console.log(`${COLORS.yellow}⚠️  Some downloads failed${COLORS.reset}`);
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failure}`);
    process.exitCode = 1;
  }

  console.log('');
  console.log('📁 Data location: research/data/raw/omop-data/');
  console.log('');
  console.log('🚀 Next steps:');
  console.log('   1. Run validation:');
  console.log('      npx ts-node research/data/pipelines/validation/large-scale.ts');
  console.log('');
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    listOnly: false,
    force: false,
    verify: true,
    scales: [],
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--list') {
      options.listOnly = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--no-verify') {
      options.verify = false;
    } else if ((SCALES as readonly string[]).includes(arg)) {
      options.scales.push(arg as Scale);
    } else {
      console.error(`${COLORS.red}Unknown option:${COLORS.reset} ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!options.listOnly && options.scales.length === 0) {
    options.scales = [...SCALES];
  }

  return options;
}

function printHelp(): void {
  console.log(`📦 Download Pre-generated Synthea Data from S3

Usage:
  npx ts-node research/data/pipelines/data/download/synthea.ts [options] [scales...]

Options:
  --help, -h          Show this help message
  --list              List available scales in S3
  --force             Overwrite existing data
  --no-verify         Skip post-download verification

Scales:
  ${SCALES.join(', ')} (default: all)
`);
}

function ensureAwsCli(): void {
  const result = spawnSync('aws', ['--version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    console.error(`${COLORS.red}❌ AWS CLI not installed.${COLORS.reset}`);
    console.error('Install instructions: https://aws.amazon.com/cli/');
    process.exit(1);
  }
}

function checkLzop(): boolean {
  const result = spawnSync('lzop', ['--version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    console.log(
      `${COLORS.yellow}⚠️  lzop not found - skipping automatic LZO decompression${COLORS.reset}`
    );
    return false;
  }
  console.log(`${COLORS.green}✅ lzop found${COLORS.reset}`);
  return true;
}

async function listS3Data(): Promise<void> {
  console.log(`${COLORS.blue}📋 Listing available data in S3...${COLORS.reset}`);
  console.log('');
  await runCommand('aws', [
    's3',
    'ls',
    S3_NO_SIGN,
    `${S3_BUCKET}/`,
    '--recursive',
    '--human-readable',
  ]);
}

async function downloadScale(
  scale: Scale,
  force: boolean,
  lzopAvailable: boolean
): Promise<boolean> {
  const s3Scale = scale === '2.3m' ? '23m' : scale;
  const outputDir = path.join(repoRoot, 'research/data/raw/omop-data', `synthea${scale}`);
  const s3Path = `${S3_BUCKET}/synthea${s3Scale}/`;

  console.log(`${COLORS.blue}📦 Downloading ${scale} dataset...${COLORS.reset}`);

  if (fs.existsSync(outputDir)) {
    if (!force) {
      console.log(
        `${COLORS.yellow}⚠️  ${outputDir} already exists. Skipping (use --force to overwrite).${COLORS.reset}`
      );
      return true;
    }
    await fsp.rm(outputDir, { recursive: true, force: true });
  }

  await fsp.mkdir(outputDir, { recursive: true });
  console.log(`   Source: ${s3Path}`);
  console.log(`   Target: ${outputDir}`);

  if (scale === '2.3m') {
    console.log('   ⏳ Large download (~1.5GB, 40+ files)...');
  }

  const awsFlags =
    scale === '2.3m' ? [S3_NO_SIGN] : [S3_NO_SIGN, '--only-show-errors', '--no-progress'];

  const args = ['s3', 'sync', ...awsFlags, s3Path, outputDir];

  const ok = await runCommand('aws', args);
  if (!ok) {
    console.log(`${COLORS.red}   ❌ Download failed${COLORS.reset}`);
    return false;
  }

  console.log(`${COLORS.green}   ✅ Downloaded successfully${COLORS.reset}`);

  const hasLzo = await hasFiles(outputDir, (file) => file.endsWith('.lzo'));
  if (hasLzo) {
    console.log(`${COLORS.blue}   🔓 Decompressing LZO files...${COLORS.reset}`);
    if (lzopAvailable) {
      await decompressLzo(outputDir);
    } else {
      console.log('   lzop not installed, leaving .lzo files untouched');
    }
  }

  const hasSplit = await hasFiles(outputDir, (file) => /\.csv\.\d+$/.test(file));
  if (hasSplit) {
    console.log(`${COLORS.blue}   🔗 Merging split CSV files...${COLORS.reset}`);
    await mergeSplitFiles(outputDir);
  }

  const csvFiles = await collectFiles(
    outputDir,
    (file) => file.endsWith('.csv') && !/\.csv\.\d+$/.test(file)
  );
  if (csvFiles.length === 0) {
    console.log(`${COLORS.yellow}   ⚠️  Warning: No CSV files found${COLORS.reset}`);
  } else {
    console.log(`${COLORS.green}   ✅ Verified: ${csvFiles.length} CSV files${COLORS.reset}`);
    const personFile =
      csvFiles.find((file) => path.basename(file).toLowerCase() === 'person.csv') ?? null;
    if (personFile) {
      const count = await countCsvRows(personFile);
      console.log('   📊 Summary:');
      console.log(`      Patients: ${count}`);
      console.log(`      Files: ${csvFiles.length} CSV tables`);
    }
  }

  console.log('');
  return true;
}

async function hasFiles(dir: string, predicate: (file: string) => boolean): Promise<boolean> {
  let found = false;
  await walkDirectory(dir, async (filePath) => {
    if (predicate(filePath)) {
      found = true;
      return true;
    }
    return false;
  });
  return found;
}

async function collectFiles(dir: string, predicate: (file: string) => boolean): Promise<string[]> {
  const files: string[] = [];
  await walkDirectory(dir, async (filePath) => {
    if (predicate(filePath)) {
      files.push(filePath);
    }
    return false;
  });
  return files;
}

async function walkDirectory(
  dir: string,
  visitor: (filePath: string) => Promise<boolean> | boolean
): Promise<void> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, visitor);
    } else {
      const stop = await visitor(fullPath);
      if (stop) {
        return;
      }
    }
  }
}

async function decompressLzo(dir: string): Promise<void> {
  const lzoFiles = await collectFiles(dir, (file) => file.endsWith('.lzo'));
  let count = 0;
  for (const file of lzoFiles) {
    const ok = await runCommand('lzop', ['-d', file], { stdio: 'ignore' });
    if (ok) {
      count += 1;
    }
  }
  console.log(`${COLORS.green}   ✅ Decompressed ${count} files${COLORS.reset}`);
}

async function mergeSplitFiles(dir: string): Promise<void> {
  const splitFiles = await collectFiles(dir, (file) => /\.csv\.\d+$/.test(file));
  const buckets = new Map<string, string[]>();

  for (const file of splitFiles) {
    const base = file.replace(/\.\d+$/, '');
    const list = buckets.get(base) ?? [];
    list.push(file);
    buckets.set(base, list);
  }

  for (const [base, files] of buckets.entries()) {
    files.sort((a, b) => {
      const numA = parseInt(a.split('.').pop() ?? '0', 10);
      const numB = parseInt(b.split('.').pop() ?? '0', 10);
      return numA - numB;
    });

    const output = base;
    await fsp.copyFile(files[0], output);
    for (const file of files.slice(1)) {
      const content = await fsp.readFile(file, 'utf-8');
      const trimmed = content.split('\n').slice(1).join('\n');
      await fsp.appendFile(output, `\n${trimmed}`);
    }

    for (const file of files) {
      await fsp.rm(file, { force: true });
    }
  }

  console.log(`${COLORS.green}   ✅ Merged ${buckets.size} split files${COLORS.reset}`);
}

async function countCsvRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\n') count += 1;
      }
    });
    stream.on('end', () => resolve(Math.max(count - 1, 0)));
  });
}

function runCommand(
  command: string,
  args: string[],
  options: { stdio?: 'ignore' } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
    });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

main().catch((error) => {
  console.error(
    `${COLORS.red}❌ Error:${COLORS.reset} ${error instanceof Error ? error.message : error}`
  );
  process.exit(1);
});
