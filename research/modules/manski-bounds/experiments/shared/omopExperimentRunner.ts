import fs from 'fs';
import path from 'path';
import {
  computeATEBounds,
  federateATEBounds,
  type ATEBounds,
  type CausalDataPoint,
  type SiteBounds,
} from '../../../../../packages/core/src/causal';

type Assumption = ATEBounds['assumption'];

interface SiteFile {
  metadata: {
    n_patients: number;
    n_treated: number;
    n_control: number;
  };
  patients: CausalDataPoint[];
}

export interface OmopExperimentConfig {
  /** Title used in headers */
  title: string;
  /** Scenario identifier for messaging */
  scenario: string;
  /** Number of federated sites expected */
  numSites: number;
  /** Absolute path to the OMOP site directory */
  dataDir: string;
  /** Output directory for artifacts */
  outputDir: string;
  /** Steps shown when data is missing */
  dataGenerationSteps: string[];
  /** Title for the comparison report */
  comparisonTitle: string;
}

const ASSUMPTIONS: Assumption[] = ['worst-case', 'mtr', 'mts', 'mtr-mts'];
const ASSUMPTION_NOTES: Record<Assumption, string> = {
  'worst-case': 'Widest, always valid',
  mtr: "Assumes treatment doesn't harm",
  mts: 'Accounts for confounding-by-indication',
  'mtr-mts': 'Tightest, both assumptions',
};

interface SiteRecord {
  id: number;
  metadata: SiteFile['metadata'];
  patients: CausalDataPoint[];
}

export async function runOmopExperiment(config: OmopExperimentConfig): Promise<void> {
  printHeader(config);
  const sites = loadSites(config);

  const boundsDir = path.join(config.outputDir, 'bounds');
  const resultsDir = path.join(config.outputDir, 'results');
  resetOutput(config.outputDir, boundsDir, resultsDir);

  const perAssumptionBounds = new Map<Assumption, SiteBounds[]>();

  console.log('Step 2: Computing local bounds under all assumptions...');
  console.log('──────────────────────────────────────────────────────────');

  for (const assumption of ASSUMPTIONS) {
    console.log('');
    console.log(`  Assumption: ${assumption}`);
    console.log('  ─────────────────────────────');

    const boundsForAssumption: SiteBounds[] = [];
    for (const site of sites) {
      console.log(`    Site ${site.id}: Hospital-${site.id}`);
      const bounds = computeATEBounds(site.patients, { assumption });
      const siteBounds: SiteBounds = { ...bounds, siteId: `Hospital-${site.id}` };
      boundsForAssumption.push(siteBounds);

      const destination = path.join(boundsDir, assumption, `site${site.id}-bounds.json`);
      ensureDir(path.dirname(destination));
      fs.writeFileSync(destination, JSON.stringify(siteBounds, null, 2));

      console.log(
        [
          `      Lower bound: ${siteBounds.lower.toFixed(4)}`,
          `Upper bound: ${siteBounds.upper.toFixed(4)}`,
          `Width: ${siteBounds.width.toFixed(4)}`,
        ].join(' | ')
      );
    }

    perAssumptionBounds.set(assumption, boundsForAssumption);
  }

  console.log('');
  console.log('Step 3: Federating bounds under all assumptions...');
  console.log('──────────────────────────────────────────────────────────');

  const federatedResults = new Map<Assumption, ATEBounds>();

  for (const assumption of ASSUMPTIONS) {
    console.log('');
    console.log(`  Assumption: ${assumption}`);
    console.log('  ─────────────────────────────');
    const siteBounds = perAssumptionBounds.get(assumption) ?? [];
    const federated = federateATEBounds(siteBounds, { strategy: 'weighted-average' });

    console.log(`    strategy: ${federated.strategy}`);
    console.log(`    Federated lower: ${federated.lower.toFixed(4)}`);
    console.log(`    Federated upper: ${federated.upper.toFixed(4)}`);
    console.log(`    Federated width: ${federated.width.toFixed(4)}`);

    const outputFile = path.join(resultsDir, assumption, 'federated.json');
    ensureDir(path.dirname(outputFile));
    fs.writeFileSync(outputFile, JSON.stringify(federated, null, 2));
    federatedResults.set(assumption, {
      assumption,
      lower: federated.lower,
      upper: federated.upper,
      width: federated.width,
      sampleSize: federated.totalSampleSize,
    });
  }

  console.log('');
  console.log('Step 4: Generating comparison report...');
  console.log('──────────────────────────────────────────────────────────');

  writeComparisonReport(config, federatedResults);
  console.log(fs.readFileSync(path.join(config.outputDir, 'comparison.txt'), 'utf-8'));

  console.log('');
  console.log('✅ Analysis complete!');
  console.log('');
  console.log(`Results saved to: ${config.outputDir}`);
  console.log('  - bounds/<assumption>/        : Local bounds per site');
  console.log('  - results/<assumption>/       : Federated results');
  console.log('  - comparison.txt              : Summary comparison');
  console.log('');
}

