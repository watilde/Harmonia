#!/usr/bin/env ts-node
/**
 * Generate scalability plots using Chart.js (Node.js)
 */

import fs from 'fs';
import path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration, Chart } from 'chart.js';

interface ValidationResult {
  nPatients: number;
  processingTime: number;
  memoryUsed: number;
}

const resultsFile = path.join(
  __dirname,
  '../../../../data/raw/results/large-scale-validation/validation-results.json'
);

function loadResults(): ValidationResult[] {
  if (!fs.existsSync(resultsFile)) {
    console.error('❌ Validation results not found:', resultsFile);
    console.error('   Run (from modules/manski-bounds): npm run data:validate');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resultsFile, 'utf8')) as ValidationResult[];
  return raw;
}

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

function buildScalabilityConfig(
  nPatients: number[],
  times: number[],
  memory: number[]
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: nPatients.map((n) => `${(n / 1000).toFixed(0)}k`),
      datasets: [
        {
          label: 'Processing Time (ms)',
          data: times,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y',
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: 'Memory Used (MB)',
          data: memory,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1',
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: 'Scalability Validation: Processing Time and Memory Usage',
          font: {
            size: 20,
            weight: 'bold',
          },
          padding: 20,
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 14,
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Number of Patients',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          ticks: {
            font: {
              size: 14,
            },
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Processing Time (ms)',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          ticks: {
            font: {
              size: 14,
            },
          },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Memory Used (MB)',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            font: {
              size: 14,
            },
          },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };
}

function buildEfficiencyConfig(
  nPatients: number[],
  perPatientTime: number[]
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: nPatients.map((n) => `${(n / 1000).toFixed(0)}k`),
      datasets: [
        {
          label: 'Per-Patient Time (μs)',
          data: perPatientTime,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: 'Efficiency Improvement per Patient',
          font: {
            size: 20,
            weight: 'bold',
          },
          padding: 20,
        },
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Number of Patients',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          ticks: {
            font: {
              size: 14,
            },
          },
        },
        y: {
          title: {
            display: true,
            text: 'Per-Patient Time (μs)',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          ticks: {
            font: {
              size: 14,
            },
          },
        },
      },
    },
    plugins: [whiteBackgroundPlugin],
  };
}

async function main(): Promise<void> {
  const results = loadResults();
  const nPatients = results.map((r) => r.nPatients);
  const times = results.map((r) => r.processingTime);
  const memory = results.map((r) => r.memoryUsed);

  console.log('📊 Generating scalability validation plot...');
  const scalabilityConfig = buildScalabilityConfig(nPatients, times, memory);
  const scalabilityImage = await chartJSNodeCanvas.renderToBuffer(scalabilityConfig);

  const outputDir = path.join(__dirname, '../../manuscripts/current-paper/figures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const scalabilityFile = path.join(outputDir, 'scalability_validation.png');
  fs.writeFileSync(scalabilityFile, scalabilityImage);
  console.log(`✅ Saved: ${scalabilityFile}`);

  console.log('📊 Generating efficiency improvement plot...');
  const perPatientTime = results.map((r) =>
    Number((r.processingTime / (r.nPatients / 1000)).toFixed(2))
  );
  const efficiencyConfig = buildEfficiencyConfig(nPatients, perPatientTime);
  const efficiencyImage = await chartJSNodeCanvas.renderToBuffer(efficiencyConfig);
  const efficiencyFile = path.join(outputDir, 'efficiency_per_patient.png');
  fs.writeFileSync(efficiencyFile, efficiencyImage);
  console.log(`✅ Saved: ${efficiencyFile}`);
}

main().catch((error) => {
  console.error('❌ Plot generation failed:', error);
  process.exit(1);
});
