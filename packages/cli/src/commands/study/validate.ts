/**
 * Validate harmonia.json configuration
 */

import { Logger, FileOperations, ErrorHandler } from '../../utils';
import { validateHarmoniaConfig, generateTrainingPlan } from '../../utils/dependency-resolver';
import type { HarmoniaConfig } from '../../types/harmonia-config';

interface ValidateOptions {
  config?: string; // Path to harmonia.json
  verbose?: boolean;
}

export async function studyValidate(options: ValidateOptions = {}) {
  await ErrorHandler.wrapAsync(async () => {
    Logger.header('🔍 Harmonia Configuration Validation');

    // Find harmonia.json
    const configPath = options.config || FileOperations.join(process.cwd(), 'harmonia.json');

    const configExists = await FileOperations.exists(configPath);
    if (!configExists) {
      Logger.error(`Configuration file not found: ${configPath}`);
      Logger.info('\nMake sure you are in a study directory or specify the path with --config');
      process.exit(1);
    }

    Logger.info(`Reading configuration: ${configPath}\n`);

    // Read configuration
    let config: HarmoniaConfig;
    try {
      config = await FileOperations.readJSON<HarmoniaConfig>(configPath);
    } catch (error) {
      Logger.error(`Failed to parse configuration: ${(error as Error).message}`);
      process.exit(1);
    }

    // Validate configuration
    const validation = validateHarmoniaConfig(config);

    if (!validation.valid) {
      Logger.error(`❌ Validation failed: ${validation.reason}`);
      process.exit(1);
    }

    Logger.success('✅ Configuration is valid!\n');

    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      Logger.warn('⚠️  Warnings:');
      for (const warning of validation.warnings) {
        Logger.warn(`  - ${warning}`);
      }
      console.log();
    }

    // Generate and display training plan
    try {
      const trainingPlan = generateTrainingPlan(config);

      Logger.info('📋 Training Plan:');
      Logger.info(`  Study: ${config.name} (v${config.version})`);
      Logger.info(`  Total Layers: ${trainingPlan.totalLayers}`);
      Logger.info(`  Total Rounds: ${config.training.totalRounds}`);
      Logger.info(`  Strategy: ${config.training.strategy}\n`);

      Logger.info('  Layer Execution Plan:');
      for (const layer of trainingPlan.layers) {
        const modelNames = layer.models.map((id) => config.models[id]?.name || id).join(', ');
        Logger.info(`    Layer ${layer.layer}: ${modelNames}`);
        Logger.info(`      - Models: ${layer.models.join(', ')}`);
        Logger.info(`      - Rounds: ${layer.roundsPerModel} per model`);
        Logger.info(`      - Parallelizable: ${layer.parallelizable ? 'Yes' : 'No'}`);
      }
      console.log();
    } catch (error) {
      Logger.error(`Failed to generate training plan: ${(error as Error).message}`);
    }

    // Show detailed information in verbose mode
    if (options.verbose) {
      Logger.info('📊 Detailed Configuration:\n');

      Logger.info(`Study Information:`);
      Logger.keyValue('  Name', config.name);
      Logger.keyValue('  Version', config.version);
      Logger.keyValue('  Description', config.description);
      Logger.keyValue('  Coordinator', config.study.coordinator.name);
      Logger.keyValue('  Email', config.study.coordinator.email);
      Logger.keyValue('  Organization', config.study.coordinator.organization);

      if (config.study.ethics) {
        Logger.keyValue('  Ethics Approval', config.study.ethics.approval);
        Logger.keyValue('  Ethics Institution', config.study.ethics.institution);
      }
      console.log();

      Logger.info(`Models (${Object.keys(config.models).length}):`);
      for (const [modelId, model] of Object.entries(config.models)) {
        Logger.info(`  ${modelId}:`);
        Logger.keyValue('    Name', model.name);
        Logger.keyValue('    Type', model.type);
        Logger.keyValue('    Algorithm', model.federation.algorithm);
        Logger.keyValue('    Architecture', model.federation.architecture);

        const deps = Object.keys(model.dependencies || {});
        if (deps.length > 0) {
          Logger.keyValue('    Dependencies', deps.join(', '));
        } else {
          Logger.keyValue('    Dependencies', 'None (Layer 1)');
        }
        console.log();
      }

      if (config.privacy) {
        Logger.info(`Privacy Configuration:`);
        Logger.keyValue('  Mechanism', config.privacy.mechanism);
        if (config.privacy.epsilon) {
          Logger.keyValue('  Epsilon (ε)', config.privacy.epsilon.toString());
        }
        if (config.privacy.delta) {
          Logger.keyValue('  Delta (δ)', config.privacy.delta.toString());
        }
        if (config.privacy.clipNorm) {
          Logger.keyValue('  Clip Norm', config.privacy.clipNorm.toString());
        }
        console.log();
      }

      Logger.info(`Training Configuration:`);
      Logger.keyValue('  Total Rounds', config.training.totalRounds.toString());
      Logger.keyValue('  Strategy', config.training.strategy);
      if (config.training.earlyStoppingPatience) {
        Logger.keyValue('  Early Stopping', `${config.training.earlyStoppingPatience} rounds`);
      }
      if (config.training.validationSplit) {
        Logger.keyValue('  Validation Split', `${config.training.validationSplit * 100}%`);
      }
      console.log();
    }

    Logger.success('✅ Configuration validation complete!');
  });
}
