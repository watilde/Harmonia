/**
 * Convergence Detection for Asynchronous Federated Learning
 */

import type { ConvergenceTracker, AsyncFLConfig } from './types';

export function initializeConvergenceTracker(): ConvergenceTracker {
  return {
    version: 0,
    loss: Infinity,
    accuracy: undefined,
    timestamp: Date.now(),
    lossHistory: [],
    converged: false,
  };
}

export function updateConvergenceTracker(
  tracker: ConvergenceTracker,
  version: number,
  loss: number,
  accuracy?: number,
  historySize: number = 10
): ConvergenceTracker {
  const newHistory = [...tracker.lossHistory, loss];
  if (newHistory.length > historySize) {
    newHistory.shift();
  }

  return {
    version,
    loss,
    accuracy,
    timestamp: Date.now(),
    lossHistory: newHistory,
    converged: tracker.converged,
  };
}

export function checkLossConvergence(
  tracker: ConvergenceTracker,
  threshold: number
): { converged: boolean; lossChange: number } {
  if (tracker.lossHistory.length < 2) {
    return { converged: false, lossChange: Infinity };
  }

  const currentLoss = tracker.loss;
  const previousLoss = tracker.lossHistory[tracker.lossHistory.length - 2];
  const lossChange = Math.abs(currentLoss - previousLoss) / previousLoss;

  return {
    converged: lossChange < threshold,
    lossChange,
  };
}

export function checkMovingAverageConvergence(
  tracker: ConvergenceTracker,
  threshold: number,
  windowSize: number = 5
): { converged: boolean; avgLossChange: number } {
  if (tracker.lossHistory.length < windowSize * 2) {
    return { converged: false, avgLossChange: Infinity };
  }

  const recentWindow = tracker.lossHistory.slice(-windowSize);
  const previousWindow = tracker.lossHistory.slice(-windowSize * 2, -windowSize);

  const recentAvg = recentWindow.reduce((a, b) => a + b, 0) / recentWindow.length;
  const previousAvg = previousWindow.reduce((a, b) => a + b, 0) / previousWindow.length;
  const avgLossChange = Math.abs(recentAvg - previousAvg) / previousAvg;

  return {
    converged: avgLossChange < threshold,
    avgLossChange,
  };
}

export function checkPlateauConvergence(
  tracker: ConvergenceTracker,
  threshold: number,
  patience: number = 5
): { converged: boolean; bestLoss: number; noImprovementCount: number } {
  if (tracker.lossHistory.length < patience) {
    return {
      converged: false,
      bestLoss: Math.min(...tracker.lossHistory),
      noImprovementCount: 0,
    };
  }

  const recentLosses = tracker.lossHistory.slice(-patience);
  const bestLoss = Math.min(...recentLosses);
  const currentLoss = tracker.loss;

  let noImprovementCount = 0;
  for (let i = recentLosses.length - 1; i >= 0; i--) {
    const localImprovement = (recentLosses[i] - currentLoss) / recentLosses[i];
    if (localImprovement < threshold) {
      noImprovementCount++;
    } else {
      break;
    }
  }

  return {
    converged: noImprovementCount >= patience,
    bestLoss,
    noImprovementCount,
  };
}

export function checkConvergence(
  tracker: ConvergenceTracker,
  config: AsyncFLConfig
): {
  converged: boolean;
  reason?: string;
  metrics: {
    lossChange?: number;
    avgLossChange?: number;
    plateauDetected?: boolean;
  };
} {
  if (tracker.lossHistory.length < 3) {
    return {
      converged: false,
      reason: 'Insufficient history',
      metrics: {},
    };
  }

  const { converged: lossConverged, lossChange } = checkLossConvergence(
    tracker,
    config.convergenceThreshold
  );
  if (lossConverged) {
    return {
      converged: true,
      reason: 'Loss change below threshold',
      metrics: { lossChange },
    };
  }

  const { converged: maConverged, avgLossChange } = checkMovingAverageConvergence(
    tracker,
    config.convergenceThreshold
  );
  if (maConverged) {
    return {
      converged: true,
      reason: 'Moving average loss converged',
      metrics: { avgLossChange },
    };
  }

  const { converged: plateauConverged, noImprovementCount } = checkPlateauConvergence(
    tracker,
    config.convergenceThreshold
  );
  if (plateauConverged) {
    return {
      converged: true,
      reason: `Plateau detected (${noImprovementCount} updates)`,
      metrics: { plateauDetected: true },
    };
  }

  return {
    converged: false,
    metrics: { lossChange, avgLossChange },
  };
}

export function calculateConvergenceRate(
  tracker: ConvergenceTracker,
  windowSize: number = 5
): number {
  if (tracker.lossHistory.length < windowSize) return 0;

  const recentLosses = tracker.lossHistory.slice(-windowSize);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < recentLosses.length; i++) {
    sumX += i;
    sumY += recentLosses[i];
    sumXY += i * recentLosses[i];
    sumX2 += i * i;
  }

  const n = recentLosses.length;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return -slope;
}

export function predictConvergenceTime(
  tracker: ConvergenceTracker,
  threshold: number
): { estimatedUpdates: number; confident: boolean } {
  const rate = calculateConvergenceRate(tracker);

  if (rate <= 0) {
    return {
      estimatedUpdates: Infinity,
      confident: false,
    };
  }

  const currentLoss = tracker.loss;
  const targetImprovement = currentLoss * threshold;
  const estimatedUpdates = Math.ceil(targetImprovement / rate);
  const confident = tracker.lossHistory.length >= 10 && calculateConvergenceRate(tracker, 3) > 0;

  return {
    estimatedUpdates,
    confident,
  };
}
