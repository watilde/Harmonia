/**
 * Start federated learning training
 */

import { Logger, ErrorHandler, Prompts } from '../../utils';
import { loadHarmoniaConfig, isHarmoniaStudy } from '../../utils/config-loader';
import { TrainingOrchestrator } from '../../training/orchestrator';

interface StartOptions {
  dryRun?: boolean;
  verbose?: boolean;
  yes?: boolean; // Skip confirmation
}

export async function studyStart(options: StartOptions = {}) {
  await ErrorHandler.wrapAsync(async () => {
    Logger.header('🚀 Harmonia - Start Training');

    // Check if current directory is a Harmonia study
    const isStudy = await isHarmoniaStudy();
    if (!isStudy) {
      Logger.error('Current directory is not a Harmonia study');
      Logger.info('\nMake sure you are in a study directory with harmonia.json and package.json');
      Logger.info('Or create a new study with: harmonia study init-v2');
      process.exit(1);
    }

    // Load configuration
    Logger.info('📂 Loading configuration...\n');
    const configResult = await loadHarmoniaConfig();

    if (!configResult.success || !configResult.config) {
      Logger.error(`Failed to load configuration: ${configResult.error}`);
      process.exit(1);
    }

    const config = configResult.config;

    // Display study information
    Logger.info('Study Information:');
    Logger.keyValue('  Name', config.name);
    Logger.keyValue('  Version', config.version);
    Logger.keyValue('  Description', config.description);
    Logger.keyValue('  Models', Object.keys(config.models).length.toString());
    Logger.keyValue('  Total Rounds', config.training.totalRounds.toString());
    console.log();

    // Display model details
    Logger.info('Models to train:');
    for (const [modelId, model] of Object.entries(config.models)) {
      const deps = Object.keys(model.dependencies || {});
      const depStr = deps.length > 0 ? ` (depends on: ${deps.join(', ')})` : '';
      Logger.info(`  • ${model.name} (${modelId})${depStr}`);
      Logger.info(`    - Algorithm: ${model.federation.algorithm}`);
      Logger.info(`    - Type: ${model.type}`);
    }
    console.log();

    // Confirm before starting
    if (!options.yes && !options.dryRun) {
      const confirmed = await Prompts.confirm(
        'Start training? This will begin federated learning execution.',
        false
      );

      if (!confirmed) {
        Logger.info('Training cancelled');
        return;
      }
      console.log();
    }

    // Create orchestrator and execute
    const orchestrator = new TrainingOrchestrator(config, {
      dryRun: options.dryRun,
      verbose: options.verbose,
    });

    await orchestrator.execute();

    // Next steps
    if (!options.dryRun) {
      Logger.nextSteps([
        'Check training results in results/ directory',
        'Export results: harmonia results export --format json',
        'View summary: harmonia results show',
      ]);
    }
  });
}
