#!/usr/bin/env node
/**
 * Generate figures for Federated Partial Identification manuscript
 * Module 1: Optimal weighting strategies for federated bounds
 *
 * Creates publication-quality graphs for research paper
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration, Chart } from 'chart.js';

// Chart dimensions for publication quality
const width = 1200;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// White background plugin for clean PDFs/PNGs
const whiteBackgroundPlugin = {
  id: 'background',
  beforeDraw: (chart: Chart) => {
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

// Color palette (color-blind friendly)
const colors = {
  green: '#2ecc71',
  blue: '#3498db',
  red: '#e74c3c',
  gray: '#95a5a6',
  orange: '#f39c12',
  purple: '#9b59b6',
};

/**
 * Save Chart.js figure as PNG
 */
async function saveFigureAsPNG(config: ChartConfiguration, outputPath: string): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true });
  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  writeFileSync(outputPath, buffer);
}

async function generateFigures(): Promise<void> {
  const outputDir = join(__dirname, '..', 'manuscripts');
  console.log('Generating Module 1 (Federated Partial Identification) figures...');

  // Figure 1: Bound Width by Aggregation Strategy
  const fig1Config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: ['Inverse-width', 'Uniform', 'Sample-size', 'Conservative'],
      datasets: [
        {
          label: 'Bound Width',
          data: [0.4793, 0.4794, 0.4814, 0.4898],
          backgroundColor: [colors.green, colors.blue, colors.red, colors.gray],
          borderColor: 'black',
          borderWidth: 2,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: [
            'Figure 1: Bound Width by Aggregation Strategy',
            '(Imbalanced Sites: n=100, 334, 1000)',
          ],
          font: { size: 18, weight: 'bold' },
          padding: 20,
        },
        legend: { display: false },
      },
      scales: {
        x: {
          title: { display: true, text: 'Bound Width', font: { size: 16, weight: 'bold' } },
          grid: { color: '#e0e0e0' },
        },
        y: {
          title: { display: false },
          ticks: { font: { size: 14 } },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };

  await saveFigureAsPNG(fig1Config, join(outputDir, 'figure1.png'));
  console.log('  ✓ figure1.png');

  // Figure 2: Monte Carlo Validation
  const fig2Config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: ['Sample-size', 'Inverse-width', 'Conservative', 'Uniform'],
      datasets: [
        {
          label: 'Coverage (%)',
          data: [95.2, 95.4, 98.1, 94.8],
          backgroundColor: colors.blue,
          borderColor: 'black',
          borderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Mean Width',
          data: [0.482, 0.479, 0.49, 0.48],
          backgroundColor: colors.red,
          borderColor: 'black',
          borderWidth: 2,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: ['Figure 2: Monte Carlo Validation (1,000 Iterations)', 'Coverage vs Bound Width'],
          font: { size: 18, weight: 'bold' },
          padding: 20,
        },
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 14 } },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Aggregation Strategy',
            font: { size: 16, weight: 'bold' },
          },
          ticks: { font: { size: 14 } },
        },
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Coverage (%)',
            font: { size: 16, weight: 'bold' },
            color: colors.blue,
          },
          min: 90,
          max: 100,
          grid: { color: '#e0e0e0' },
          ticks: { font: { size: 14 } },
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Mean Width',
            font: { size: 16, weight: 'bold' },
            color: colors.red,
          },
          min: 0.47,
          max: 0.5,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 14 } },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };

  await saveFigureAsPNG(fig2Config, join(outputDir, 'figure2.png'));
  console.log('  ✓ figure2.png');

  // Figure 3: 10-Hospital Vasopressor Study
  const hospitals = [
    'Academic 1',
    'Academic 2',
    'Academic 3',
    'Academic 4',
    'Community 1',
    'Community 2',
    'Community 3',
    'Community 4',
    'Community 5',
    'Community 6',
  ];
  const lowerBounds = [0.12, 0.11, 0.13, 0.12, 0.08, 0.07, 0.09, 0.06, 0.08, 0.1];
  const upperBounds = [0.38, 0.37, 0.39, 0.38, 0.42, 0.43, 0.41, 0.44, 0.42, 0.4];

  const fig3Config: ChartConfiguration = {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Lower Bound',
          data: lowerBounds.map((val, idx) => ({ x: idx, y: val })),
          backgroundColor: hospitals.map((_, i) => (i < 4 ? colors.green : colors.red)),
          borderColor: 'black',
          borderWidth: 2,
          pointStyle: 'triangle',
          pointRadius: 10,
          rotation: 180,
        },
        {
          label: 'Upper Bound',
          data: upperBounds.map((val, idx) => ({ x: idx, y: val })),
          backgroundColor: hospitals.map((_, i) => (i < 4 ? colors.green : colors.red)),
          borderColor: 'black',
          borderWidth: 2,
          pointStyle: 'triangle',
          pointRadius: 10,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: ['Figure 3: 10-Hospital Vasopressor Study', 'MTR Bounds by Site'],
          font: { size: 18, weight: 'bold' },
          padding: 20,
        },
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 14 } },
        },
      },
      scales: {
        x: {
          type: 'category',
          labels: hospitals,
          title: { display: true, text: 'Hospital', font: { size: 16, weight: 'bold' } },
          ticks: { font: { size: 12 }, maxRotation: 45, minRotation: 45 },
        },
        y: {
          title: {
            display: true,
            text: 'Vasopressor Effect Bounds',
            font: { size: 16, weight: 'bold' },
          },
          grid: { color: '#e0e0e0' },
          ticks: { font: { size: 14 } },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };

  await saveFigureAsPNG(fig3Config, join(outputDir, 'figure3.png'));
  console.log('  ✓ figure3.png');

  console.log(`\n✅ All Module 1 figures saved to: ${outputDir}`);
}

// Run if executed directly
if (require.main === module) {
  generateFigures().catch((error) => {
    console.error('Error generating figures:', error);
    process.exit(1);
  });
}

export { generateFigures };
