/**
 * Asynchronous Federated Learning Module
 */

export type {
  AsyncFLConfig,
  ModelVersion,
  VersionedUpdate,
  UpdateStaleness,
  AsyncAggregationResult,
  IncrementalUpdateResult,
  ConvergenceTracker,
  AsyncFLSession,
  AsyncFLStats,
} from './types';

export {
  calculateStaleness,
  calculateStalenessWeight,
  shouldAcceptUpdate,
  processUpdates,
  getAcceptedUpdates,
  calculateAverageStaleness,
  aggregateWithStaleness,
  createDefaultAsyncFLConfig,
  validateAsyncFLConfig,
} from './staleness';

export {
  applyIncrementalUpdate,
  updateMovingAverage,
  performIncrementalUpdate,
  applyMomentum,
  initializeMomentum,
  detectCatastrophicForgetting,
  adaptLearningRate,
} from './incremental';

export {
  initializeConvergenceTracker,
  updateConvergenceTracker,
  checkLossConvergence,
  checkMovingAverageConvergence,
  checkPlateauConvergence,
  checkConvergence,
  calculateConvergenceRate,
  predictConvergenceTime,
} from './convergence';

export { AsyncFLCoordinator } from './coordinator';
