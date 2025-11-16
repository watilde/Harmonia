/**
 * Federated Learning Client (File-based, Manual Git Workflow)
 * Main class for participating sites in federated learning studies
 */

import * as fs from 'fs';
import * as path from 'path';

import * as tf from '@tensorflow/tfjs-node';

import { encryptObject, generateKey } from '@harmonia/crypto';
import { OMOPConnector, PostgreSQLConnector, SQLServerConnector } from '@harmonia/omop';

import { applyDifferentialPrivacy, clipWeights, trainLocal } from './training/trainer';
import {
  ClientConfig,
  ClientStatus,
  LocalTrainingResult,
  RoundInfo,
  StudyConfig,
  TrainingDataset,
} from './types';

/**
 * Federated Learning Client
 * Uses local file operations with manual git workflow
 */
export class FederatedClient {
  private config: ClientConfig;
  private db?: OMOPConnector;
  private status: ClientStatus = 'idle';
  private encryptionKey?: Buffer;

  constructor(config: ClientConfig) {
    this.config = config;

    // Validate repo path exists
    if (!fs.existsSync(config.repoPath)) {
      throw new Error(
        `Repository path does not exist: ${config.repoPath}\n` +
          `Did you forget to clone the study repository?\n` +
          `Run: git clone <repo-url> ${config.repoPath}`
      );
    }

    // Load or generate encryption key
    if (config.encryptionKey) {
      this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    } else {
      this.encryptionKey = generateKey(256);
      console.warn(
        `[${this.config.siteId}] WARNING: No encryption key provided. Generated new key.\n` +
          `Save this key for future use: ${this.encryptionKey.toString('hex')}`
      );
    }
  }

  /**
   * Initialize client and connect to database
   */
  async initialize(): Promise<void> {
    this.status = 'initializing';
    console.log(`[${this.config.siteId}] Initializing federated learning client...`);

    // Connect to database
    if (this.config.database.type === 'postgresql') {
      this.db = new PostgreSQLConnector(this.config.database);
    } else if (this.config.database.type === 'sqlserver') {
      this.db = new SQLServerConnector(this.config.database);
    } else {
      throw new Error(`Unsupported database type: ${this.config.database.type}`);
    }

    await this.db.connect();
    console.log(`[${this.config.siteId}] Connected to OMOP database`);

    this.status = 'ready';
    console.log(`[${this.config.siteId}] Client ready`);
  }

  /**
   * Train for a specific round
   * This is the main method sites call manually for each round
   */
  async trainRound(studyId: string, roundNumber: number): Promise<void> {
    if (this.status !== 'ready') {
      throw new Error(`Cannot train: client status is ${this.status}`);
    }

    console.log(`\n[${this.config.siteId}] === Training Round ${roundNumber} ===`);

    // 1. Read study configuration from local file
    const studyConfig = this.getStudyConfig(studyId);
    console.log(
      `[${this.config.siteId}] Study: ${studyConfig.studyId} (${studyConfig.totalRounds} rounds)`
    );

    // 2. Check current round
    const currentRound = this.getCurrentRound(studyId);
    if (currentRound.roundNumber !== roundNumber) {
      throw new Error(
        `Round mismatch: Current round is ${currentRound.roundNumber}, but you requested ${roundNumber}\n` +
          `Did you forget to run 'git pull' to get the latest round information?`
      );
    }

    // 3. Download global model if not first round
    let globalWeights: { data: Float32Array[]; shapes: number[][] } | undefined;
    if (roundNumber > 1) {
      console.log(`[${this.config.siteId}] Loading global model from round ${roundNumber - 1}...`);
      globalWeights = this.getGlobalModel(studyId, roundNumber - 1);
    }

    // 4. Extract features from local OMOP database
    console.log(`[${this.config.siteId}] Extracting features from local data...`);
    const dataset = await this.extractFeatures(studyConfig);
    console.log(`[${this.config.siteId}] Dataset size: ${dataset.sampleCount} samples`);

    // 5. Train local model
    this.status = 'training';
    console.log(`[${this.config.siteId}] Training local model...`);
    const trainingResult = await trainLocal(dataset, studyConfig.modelConfig, globalWeights);

    console.log(
      `[${this.config.siteId}] Training complete - Loss: ${trainingResult.metrics.loss.toFixed(4)}${
        trainingResult.metrics.accuracy
          ? `, Acc: ${trainingResult.metrics.accuracy.toFixed(4)}`
          : ''
      }`
    );

    // 6. Apply privacy mechanisms if configured
    let finalWeights = trainingResult;
    if (studyConfig.privacyConfig?.differentialPrivacy?.enabled) {
      const dpConfig = studyConfig.privacyConfig.differentialPrivacy;
      console.log(
        `[${this.config.siteId}] Applying differential privacy (ε=${dpConfig.epsilon})...`
      );

      const clipped = clipWeights(trainingResult, dpConfig.clipNorm);
      const noisy = applyDifferentialPrivacy(
        clipped,
        dpConfig.epsilon,
        dpConfig.delta,
        dpConfig.clipNorm
      );

      finalWeights = { ...trainingResult, ...noisy };
    }

    // 7. Save encrypted update to local file
    console.log(`[${this.config.siteId}] Encrypting and saving update...`);
    const updatePath = this.saveUpdate(studyId, roundNumber, finalWeights);

    // Cleanup
    dataset.features.dispose();
    dataset.labels.dispose();

    this.status = 'ready';

    // Print next steps for user
    const relativeUpdatePath = path.relative(this.config.repoPath, updatePath);
    console.log(`
✅ Training complete!

Metrics:
  Loss: ${trainingResult.metrics.loss.toFixed(4)}${
    trainingResult.metrics.accuracy
      ? `\n  Accuracy: ${trainingResult.metrics.accuracy.toFixed(4)}`
      : ''
  }
  Samples: ${trainingResult.sampleCount}

Update saved to:
  ${updatePath}

File size: ${(fs.statSync(updatePath).size / 1024).toFixed(1)} KB (encrypted)

Next steps:
  1. Review the update:
     cd ${this.config.repoPath}
     git diff ${relativeUpdatePath}
  
  2. Commit and push:
     git add ${relativeUpdatePath}
     git commit -m "Site ${this.config.siteId} round ${roundNumber} update (${trainingResult.sampleCount} samples)"
     git push

  3. Wait for coordinator to aggregate and push global model
  
  4. Pull and train next round:
     git pull
     harmonia train --study-id ${studyId} --round ${roundNumber + 1}
`);
  }

