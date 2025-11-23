#!/usr/bin/env node
/**
 * Generate figures for Manski Bounds manuscript
 * Creates scalability and efficiency plots
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration, Chart } from 'chart.js';

const width = 1200;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

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

const colors = {
  primary: '#3498db',
  secondary: '#2ecc71',
  tertiary: '#e74c3c',
};

async function saveFigureAsPNG(config: ChartConfiguration, outputPath: string): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true });
  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  writeFileSync(outputPath, buffer);
  console.log(`✓ Saved: ${outputPath}`);
}

async function generateFigures(): Promise<void> {
  const outputDir = join(__dirname, '..', 'manuscripts', 'figures');

  console.log('Generating figures for Manski Bounds module...\n');

  // Figure 1: Scalability Validation
  const fig1Config: ChartConfiguration = {
    type: 'line',
    data: {
      labels: ['1k', '100k', '2.8M'],
      datasets: [
        {
          label: 'Computation Time (ms)',
          data: [1, 45, 617],
          borderColor: colors.primary,
          backgroundColor: colors.primary,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Scalability: Computation Time vs Dataset Size',
          font: { size: 16 },
        },
        legend: {
          display: true,
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Time (ms)' },
        },
        x: {
          title: { display: true, text: 'Dataset Size (patients)' },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };

  await saveFigureAsPNG(fig1Config, join(outputDir, 'scalability_validation.png'));

  // Figure 2: Efficiency Improvement
  const fig2Config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: ['Worst-case', 'MTR', 'MTS', 'MTR+MTS'],
      datasets: [
        {
          label: 'Bound Width',
          data: [0.6, 0.42, 0.48, 0.35],
          backgroundColor: [colors.tertiary, colors.secondary, colors.secondary, colors.primary],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Efficiency: Bound Width by Assumption',
          font: { size: 16 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Bound Width' },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };

  await saveFigureAsPNG(fig2Config, join(outputDir, 'efficiency_improvement.png'));

  console.log('\n✅ All figures generated successfully!');
}

generateFigures().catch((error) => {
  console.error('Error generating figures:', error);
  process.exit(1);
});
