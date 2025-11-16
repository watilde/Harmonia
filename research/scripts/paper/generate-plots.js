#!/usr/bin/env node
/**
 * Generate scalability plots using Chart.js (Node.js)
 * Replaces Python matplotlib script
 */

const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// Load validation results
const resultsFile = path.join(
  __dirname,
  '../../data-generation/results/large-scale-validation/validation-results.json'
);

if (!fs.existsSync(resultsFile)) {
  console.error('❌ Validation results not found:', resultsFile);
  console.error('   Run: npm run data:validate');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

// Extract data
const nPatients = results.map((r) => r.nPatients);
const times = results.map((r) => r.processingTime);
const memory = results.map((r) => r.memoryUsed);

// Chart configuration
const width = 1200;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// ========== PLOT 1: Scalability Validation ==========

console.log('📊 Generating scalability validation plot...');

const scalabilityConfig = {
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
  plugins: [
    {
      id: 'background',
      beforeDraw: (chart) => {
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },
    },
  ],
};

(async () => {
  try {
    // Generate scalability plot
    const scalabilityImage = await chartJSNodeCanvas.renderToBuffer(scalabilityConfig);
    const outputDir = path.join(__dirname, '../../paper/figures');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const scalabilityFile = path.join(outputDir, 'scalability_validation.png');
    fs.writeFileSync(scalabilityFile, scalabilityImage);
    console.log(`✅ Saved: ${scalabilityFile}`);

    // ========== PLOT 2: Efficiency Improvement ==========

    console.log('📊 Generating efficiency improvement plot...');

    const perPatientTime = times.map((t, i) => (t / (nPatients[i] / 1000)).toFixed(2));

    const efficiencyConfig = {
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
            text: 'Efficiency Improvement with Scale',
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
            title: {
              display: true,
              text: 'Per-Patient Processing Time (μs)',
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
      plugins: [
        {
          id: 'background',
          beforeDraw: (chart) => {
            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          },
        },
      ],
    };

    const efficiencyImage = await chartJSNodeCanvas.renderToBuffer(efficiencyConfig);
    const efficiencyFile = path.join(outputDir, 'efficiency_improvement.png');
    fs.writeFileSync(efficiencyFile, efficiencyImage);
    console.log(`✅ Saved: ${efficiencyFile}`);

    console.log('\n📊 Scalability plots generated successfully!');
    console.log(`   Location: ${outputDir}/`);
    console.log(`   Files: scalability_validation.png, efficiency_improvement.png`);
  } catch (error) {
    console.error('❌ Error generating plots:', error);
    process.exit(1);
  }
})();
