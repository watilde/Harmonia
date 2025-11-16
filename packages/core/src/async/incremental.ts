/**
 * Incremental Learning for Asynchronous Federated Learning
 */

import type {
  AsyncFLConfig,
  ModelVersion,
  IncrementalUpdateResult,
  VersionedUpdate,
} from './types';

export function applyIncrementalUpdate(
  currentWeights: Float32Array[],
  updateWeights: Float32Array[],
  learningRate: number,
  stalenessWeight: number = 1.0
): Float32Array[] {
  if (currentWeights.length !== updateWeights.length) {
    throw new Error('Weight array length mismatch');
  }
  if (learningRate <= 0 || learningRate > 1) {
    throw new Error('Learning rate must be in (0, 1]');
  }
  if (stalenessWeight < 0 || stalenessWeight > 1) {
    throw new Error('Staleness weight must be in [0, 1]');
  }

  const effectiveLR = learningRate * stalenessWeight;
  const retentionRate = 1.0 - effectiveLR;
  const updated: Float32Array[] = [];

  for (let layerIdx = 0; layerIdx < currentWeights.length; layerIdx++) {
    const currentLayer = currentWeights[layerIdx];
    const updateLayer = updateWeights[layerIdx];

    if (currentLayer.length !== updateLayer.length) {
      throw new Error(`Layer ${layerIdx} size mismatch`);
    }

    const updatedLayer = new Float32Array(currentLayer.length);
    for (let i = 0; i < currentLayer.length; i++) {
      updatedLayer[i] = retentionRate * currentLayer[i] + effectiveLR * updateLayer[i];
    }
    updated.push(updatedLayer);
  }

  return updated;
}

export function updateMovingAverage(currentAvg: number, newValue: number, alpha: number): number {
  if (alpha <= 0 || alpha > 1) {
    throw new Error('Alpha must be in (0, 1]');
  }
  return alpha * newValue + (1 - alpha) * currentAvg;
}

export function performIncrementalUpdate(
  currentWeights: Float32Array[],
  previousVersion: ModelVersion,
  update: VersionedUpdate,
  config: AsyncFLConfig,
  stalenessWeight: number
): IncrementalUpdateResult {
  const updatedWeights = applyIncrementalUpdate(
    currentWeights,
    update.weights.data,
    config.incrementalLearningRate,
    stalenessWeight
  );

  const newVersion: ModelVersion = {
    version: previousVersion.version + 1,
    timestamp: Date.now(),
    loss: update.metrics.loss,
    accuracy: update.metrics.accuracy,
    updateCount: previousVersion.updateCount + 1,
  };

  return {
    updatedWeights: {
      data: updatedWeights,
      shapes: update.weights.shapes,
    },
    previousVersion,
    newVersion,
    updateWeight: stalenessWeight,
  };
}

export function detectCatastrophicForgetting(
  previousLoss: number,
  currentLoss: number,
  threshold: number = 0.5
): { forgetting: boolean; lossIncrease: number } {
  const lossIncrease = (currentLoss - previousLoss) / previousLoss;
  return {
    forgetting: lossIncrease > threshold,
    lossIncrease,
  };
}

export function initializeMomentum(weights: Float32Array[]): Float32Array[] {
  return weights.map((layer) => new Float32Array(layer.length));
}

export function adaptLearningRate(
  currentLR: number,
  lossHistory: number[],
  minLR: number = 0.01,
  maxLR: number = 0.5
): number {
  if (lossHistory.length < 3) return currentLR;

  const recent = lossHistory.slice(-3);
  const isOscillating =
    (recent[1] > recent[0] && recent[2] < recent[1]) ||
    (recent[1] < recent[0] && recent[2] > recent[1]);

  if (isOscillating) {
    return Math.max(minLR, currentLR * 0.8);
  }

  const recentChange = Math.abs(recent[2] - recent[0]) / recent[0];
  if (recentChange < 0.001) {
    return Math.min(maxLR, currentLR * 1.1);
  }

  return currentLR;
}

export function applyMomentum(
  currentWeights: Float32Array[],
  updateWeights: Float32Array[],
  momentum: Float32Array[],
  momentumFactor: number = 0.9
): { updated: Float32Array[]; newMomentum: Float32Array[] } {
  if (momentumFactor < 0 || momentumFactor >= 1) {
    throw new Error('Momentum factor must be in [0, 1)');
  }

  const updated: Float32Array[] = [];
  const newMomentum: Float32Array[] = [];

  for (let layerIdx = 0; layerIdx < currentWeights.length; layerIdx++) {
    const currentLayer = currentWeights[layerIdx];
    const updateLayer = updateWeights[layerIdx];
    const momentumLayer = momentum[layerIdx];

    const updatedMomentum = new Float32Array(momentumLayer.length);
    const updatedLayer = new Float32Array(currentLayer.length);

    for (let i = 0; i < currentLayer.length; i++) {
      const delta = updateLayer[i] - currentLayer[i];
      updatedMomentum[i] = momentumFactor * momentumLayer[i] + (1 - momentumFactor) * delta;
      updatedLayer[i] = currentLayer[i] + updatedMomentum[i];
    }

    updated.push(updatedLayer);
    newMomentum.push(updatedMomentum);
  }

  return { updated, newMomentum };
}