  /**
   * Read study configuration from local file
   */
  private getStudyConfig(studyId: string): StudyConfig {
    const configPath = path.join(this.config.repoPath, `studies/${studyId}/config.json`);

    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Study config not found at ${configPath}\n` +
          `Did you forget to run 'git pull' to get the latest study configuration?`
      );
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as StudyConfig;
  }

  /**
   * Read current round information from local file
   */
  private getCurrentRound(studyId: string): RoundInfo {
    const roundPath = path.join(this.config.repoPath, `studies/${studyId}/current-round.json`);

    if (!fs.existsSync(roundPath)) {
      throw new Error(
        `Round info not found at ${roundPath}\n` +
          `Did you forget to run 'git pull' to sync with coordinator?`
      );
    }

    const content = fs.readFileSync(roundPath, 'utf-8');
    return JSON.parse(content) as RoundInfo;
  }

  /**
   * Read global model from local file
   */
  private getGlobalModel(
    studyId: string,
    roundNumber: number
  ): { data: Float32Array[]; shapes: number[][] } {
    const modelPath = path.join(
      this.config.repoPath,
      `studies/${studyId}/rounds/${roundNumber}/global-model.json`
    );

    if (!fs.existsSync(modelPath)) {
      throw new Error(
        `Global model for round ${roundNumber} not found at ${modelPath}\n` +
          `Did you forget to run 'git pull' to download the latest model?`
      );
    }

    const content = fs.readFileSync(modelPath, 'utf-8');
    const parsed = JSON.parse(content);

    return {
      data: parsed.weights.data.map((arr: number[]) => new Float32Array(arr)),
      shapes: parsed.weights.shapes,
    };
  }

  /**
   * Save encrypted update to local file
   */
  private saveUpdate(studyId: string, roundNumber: number, result: LocalTrainingResult): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Prepare update object
    const update = {
      siteId: this.config.siteId,
      roundNumber,
      weights: {
        data: Array.from(result.data.map((arr) => Array.from(arr))),
        shapes: result.shapes,
      },
      sampleCount: result.sampleCount,
      metrics: result.metrics,
      timestamp: new Date().toISOString(),
    };

    // Encrypt update
    const encrypted = encryptObject(update, this.encryptionKey);

    // Ensure directory exists
    const updateDir = path.join(
      this.config.repoPath,
      `studies/${studyId}/rounds/${roundNumber}/updates`
    );
    fs.mkdirSync(updateDir, { recursive: true });

    // Write to file
    const updatePath = path.join(updateDir, `${this.config.siteId}.json`);
    fs.writeFileSync(updatePath, JSON.stringify(encrypted, null, 2));

    return updatePath;
  }

  /**
   * Extract features from OMOP database
   */
  private async extractFeatures(studyConfig: StudyConfig): Promise<TrainingDataset> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // This is a simplified implementation
    // In production, this would use proper OMOP CDM queries based on:
    // - studyConfig.cohortDefinition
    // - studyConfig.featureDefinitions

    const sampleCount = 100; // Placeholder
    const featureCount = studyConfig.featureDefinitions.length;

    // Generate placeholder features
    const features = tf.randomNormal([sampleCount, featureCount]) as tf.Tensor2D;
    const labels = tf.randomUniform([sampleCount, 1]);

    return {
      features,
      labels,
      sampleCount,
    };
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.disconnect();
      console.log(`[${this.config.siteId}] Disconnected from database`);
    }
    this.status = 'idle';
  }

  /**
   * Get current status
   */
  getStatus(): ClientStatus {
    return this.status;
  }
}
