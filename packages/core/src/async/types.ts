/**
 * Asynchronous Federated Learning Types
 */

export interface AsyncFLConfig {
  maxStaleness: number;
  minUpdatesPerRound: number;
  stalenessDecayFactor: number;
  convergenceThreshold: number;
  maxUpdates: number;
  incrementalLearning: boolean;
  incrementalLearningRate: number;
}

export interface ModelVersion {
  version: number;
  timestamp: number;
  loss?: number;
  accuracy?: number;
  updateCount: number;
}

export interface VersionedUpdate {
  siteId: string;
  baseVersion: number;
  weights: {
    data: Float32Array[];
    shapes: number[][];
  };
  sampleCount: number;
  metrics: {
    loss: number;
    accuracy?: number;
  };
  timestamp: number;
  encrypted: boolean;
}

export interface UpdateStaleness {
  update: VersionedUpdate;
  currentVersion: number;
  staleness: number;
  weight: number;
  accepted: boolean;
  rejectionReason?: string;
}

export interface AsyncAggregationResult {
  newVersion: ModelVersion;
  aggregatedWeights: {
    data: Float32Array[];
    shapes: number[][];
  };
  updates: UpdateStaleness[];
  acceptedCount: number;
  rejectedCount: number;
  averageStaleness: number;
  convergenceStatus: {
    converged: boolean;
    lossChange: number;
    accuracy?: number;
  };
}

export interface IncrementalUpdateResult {
  updatedWeights: {
    data: Float32Array[];
    shapes: number[][];
  };
  previousVersion: ModelVersion;
  newVersion: ModelVersion;
  updateWeight: number;
}

export interface ConvergenceTracker {
  version: number;
  loss: number;
  accuracy?: number;
  timestamp: number;
  lossHistory: number[];
  converged: boolean;
}

export interface AsyncFLSession {
  studyId: string;
  currentVersion: ModelVersion;
  convergenceTracker: ConvergenceTracker;
  updateHistory: UpdateStaleness[];
  startTime: number;
  lastUpdateTime: number;
}

export interface AsyncFLStats {
  totalUpdates: number;
  acceptedUpdates: number;
  rejectedUpdates: number;
  averageStaleness: number;
  currentVersion: number;
  convergenceStatus: {
    converged: boolean;
    finalLoss: number;
    finalAccuracy?: number;
  };
  participantStats: Map<
    string,
    {
      updateCount: number;
      averageStaleness: number;
      acceptanceRate: number;
    }
  >;
}
