/**
 * Communication Cost Analysis for Federated Causal Inference
 */

import * as fs from 'fs';
import * as path from 'path';

const scales = [
  { name: '1k', dir: 'federated-partial-id-1k', patients: 1130 },
  { name: '100k', dir: 'federated-partial-id-100k', patients: 235222 },
  { name: '2.8m', dir: 'federated-partial-id-2.8m', patients: 2709803 },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} bytes`;
}

console.log('='.repeat(80));
console.log('COMMUNICATION COST ANALYSIS: Federated vs. Centralized');
console.log('='.repeat(80));
console.log();

const results: any[] = [];

for (const scale of scales) {
  const numCovariates = 20;
  const bytesPerPatient = numCovariates * 8 + 18;
  const centralizedBytes = scale.patients * bytesPerPatient;

  const federatedBytesPerSite = 50; // siteId(20) + bounds(16) + sampleSize(4) + assumption(10)
  const federatedBytes = federatedBytesPerSite * 3; // 3 sites

  const reductionFactor = centralizedBytes / federatedBytes;
  const magnitude =
    reductionFactor > 1e6
      ? `${(reductionFactor / 1e6).toFixed(1)}M×`
      : `${(reductionFactor / 1e3).toFixed(1)}K×`;

  results.push({
    scale: scale.name,
    patients: scale.patients,
    centralized: centralizedBytes,
    federated: federatedBytes,
    reduction: reductionFactor,
    magnitude,
  });

  console.log(`📊 Scale: ${scale.name.toUpperCase()}`);
  console.log(`   Patients: ${scale.patients.toLocaleString()}`);
  console.log(`   Federated: ${federatedBytes} bytes`);
  console.log(`   Centralized: ${formatBytes(centralizedBytes)}`);
  console.log(`   Reduction: ${magnitude}`);
  console.log();
}

console.log('='.repeat(80));
console.log('📋 MARKDOWN TABLE');
console.log('='.repeat(80));
console.log();
console.log('| Scale | Patients | Centralized | Federated | Reduction |');
console.log('|-------|----------|-------------|-----------|-----------|');

for (const r of results) {
  console.log(
    `| ${r.scale.padEnd(5)} | ${r.patients.toLocaleString().padEnd(8)} | ${formatBytes(r.centralized).padEnd(11)} | ${r.federated} bytes | ${r.magnitude.padEnd(9)} |`
  );
}

console.log();

// Save
const outputPath = path.join(__dirname, '../cli-workflows/output/communication-cost-analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`💾 Saved: ${outputPath}`);
