/**
 * Training Logger
 * Handles logging and progress reporting for training
 */

import type { HarmoniaConfig, ModelConfig } from '../types/harmonia-config';
import { Logger } from '../utils/logger';
import type { ExportStorage } from './export-storage';
import type { TrainingState } from './training-state';

/**
 * Manages training logs and progress reports
 */
export class TrainingLogger {
  private config: HarmoniaConfig;
  private verbose: boolean;

  constructor(config: HarmoniaConfig, verbose: boolean = false) {
    this.config = config;
    this.verbose = verbose;
  }

  /**
   * Log training start
   */
  logTrainingStart(dryRun: boolean): void {
    Logger.header('🚀 Starting Federated Learning Training');

    if (dryRun) {
      Logger.warn('⚠️  DRY RUN MODE - No actual training will be performed\n');
    }
  }

  /**
   * Log training plan
   */
  logTrainingPlan(totalLayers: number, totalRounds: number, strategy: string): void {
    Logger.info('📋 Training Plan:');
    Logger.info(`  Study: ${this.config.name} (v${this.config.version})`);
    Logger.info(`  Total Layers: ${totalLayers}`);
    Logger.info(`  Total Rounds: ${totalRounds}`);
    Logger.info(`  Strategy: ${strategy}\n`);
  }

  /**
   * Log layer start
   */
  logLayerStart(layer: number, totalLayers: number, modelsInLayer: string[]): void {
    Logger.info(`\n${'='.repeat(60)}`);
    Logger.info(`📊 Layer ${layer}/${totalLayers}: ${modelsInLayer.join(', ')}`);
    Logger.info(`${'='.repeat(60)}\n`);
  }

  /**
   * Log parallel training notice
   */
  logParallelTraining(): void {
    Logger.info('ℹ️  Models in this layer can be trained in parallel\n');
  }

  /**
   * Log parallel not implemented warning
   */
  logParallelNotImplemented(): void {
    Logger.warn('  ⚠️  Parallel execution not yet implemented, training sequentially\n');
  }

  /**
   * Log model training start
   */
  logModelTrainingStart(modelId: string, modelConfig: ModelConfig, rounds: number): void {
    Logger.info(`\n🔧 Training Model: ${modelConfig.name} (${modelId})`);
    Logger.info(`   Algorithm: ${modelConfig.federation.algorithm}`);
    Logger.info(`   Architecture: ${modelConfig.federation.architecture}`);
    Logger.info(`   Rounds: ${rounds}`);

    const hasImports = modelConfig.imports && Object.keys(modelConfig.imports).length > 0;
    const hasPipeline = modelConfig.pipeline !== undefined;

    if (hasImports) {
      Logger.info(`   Imports: ${Object.keys(modelConfig.imports!).length} dependencies`);
    }
    if (hasPipeline) {
      Logger.info(`   Pipeline: ${modelConfig.pipeline!.stages.length} stages`);
    }
    Logger.info('');
  }

  /**
   * Log import resolution
   */
  logImportResolution(): void {
    Logger.info('   📥 Resolving imports...');
  }

  /**
   * Log import resolution success
   */
  logImportResolutionSuccess(): void {
    Logger.success('   ✅ All imports resolved\n');
  }

  /**
   * Log import resolution failure
   */
  logImportResolutionFailure(errors: string[]): void {
    Logger.error(`   ❌ Import resolution failed:`);
    for (const error of errors) {
      Logger.error(`      ${error}`);
    }
  }

  /**
   * Log dry run skip
   */
  logDryRunSkip(): void {
    Logger.info('   [DRY RUN] Skipping actual training\n');
  }

  /**
   * Log dry run exports
   */
  logDryRunExports(exportCount: number): void {
    Logger.info(`   [DRY RUN] Generated ${exportCount} mock exports\n`);
  }

  /**
   * Log pipeline execution
   */
  logPipelineExecution(): void {
    Logger.info('   🔄 Executing pipeline...');
  }

  /**
   * Log pipeline success
   */
  logPipelineSuccess(): void {
    Logger.success('   ✅ Pipeline executed successfully\n');
  }

  /**
   * Log pipeline failure
   */
  logPipelineFailure(errors: string[]): void {
    Logger.error(`   ❌ Pipeline execution failed:`);
    for (const error of errors) {
      Logger.error(`      ${error}`);
    }
  }

