#!/usr/bin/env ts-node
import path from 'path';
import { runOmopExperiment } from '../shared/omopExperimentRunner';

const scriptDir = __dirname;

runOmopExperiment({
  title: 'Diabetes Medication Effectiveness Study',
  scenario: 'diabetes',
  numSites: 3,
  dataDir: path.join(scriptDir, 'data/omop'),
  outputDir: path.join(scriptDir, 'output-omop'),
  dataGenerationSteps: [
    '1. Generate data: python3 research/causal-inference/data-generation/synthea/generate-omop-data.py --scenario diabetes --n-patients 1000',
    '2. Split data: python3 research/causal-inference/data-generation/split-omop-data.py --input output/diabetes/causal-data.json --output-dir research/experiments/diabetes-medication/data/omop --num-sites 3',
  ],
  comparisonTitle: 'Diabetes Study - OMOP Data - Assumption Comparison',
}).catch((error) => {
  console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
