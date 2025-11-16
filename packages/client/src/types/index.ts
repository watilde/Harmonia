/**
 * Type definitions for Harmonia client
 */

import * as tf from '@tensorflow/tfjs-node';

import { DatabaseConfig } from '@harmonia/omop';

/**
 * Client configuration
 */
export interface ClientConfig {
  siteId: string;
  repoPath: string; // Local path to git repository
  database: DatabaseConfig;
  encryptionKey?: string; // Hex string (256-bit key)
}

/**
 * Study configuration
 */
export interface StudyConfig {
  studyId: string;
  description: string;
  totalRounds: number;
  minParticipants: number;
  cohortDefinition: CohortDefinition;
  featureDefinitions: FeatureDefinition[];
  modelConfig: ModelConfig;
  privacyConfig?: PrivacyConfig;
}

/**
 * Cohort definition for study
 */
export interface CohortDefinition {
  name: string;
  inclusionConceptIds: number[];
  exclusionConceptIds?: number[];
  indexDate?: Date;
}

/**
 * Feature definition for ML
 */
export interface FeatureDefinition {
  name: string;
  conceptIds?: number[];
  type: 'numeric' | 'categorical' | 'binary';
  aggregation?: 'latest' | 'mean' | 'max' | 'min' | 'count';
}

/**
 * Model configuration
 */
export interface ModelConfig {
  type: 'sequential' | 'functional';
  layers: LayerConfig[];
  optimizer: OptimizerConfig;
  loss: string;
  metrics: string[];
  epochs: number;
  batchSize: number;
  validationSplit?: number;
}

/**
 * Layer configuration
 */
export interface LayerConfig {
  type: 'dense' | 'dropout' | 'batchNormalization';
  units?: number;
  activation?: string;
  rate?: number;
  inputShape?: number[];
}

/**
 * Optimizer configuration
 */
export interface OptimizerConfig {
  type: 'adam' | 'sgd' | 'rmsprop';
  learningRate: number;
  momentum?: number;
}

/**
 * Privacy configuration
 */
export interface PrivacyConfig {
  differentialPrivacy?: {
    enabled: boolean;
    epsilon: number;
    delta: number;
    clipNorm: number;
  };
  secureAggregation?: {
    enabled: boolean;
  };
}

/**
 * Training dataset
 */
export interface TrainingDataset {
  features: tf.Tensor2D;
  labels: tf.Tensor;
  sampleCount: number;
}

/**
 * Local training result
 */
export interface LocalTrainingResult {
  data: Float32Array[];
  shapes: number[][];
  sampleCount: number;
  metrics: TrainingMetrics;
}

/**
 * Training metrics
 */
export interface TrainingMetrics {
  loss: number;
  accuracy?: number;
  [key: string]: number | undefined;
}

/**
 * Client status
 */
export type ClientStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'training'
  | 'uploading'
  | 'waiting'
  | 'error';

/**
 * Round information
 */
export interface RoundInfo {
  studyId: string;
  roundNumber: number;
  totalRounds: number;
  deadline?: Date;
  globalModelUrl?: string;
}