  /**
   * Log training failure
   */
  logTrainingFailure(error: string): void {
    Logger.error(`   ❌ Training failed: ${error}`);
  }

  /**
   * Log exports stored
   */
  logExportsStored(exportCount: number): void {
    Logger.info(`   📤 Stored ${exportCount} exports from model\n`);
  }

  /**
   * Log model completion
   */
  logModelCompletion(modelId: string): void {
    Logger.success(`✅ Model ${modelId} training completed\n`);
  }

  /**
   * Log model building
   */
  logModelBuilding(): void {
    Logger.info('   🔨 Building model...');
  }

  /**
   * Log model built
   */
  logModelBuilt(layerCount: number): void {
    Logger.info(`   ✅ Model built with ${layerCount} layers\n`);
  }

  /**
   * Log data generation
   */
  logDataGeneration(): void {
    Logger.info('   📊 Generating training data...');
  }

  /**
   * Log data ready
   */
  logDataReady(): void {
    Logger.info('   ✅ Training data ready\n');
  }

  /**
   * Log training start for centralized
   */
  logCentralizedTrainingStart(rounds: number): void {
    Logger.info(`   🏋️  Training for ${rounds} epochs...`);
  }

  /**
   * Log epoch progress
   */
  logEpochProgress(
    epoch: number,
    totalEpochs: number,
    logs: {
      loss: number;
      val_loss?: number;
      acc?: number;
      val_acc?: number;
    }
  ): void {
    const loss = logs.loss.toFixed(4);
    const valLoss = logs.val_loss?.toFixed(4);
    const acc = logs.acc?.toFixed(4);
    const valAcc = logs.val_acc?.toFixed(4);

    if (this.verbose || (epoch + 1) % Math.max(1, Math.floor(totalEpochs / 10)) === 0) {
      let message = `     Epoch ${epoch + 1}/${totalEpochs} - loss: ${loss}`;
      if (valLoss) message += ` - val_loss: ${valLoss}`;
      if (acc) message += ` - acc: ${acc}`;
      if (valAcc) message += ` - val_acc: ${valAcc}`;
      Logger.info(message);
    } else {
      process.stdout.write('.');
    }
  }

  /**
   * Log centralized training completion
   */
  logCentralizedTrainingComplete(loss: number, accuracy?: number): void {
    Logger.success(
      `   ✅ Training completed - Loss: ${loss.toFixed(4)}${
        accuracy ? ` - Acc: ${accuracy.toFixed(4)}` : ''
      }\n`
    );
  }

  /**
   * Log federated training completion
   */
  logFederatedTrainingComplete(loss: number, accuracy?: number): void {
    Logger.success(
      `   ✅ Federated training completed - Loss: ${loss.toFixed(4)}${
        accuracy ? ` - Acc: ${accuracy.toFixed(4)}` : ''
      }\n`
    );
  }

  /**
   * Print training summary
   */
  printSummary(state: TrainingState, exportStorage: ExportStorage): void {
    Logger.info(`\n\n${'='.repeat(60)}`);
    Logger.header('📊 Training Summary');
    Logger.info(`${'='.repeat(60)}\n`);

    Logger.info(`Study: ${this.config.name}`);
    Logger.info(`Total Models: ${state.getTotalModels()}`);
    Logger.info(`Completed Models: ${state.getCompletedCount()}\n`);

    // Export/Import statistics
    const exportStats = exportStorage.getStats();
    if (exportStats.totalExports > 0) {
      Logger.info('Import/Export Statistics:');
      Logger.info(`  Total Exports: ${exportStats.totalExports}`);
      Logger.info(`  Models with Exports: ${exportStats.totalModels}`);
      for (const [modelId, count] of exportStats.modelCounts) {
        Logger.info(`    ${modelId}: ${count} export(s)`);
      }
      Logger.info('');
    }

    Logger.info('Model Results:');
    for (const [modelId, result] of state.getAllResults().entries()) {
      const status = result.status === 'completed' ? '✅' : '❌';
      Logger.info(`  ${status} ${modelId}: ${result.rounds} rounds (${result.status})`);
    }

    if (state.isAllCompleted()) {
      Logger.success('\n✅ Training completed successfully!');
    } else {
      Logger.error('\n❌ Training incomplete');
    }
  }
}
