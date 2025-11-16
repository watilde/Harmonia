/**
 * Vertical Federated Learning Module
 *
 * Provides split learning capabilities for scenarios where different
 * participants have different features for the same samples.
 */

// Types
export type {
  OMOPDomain,
  VFLRole,
  ModelConfig,
  VFLParticipant,
  VFLPrivacyConfig,
  CoordinatorConfig,
  VFLConfig,
  EmbeddingUpdate,
  GradientUpdate,
  AggregatedEmbeddings,
  TrainingResult,
  VFLRoundSummary,
  VFLTrainingResult,
} from './types';

// Embedding Aggregation
export {
  validateEmbeddingUpdates,
  concatenateEmbeddings,
  sumEmbeddings,
  averageEmbeddings,
  aggregateEmbeddings,
  splitGradients,
} from './embedding-aggregation';

// Privacy
export {
  addDPToEmbeddings,
  addDPToGradients,
  protectEmbeddingUpdate,
  protectGradientUpdate,
  calculateVFLPrivacyBudget,
  validatePrivacyConfig,
  createDefaultVFLPrivacyConfig,
} from './privacy';

// Split Learning Client
export { SplitLearningClient, createSplitLearningClient } from './split-learning-client';

// Split Learning Coordinator
export {
  SplitLearningCoordinator,
  createSplitLearningCoordinator,
} from './split-learning-coordinator';

// VFL-FedAvg
export {
  aggregateEmbeddings as vflFedAvgAggregate,
  assessEmbeddingQuality,
  computeEmbeddingVariance,
  computeContributionScore,
  initializeVFLFedAvg,
} from './vfl-fedavg';
export type { VFLFedAvgConfig, EmbeddingQuality } from './vfl-fedavg';

// Vertical SecAgg
export {
  generateSecAggKeyPair as generateVerticalSecAggKeyPair,
  generatePairwiseMask as generateVerticalPairwiseMask,
  applyPairwiseMasks,
  aggregateMaskedEmbeddings as aggregateVerticalMaskedEmbeddings,
  verifyMaskCancellation,
  handleDropout as handleVerticalDropout,
  initializeVerticalSecAgg,
} from './vertical-secagg';
export type {
  VerticalSecAggConfig,
  SecAggKeyPair as VerticalSecAggKeyPair,
  MaskedEmbedding,
} from './vertical-secagg';

// Integration utilities
export {
  initializeVFLSetup,
  executeVFLRound,
  generateSyntheticFeatures,
  generateSyntheticLabels,
  exportTopModel,
  importTopModel,
} from './integration';
export type { VFLSetupConfig, VFLRoundResult, VFLSetup } from './integration';
