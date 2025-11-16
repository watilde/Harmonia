/**
 * Federated Learning Coordinator (File-based, Manual Git Workflow)
 * Orchestrates federated learning rounds using local file operations
 */

import * as fs from 'fs';
import * as path from 'path';

import { updateGlobalModel } from '@harmonia/core';
import { ClientUpdate, FedAvgConfig, GlobalModel } from '@harmonia/core';
import { decryptObject } from '@harmonia/crypto';

import {
  AggregationJob,
  AggregationResult,
  ClientUpdateWithMeta,
  CoordinatorConfig,
  RoundStatus,
  StudyConfig,
} from './types';

/**
 * Federated Coordinator
 * Uses local file operations with manual git workflow
 */
export class FederatedCoordinator {
  private config: CoordinatorConfig;
  private encryptionKey?: Buffer;

  constructor(config: CoordinatorConfig) {
    this.config = config;

    // Validate repo path exists
    if (!fs.existsSync(config.repoPath)) {
      throw new Error(
        `Repository path does not exist: ${config.repoPath}\n` +
          `Did you forget to clone the study repository?\n` +
          `Run: git clone <repo-url> ${config.repoPath}`
      );
    }

    // Load encryption key if provided
    if (config.encryptionKey) {
      this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    }
  }

  /**
   * Start a new round
   */
  startRound(studyId: string, roundNumber: number): void {
    console.log(`[Coordinator] Starting round ${roundNumber} for study ${studyId}`);

    const roundInfo = {
      studyId,
      roundNumber,
      status: 'in-progress',
      startTime: new Date().toISOString(),
    };

    const roundPath = path.join(this.config.repoPath, `studies/${studyId}/current-round.json`);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(roundPath), { recursive: true });

    // Write round info
    fs.writeFileSync(roundPath, JSON.stringify(roundInfo, null, 2));

