/**
 * Transfer Federated Learning Module
 *
 * Provides knowledge transfer capabilities across different domains,
 * feature spaces, and tasks while preserving privacy.
 */

// FedMD (Federated Model Distillation)
export {
  applyTemperatureScaling,
  aggregateSoftPredictions,
  computeDistillationLoss,
  createDistillationDataset,
  validateConsensus,
  initializeFedMD,
  FedMDTracker,
} from './fedmd';
export type {
  FedMDConfig,
  FedMDParticipant,
  SoftPredictions,
  ConsensusPredictions,
  FedMDRoundSummary,
} from './fedmd';

// FMTL (Federated Multi-Task Learning)
export {
  aggregateSharedWeights,
  learnTaskRelationships,
  applyTaskRegularization,
  computePersonalizationScore,
  initializeFMTL,
  FMTLTracker,
} from './fmtl';
export type {
  FMTLConfig,
  Task,
  MTLModelWeights,
  TaskRelationshipMatrix,
  FMTLRoundSummary,
} from './fmtl';
