/**
 * CLI command for benchmarking CPU vs GPU diagnostics
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { benchmarkBackends, getBackendInfo, isGPUAvailable, type Patient } from '@harmonia/core';

export const benchmarkDiagnosticsCommand = new Command('benchmark-diagnostics')
  .description('Benchmark CPU vs GPU performance for assumption diagnostics')
  .requiredOption('--data-file <path>', 'Path to patient data JSON file')
  .option('--iterations <number>', 'Number of benchmark iterations', (val) => parseInt(val), 3)
  .option('--output <path>', 'Output file path for benchmark results (JSON)')
  .action(async (options) => {
    try {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  Assumption Diagnostics Backend Benchmark                    ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      // Check backend info
      console.log('🔍 Checking backend configuration...\n');
      const backendInfo = await getBackendInfo();
      const gpuAvailable = await isGPUAvailable();

      console.log('  Backend Information:');
      console.log(`    TensorFlow.js version: ${backendInfo.tensorflowVersion}`);
      console.log(`    Current backend:       ${backendInfo.backend}`);
      console.log(`    GPU available:         ${gpuAvailable ? '✓ Yes' : '✗ No'}`);
      console.log();

      if (!gpuAvailable) {
        console.log('  ⚠️  GPU not available. Benchmark will only test CPU performance.');
        console.log('  To enable GPU:');
        console.log(
          '    1. Install @tensorflow/tfjs-node-gpu: npm install @tensorflow/tfjs-node-gpu'
        );
        console.log('    2. Ensure CUDA and cuDNN are installed');
        console.log('    3. Set TF_FORCE_GPU_ALLOW_GROWTH=true');
        console.log();
      }

      // Read patient data
      console.log('📁 Loading patient data...\n');
      const patientsData = JSON.parse(readFileSync(options.dataFile, 'utf-8'));
      const patients: Patient[] = patientsData.patients || patientsData;

      if (!Array.isArray(patients) || patients.length === 0) {
        console.error('Error: data-file must contain an array of patient records');
        process.exit(1);
      }

      console.log(`  Loaded ${patients.length.toLocaleString()} patients`);
      console.log();

      // Run benchmark
      const results = await benchmarkBackends(patients, options.iterations);

      // Display results
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  Benchmark Results                                            ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      console.log('  CPU Performance:');
      console.log(`    Average time:  ${results.cpu.avgTime.toFixed(1)}ms`);
      console.log(`    Overall score: ${results.cpu.scores.overall_score.toFixed(3)}`);
      console.log();

      if (results.gpu) {
        console.log('  GPU Performance:');
        console.log(`    Average time:  ${results.gpu.avgTime.toFixed(1)}ms`);
        console.log(`    Overall score: ${results.gpu.scores.overall_score.toFixed(3)}`);
        console.log();

        console.log('  Performance Comparison:');
        console.log(`    Speedup:       ${results.speedup!.toFixed(2)}x`);

        if (results.speedup! > 1) {
          console.log(
            `    Improvement:   ${((results.speedup! - 1) * 100).toFixed(1)}% faster with GPU`
          );
        } else {
          console.log(`    Note:          CPU faster for this dataset size`);
          console.log(`                   GPU recommended for datasets > 10,000 patients`);
        }
        console.log();
      }

      // Recommendations
      console.log('  💡 Recommendations:');
      if (!gpuAvailable) {
        console.log('    • Install GPU support for large datasets (>10k patients)');
      } else if (patients.length < 10000) {
        console.log('    • CPU is optimal for datasets < 10,000 patients');
        console.log('    • GPU acceleration recommended for larger datasets');
      } else {
        console.log('    • GPU acceleration active and beneficial for this dataset size');
      }
      console.log();

      // Save results
      if (options.output) {
        const output = {
          timestamp: new Date().toISOString(),
          datasetSize: patients.length,
          iterations: options.iterations,
          backendInfo,
          results: {
            cpu: {
              avgTimeMs: results.cpu.avgTime,
              scores: results.cpu.scores,
            },
            gpu: results.gpu
              ? {
                  avgTimeMs: results.gpu.avgTime,
                  scores: results.gpu.scores,
                }
              : null,
            speedup: results.speedup,
          },
        };

        writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`✓ Benchmark results saved to: ${options.output}\n`);
      }
    } catch (error) {
      console.error('Error running benchmark:', error);
      process.exit(1);
    }
  });
