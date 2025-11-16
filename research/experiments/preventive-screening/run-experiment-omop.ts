#!/usr/bin/env ts-node
import path from 'path';
import { runOmopExperiment } from '../shared/omopExperimentRunner';

const scriptDir = __dirname;

runOmopExperiment({
  title: 'Preventive Screening Study',
  scenario: 'screening',
  numSites: 5,
  dataDir: path.join(scriptDir, 'data/omop'),
  outputDir: path.join(scriptDir, 'output-omop'),
  dataGenerationSteps: [
    '1. Generate data: python3 research/causal-inference/data-generation/synthea/generate-omop-data.py --scenario screening --n-patients 6000',
    '2. Split data: python3 research/causal-inference/data-generation/split-omop-data.py --input output/screening/screening/causal-data.json --output-dir research/experiments/preventive-screening/data/omop --num-sites 5',
  ],
  comparisonTitle: 'Preventive Screening Study - OMOP Data - Assumption Comparison',
}).catch((error) => {
  console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
