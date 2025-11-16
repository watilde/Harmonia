#!/usr/bin/env ts-node
import path from 'path';
import { runOmopExperiment } from '../shared/omopExperimentRunner';

const scriptDir = __dirname;

runOmopExperiment({
  title: 'ICU Early Intervention Study',
  scenario: 'icu',
  numSites: 4,
  dataDir: path.join(scriptDir, 'data/omop'),
  outputDir: path.join(scriptDir, 'output-omop'),
  dataGenerationSteps: [
    '1. Generate data: python3 research/causal-inference/data-generation/synthea/generate-omop-data.py --scenario icu --n-patients 3200',
    '2. Split data: python3 research/causal-inference/data-generation/split-omop-data.py --input output/icu/icu/causal-data.json --output-dir research/modules/manski-bounds/experiments/icu-intervention/data/omop --num-sites 4',
  ],
  comparisonTitle: 'ICU Intervention Study - OMOP Data - Assumption Comparison',
}).catch((error) => {
  console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
