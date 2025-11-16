/**
 * Staleness-aware Aggregation for Asynchronous Federated Learning
 */

import type { AsyncFLConfig, VersionedUpdate, UpdateStaleness } from './types';

export function calculateStaleness(update: VersionedUpdate, currentVersion: number): number {
  return Math.max(0, currentVersion - update.baseVersion);
}

export function calculateStalenessWeight(staleness: number, decayFactor: number): number {
  if (staleness < 0 || decayFactor < 0) {
    throw new Error('Staleness and decay factor must be non-negative');
  }
  return 1.0 / (1.0 + staleness * decayFactor);
}

export function shouldAcceptUpdate(
  update: VersionedUpdate,
  currentVersion: number,
  config: AsyncFLConfig
): { accepted: boolean; reason?: string } {
  const staleness = calculateStaleness(update, currentVersion);

  if (staleness > config.maxStaleness) {
    return {
      accepted: false,
      reason: `Staleness ${staleness} exceeds maximum ${config.maxStaleness}`,
    };
  }

  if (staleness < 0) {
    return {
      accepted: false,
      reason: `Update from future version`,
    };
  }

  return { accepted: true };
}

export function processUpdates(
  updates: VersionedUpdate[],
  currentVersion: number,
  config: AsyncFLConfig
): UpdateStaleness[] {
  return updates.map((update) => {
    const staleness = calculateStaleness(update, currentVersion);
    const { accepted, reason } = shouldAcceptUpdate(update, currentVersion, config);
    const weight = accepted ? calculateStalenessWeight(staleness, config.stalenessDecayFactor) : 0;

    return {
      update,
      currentVersion,
      staleness,
      weight,
      accepted,
      rejectionReason: reason,
    };
  });
}

export function getAcceptedUpdates(processedUpdates: UpdateStaleness[]): UpdateStaleness[] {
  return processedUpdates.filter((u) => u.accepted);
}

export function calculateAverageStaleness(processedUpdates: UpdateStaleness[]): number {
  const accepted = getAcceptedUpdates(processedUpdates);
  if (accepted.length === 0) return 0;
  return accepted.reduce((sum, u) => sum + u.staleness, 0) / accepted.length;
}

export function aggregateWithStaleness(
  processedUpdates: UpdateStaleness[],
  baseWeights: Float32Array[]
): Float32Array[] {
  const accepted = getAcceptedUpdates(processedUpdates);
  if (accepted.length === 0) {
    return baseWeights.map((w) => new Float32Array(w));
  }

  const totalWeight = accepted.reduce((sum, u) => sum + u.update.sampleCount * u.weight, 0);
  if (totalWeight === 0) return baseWeights.map((w) => new Float32Array(w));

  const aggregated: Float32Array[] = [];
  for (let layerIdx = 0; layerIdx < baseWeights.length; layerIdx++) {
    const layerSize = baseWeights[layerIdx].length;
    const aggregatedLayer = new Float32Array(layerSize);
    aggregatedLayer.fill(0);

    for (const update of accepted) {
      const updateWeight = (update.update.sampleCount * update.weight) / totalWeight;
      const updateLayer = update.update.weights.data[layerIdx];

      for (let i = 0; i < layerSize; i++) {
        aggregatedLayer[i] += updateLayer[i] * updateWeight;
      }
    }
    aggregated.push(aggregatedLayer);
  }

  return aggregated;
}

export function createDefaultAsyncFLConfig(): AsyncFLConfig {
  return {
    maxStaleness: 5,
    minUpdatesPerRound: 1,
    stalenessDecayFactor: 0.5,
    convergenceThreshold: 0.001,
    maxUpdates: 1000,
    incrementalLearning: true,
    incrementalLearningRate: 0.1,
  };
}

export function validateAsyncFLConfig(config: AsyncFLConfig): void {
  if (config.maxStaleness < 0) {
    throw new Error('maxStaleness must be non-negative');
  }
  if (config.minUpdatesPerRound < 0) {
    throw new Error('minUpdatesPerRound must be non-negative');
  }
  if (config.stalenessDecayFactor < 0) {
    throw new Error('stalenessDecayFactor must be non-negative');
  }
  if (config.convergenceThreshold < 0) {
    throw new Error('convergenceThreshold must be non-negative');
  }
  if (config.maxUpdates <= 0) {
    throw new Error('maxUpdates must be positive');
  }
  if (config.incrementalLearningRate <= 0 || config.incrementalLearningRate > 1) {
    throw new Error('incrementalLearningRate must be in (0, 1]');
  }
}
