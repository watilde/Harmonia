#!/usr/bin/env node
/**
 * Harmonia CLI - Command-line interface for federated learning
 *
 * Command structure:
 * - harmonia study   : Study management (coordinators)
 * - harmonia site    : Site management (sites)
 * - harmonia client  : Client execution (sites)
 * - harmonia results : Results viewing (everyone)
 */

import { Command } from 'commander';

// Import command handlers
import { studyList, studyStatus, studyValidate, studyStart } from './commands/study';
import { resultsShow, resultsExport } from './commands/results';
import { init } from './commands/init';

import { causalCommand } from './commands/causal';

const program = new Command();

program
  .name('harmonia')
  .description('Privacy-preserving federated learning for medical research')
  .version('0.2.0');

// ============================================================================
// INIT COMMAND (New file-based workflow)
// ============================================================================

program
  .command('init')
  .description('Initialize a new study configuration (file-based)')
  .option('--study-id <id>', 'Study identifier')
  .option('--study-name <name>', 'Study name')
  .option('--total-rounds <n>', 'Total training rounds', '10')
  .option('--min-participants <n>', 'Minimum participants', '2')
  .option('--algorithm <algo>', 'Algorithm (fedavg, fedprox, etc.)', 'fedavg')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('-i, --interactive', 'Interactive mode', false)
  .action(init);

// ============================================================================
// STUDY COMMANDS (Coordinators)
// ============================================================================

const studyCommand = program.command('study').description('Study management (coordinators)');

studyCommand
  .command('list')
  .description('List all studies')
  .option('--status <status>', 'Filter by status (active, completed, archived)')
  .option('--format <format>', 'Output format (table, json, csv)', 'table')
  .action(studyList);

studyCommand
  .command('status <study-id>')
  .description('Check study status and progress')
  .option('-d, --detailed', 'Show detailed information', false)
  .option('-w, --watch', 'Watch mode (refresh every 10s)', false)
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action(studyStatus);

studyCommand
  .command('validate')
  .description('Validate harmonia.json configuration')
  .option('-c, --config <path>', 'Path to harmonia.json (default: ./harmonia.json)')
  .option('-v, --verbose', 'Show detailed validation information', false)
  .action(studyValidate);

studyCommand
  .command('start')
  .description('Start federated learning training')
  .option('--dry-run', 'Preview training plan without actual execution', false)
  .option('-v, --verbose', 'Show detailed training progress', false)
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(studyStart);

// ============================================================================
// CAUSAL INFERENCE COMMANDS
// ============================================================================

program.addCommand(causalCommand);

// ============================================================================
// RESULTS COMMANDS (Everyone)
// ============================================================================

const resultsCommand = program.command('results').description('Results viewing and export');

resultsCommand
  .command('show <study-id>')
  .description('Display study results')
  .option('--round <n>', 'Show specific round (default: latest)')
  .option('--format <format>', 'Output format (table, json, csv)', 'table')
  .option('--metrics <list>', 'Metrics to show (comma-separated)')
  .action(resultsShow);

resultsCommand
  .command('export <study-id>')
  .description('Export study results to file')
  .option('-o, --output <path>', 'Output file path (required)')
  .option('--format <format>', 'Export format (json, csv, excel)', 'json')
  .option('--include <items>', 'What to include (comma-separated: config,metrics,logs)')
  .action(resultsExport);

// ============================================================================
// GLOBAL OPTIONS & HELP
// ============================================================================

program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  console.log('🔬 Harmonia - Privacy-Preserving Federated Learning\n');
  program.outputHelp();

  console.log('\n🔬 Causal Inference Commands:');
  console.log('  harmonia causal generate-data          Generate synthetic data');
  console.log('  harmonia causal compute-bounds         Compute partial ID bounds');
  console.log('  harmonia causal federate-bounds        Aggregate multi-site bounds');
  console.log('  harmonia causal compute-evalue         E-value sensitivity analysis');
  console.log('  harmonia causal compute-fri            Federated Robustness Index');
  console.log('  harmonia causal diagnose-assumptions   Diagnose assumption violations');
  console.log('  harmonia causal select-inference-mode  Auto-select inference mode');
  console.log('\n📊 Other Commands:');
  console.log('  harmonia study validate           Validate harmonia.json config');
  console.log('  harmonia study start              Start training from config');
  console.log('  harmonia results show             View results');
  console.log('\nFor more help:');
  console.log('  harmonia causal --help');
  console.log('\nDocumentation: https://github.com/watilde/Harmonia/docs/');
}