function printHeader(config: OmopExperimentConfig): void {
  console.log('==========================================================');
  console.log(config.title);
  console.log('Multi-Assumption Analysis with OMOP Data');
  console.log('==========================================================');
  console.log('');
  console.log('Configuration:');
  console.log('  Data source:  OMOP CDM synthetic patients');
  console.log(`  Sites:        ${config.numSites}`);
  console.log('  Assumptions:  All 4 levels (worst-case, MTR, MTS, MTR+MTS)');
  console.log('');
}

function loadSites(config: OmopExperimentConfig): SiteRecord[] {
  if (!fs.existsSync(config.dataDir)) {
    const instructions = config.dataGenerationSteps.map((step) => `   ${step}`).join('\n');
    throw new Error(
      [
        `OMOP data not found at ${config.dataDir}`,
        'Please run data generation first:',
        instructions,
      ].join('\n')
    );
  }

  console.log(`Step 1: Verifying OMOP data for ${config.numSites} hospitals...`);
  console.log('──────────────────────────────────────────────────────────');

  const sites: SiteRecord[] = [];

  for (let site = 1; site <= config.numSites; site++) {
    const filePath = path.join(config.dataDir, `site${site}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing data for site ${site}: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as SiteFile;
    const { n_patients, n_treated, n_control } = parsed.metadata;
    console.log(
      `  Site ${site}: ${n_patients} patients (${n_treated} treated, ${n_control} control)`
    );
    sites.push({ id: site, metadata: parsed.metadata, patients: parsed.patients });
  }

  console.log('');
  return sites;
}

function resetOutput(dir: string, boundsDir: string, resultsDir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(boundsDir);
  ensureDir(resultsDir);

  for (const assumption of ASSUMPTIONS) {
    ensureDir(path.join(boundsDir, assumption));
    ensureDir(path.join(resultsDir, assumption));
  }
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeComparisonReport(
  config: OmopExperimentConfig,
  results: Map<Assumption, ATEBounds>
): void {
  const comparisonPath = path.join(config.outputDir, 'comparison.txt');
  const lines = [
    '========================================================================',
    config.comparisonTitle,
    '========================================================================',
    '',
    'Assumption    Lower Bound   Upper Bound   Width      Notes',
    '------------------------------------------------------------------------',
  ];

  for (const assumption of ASSUMPTIONS) {
    const result = results.get(assumption);
    if (!result) {
      continue;
    }

    lines.push(
      `${assumption.padEnd(12)}  ${formatSigned(result.lower)}      ${formatSigned(
        result.upper
      )}      ${result.width.toFixed(4).padEnd(8)} ${ASSUMPTION_NOTES[assumption]}`
    );
  }

  lines.push(
    '------------------------------------------------------------------------',
    '',
    'Interpretation:',
    '- OMOP data reflects realistic EHR patterns with confounding-by-indication',
    '- MTS assumption is most appropriate for observational healthcare data',
    '- Width measures informativeness (smaller = more informative)',
    '- All bounds should contain true causal effect for valid inference',
    '',
    'Note: This analysis uses OMOP CDM-structured synthetic patient data',
    '      generated with realistic clinical confounding patterns.',
    '========================================================================',
    ''
  );

  fs.writeFileSync(comparisonPath, lines.join('\n'));
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`.padEnd(10);
}