    console.log(`
✅ Round ${roundNumber} started!

Round info saved to:
  ${roundPath}

Next steps:
  1. Commit and push:
     cd ${this.config.repoPath}
     git add ${path.relative(this.config.repoPath, roundPath)}
     git commit -m "Start round ${roundNumber}"
     git push

  2. Sites will pull and train:
     git pull
     harmonia train --study-id ${studyId} --round ${roundNumber}

  3. After all sites submit, aggregate:
     git pull
     harmonia coordinator aggregate --study-id ${studyId} --round ${roundNumber}
`);
  }

  /**
   * Check round status
   */
  checkRoundStatus(studyId: string, roundNumber: number): RoundStatus {
    const updatesDir = path.join(
      this.config.repoPath,
      `studies/${studyId}/rounds/${roundNumber}/updates`
    );

    if (!fs.existsSync(updatesDir)) {
      return {
        complete: false,
        submittedSites: [],
        totalSites: 0,
      };
    }

    // Get all submitted site updates
    const files = fs.readdirSync(updatesDir);
    const submittedSites = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));

    // Get expected participant count from study config
    const studyConfig = this.getStudyConfig(studyId);
    const totalSites = studyConfig.minParticipants || submittedSites.length;

    return {
      complete: submittedSites.length >= totalSites,
      submittedSites,
      totalSites,
    };
  }

  /**
   * Aggregate updates for a round
   */
  async aggregateRound(job: AggregationJob): Promise<AggregationResult> {
    const startTime = Date.now();
    console.log(`[Coordinator] Starting aggregation for round ${job.roundNumber}`);

    try {
      // Check if all participants have submitted
      const status = this.checkRoundStatus(job.studyId, job.roundNumber);

      console.log(
        `[Coordinator] Submissions: ${status.submittedSites.length}/${status.totalSites}`
      );

      if (!status.complete) {
        throw new Error(
          `Insufficient participants: ${status.submittedSites.length} < ${job.minParticipants}\n` +
            `Did you forget to run 'git pull' to get all site updates?`
        );
      }

      // Read all client updates from files
      console.log(`[Coordinator] Reading client updates...`);
      const rawUpdates = this.getClientUpdates(job.studyId, job.roundNumber);

      // Decrypt and parse updates
      console.log(`[Coordinator] Decrypting and parsing updates...`);
      const clientUpdates: ClientUpdate[] = [];
      const errors: string[] = [];

      for (const raw of rawUpdates) {
        try {
          const update = this.parseClientUpdate(raw.data);
          clientUpdates.push({
            siteId: update.siteId,
            roundNumber: update.roundNumber,
            weights: {
              data: update.weights.data,
              shapes: update.weights.shapes,
            },
            sampleCount: update.sampleCount,
            metrics: update.metrics,
          });
        } catch (error) {
          const errMsg = `Failed to parse update from ${raw.siteId}: ${error}`;
          console.error(`[Coordinator] ${errMsg}`);
          errors.push(errMsg);
        }
      }

      if (clientUpdates.length < job.minParticipants) {
        throw new Error(
          `Insufficient valid updates: ${clientUpdates.length} < ${job.minParticipants}`
        );
      }

      // Aggregate updates
      console.log(`[Coordinator] Aggregating ${clientUpdates.length} updates...`);
      const fedAvgConfig: FedAvgConfig = {
        totalRounds: job.roundNumber,
        minParticipants: job.minParticipants,
        aggregationStrategy: job.aggregationStrategy,
      };

      // Get previous global model or initialize
      let globalModel: GlobalModel;
      if (job.roundNumber === 1) {
        // Initialize with first client's weights
        globalModel = {
          weights: clientUpdates[0].weights,
          round: {
            roundNumber: 0,
            totalRounds: fedAvgConfig.totalRounds,
            participantCount: 0,
            timestamp: new Date(),
          },
          aggregatedSamples: 0,
        };
      } else {
        // Read previous global model
        globalModel = this.getGlobalModel(job.studyId, job.roundNumber - 1);
      }

      // Update global model
      const newGlobalModel = updateGlobalModel(globalModel, clientUpdates, fedAvgConfig);

      // Save new global model to file
      console.log(`[Coordinator] Saving new global model...`);
      this.saveGlobalModel(job.studyId, job.roundNumber, newGlobalModel);

      // Generate round report
      const report = {
        roundNumber: job.roundNumber,
        participantCount: clientUpdates.length,
        participants: clientUpdates.map((u) => ({
          siteId: u.siteId,
          sampleCount: u.sampleCount,
          metrics: u.metrics,
        })),
        aggregationTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.saveRoundReport(job.studyId, job.roundNumber, report);

      const aggregationTime = Date.now() - startTime;
      console.log(`[Coordinator] Aggregation complete in ${(aggregationTime / 1000).toFixed(2)}s`);

      const globalModelPath = path.join(
        this.config.repoPath,
        `studies/${job.studyId}/rounds/${job.roundNumber}/global-model.json`
      );
      const reportPath = path.join(
        this.config.repoPath,
        `studies/${job.studyId}/rounds/${job.roundNumber}/report.json`
      );

      console.log(`
✅ Aggregation complete!

Participants: ${clientUpdates.length} sites
Total samples: ${clientUpdates.reduce((sum, u) => sum + u.sampleCount, 0)}

Files saved:
  ${globalModelPath}
  ${reportPath}

Next steps:
  1. Review the global model:
     cat ${globalModelPath}

  2. Commit and push:
     cd ${this.config.repoPath}
     git add studies/${job.studyId}/rounds/${job.roundNumber}/
     git commit -m "Global model for round ${job.roundNumber} (${clientUpdates.length} sites)"
     git push

  3. Start next round:
     harmonia coordinator start-round --study-id ${job.studyId} --round ${job.roundNumber + 1}
`);

      return {
        success: true,
        globalModel: newGlobalModel,
        participantCount: clientUpdates.length,
        aggregationTime,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error(`[Coordinator] Aggregation failed:`, error);
      return {
        success: false,
        globalModel: {} as GlobalModel,
        participantCount: 0,
        aggregationTime: Date.now() - startTime,
        errors: [String(error)],
      };
    }
  }

  /**
   * Read study configuration from local file
   */
  private getStudyConfig(studyId: string): StudyConfig {
    const configPath = path.join(this.config.repoPath, `studies/${studyId}/config.json`);

    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Study config not found at ${configPath}\n` +
          `Did you forget to run 'git pull' to get the study configuration?`
      );
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as StudyConfig;
  }

  /**
   * Read previous global model from local file
   */
  private getGlobalModel(studyId: string, roundNumber: number): GlobalModel {
    const modelPath = path.join(
      this.config.repoPath,
      `studies/${studyId}/rounds/${roundNumber}/global-model.json`
    );

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Previous global model not found at ${modelPath}`);
    }

    const content = fs.readFileSync(modelPath, 'utf-8');
    return JSON.parse(content) as GlobalModel;
  }

  /**
   * Read all client updates from local files
   */
  private getClientUpdates(
    studyId: string,
    roundNumber: number
  ): Array<{ siteId: string; data: string }> {
    const updatesDir = path.join(
      this.config.repoPath,
      `studies/${studyId}/rounds/${roundNumber}/updates`
    );

    if (!fs.existsSync(updatesDir)) {
      throw new Error(
        `Updates directory not found at ${updatesDir}\n` +
          `Did you forget to run 'git pull' to get site updates?`
      );
    }

    const files = fs.readdirSync(updatesDir);
    const updates: Array<{ siteId: string; data: string }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const siteId = file.replace('.json', '');
        const filePath = path.join(updatesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        updates.push({ siteId, data: content });
      }
    }

    return updates;
  }

  /**
   * Save global model to local file
   */
  private saveGlobalModel(studyId: string, roundNumber: number, model: GlobalModel): void {
    const modelDir = path.join(this.config.repoPath, `studies/${studyId}/rounds/${roundNumber}`);
    fs.mkdirSync(modelDir, { recursive: true });

    const modelPath = path.join(modelDir, 'global-model.json');
    fs.writeFileSync(modelPath, JSON.stringify(model, null, 2));
  }

  /**
   * Save round report to local file
   */
  private saveRoundReport(studyId: string, roundNumber: number, report: unknown): void {
    const reportPath = path.join(
      this.config.repoPath,
      `studies/${studyId}/rounds/${roundNumber}/report.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * Parse and optionally decrypt client update
   */
  private parseClientUpdate(data: string): ClientUpdateWithMeta {
    const parsed = JSON.parse(data);

    // Check if encrypted
    if (parsed.ciphertext) {
      if (!this.encryptionKey) {
        throw new Error('Encrypted update received but no encryption key configured');
      }
      return decryptObject(parsed, this.encryptionKey) as ClientUpdateWithMeta;
    }

    return parsed as ClientUpdateWithMeta;
  }
}
