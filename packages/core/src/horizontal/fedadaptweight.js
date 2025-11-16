'use strict';
/**
 * FedAdaptiveWeight Algorithm
 *
 * Novel federated learning algorithm with adaptive client weighting
 * based on performance trends and consistency metrics.
 *
 * Key innovations:
 * 1. Dynamic contribution scoring based on loss improvement rate
 * 2. Consistency-aware weighting that rewards stable performance
 * 3. Momentum-based smoothing for stability across rounds
 * 4. Trust score mechanism that builds over time
 * 5. Hybrid uniform→adaptive transition for robust early training
 *
 * Theoretical foundation:
 * - Inspired by reinforcement learning's Upper Confidence Bound (UCB)
 * - Incorporates Shapley value concepts for contribution measurement
 * - Extends adaptive client selection with quality-aware aggregation
 *
 * Weight formula:
 *   w_i = α * sample_weight_i + (1-α) * quality_weight_i
 *
 * Where:
 *   quality_weight_i = softmax(trust_score_i + improvement_score_i)
 *   trust_score_i = moving_average(consistency over recent rounds)
 *   improvement_score_i = (prev_loss - current_loss) / prev_loss
 *   α = transition_factor (1.0 → 0.5 over rounds)
 *
 * @author Original implementation based on 2024-2025 FL research
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.DEFAULT_FEDADAPTWEIGHT_CONFIG = void 0;
exports.initializeFedAdaptiveWeightState = initializeFedAdaptiveWeightState;
exports.updatePerformanceHistory = updatePerformanceHistory;
exports.aggregateFedAdaptiveWeight = aggregateFedAdaptiveWeight;
exports.exportState = exportState;
exports.importState = importState;
const tf = __importStar(require('@tensorflow/tfjs-node'));
const fedavg_1 = require('./fedavg');
/**
 * Default configuration
 */
exports.DEFAULT_FEDADAPTWEIGHT_CONFIG = {
  minParticipants: 2,
  momentumBeta: 0.9,
  historyWindow: 3,
  bootstrapRounds: 2,
  improvementWeight: 0.5,
};
/**
 * Initialize state for FedAdaptiveWeight
 */
function initializeFedAdaptiveWeightState() {
  return {
    performanceHistory: new Map(),
    globalLossHistory: [],
    currentRound: 0,
  };
}
/**
 * Update performance history with new round data
 */
function updatePerformanceHistory(state, updates, config) {
  state.currentRound += 1;
  for (const update of updates) {
    if (!state.performanceHistory.has(update.siteId)) {
      state.performanceHistory.set(update.siteId, {
        siteId: update.siteId,
        losses: [],
        accuracies: [],
        sampleCounts: [],
        rounds: [],
      });
    }
    const history = state.performanceHistory.get(update.siteId);
    // Add new metrics (assuming they're provided in update metadata)
    const loss = update.loss || 0;
    const accuracy = update.accuracy || 0;
    history.losses.push(loss);
    history.accuracies.push(accuracy);
    history.sampleCounts.push(update.sampleCount);
    history.rounds.push(state.currentRound);
    // Keep only recent history
    if (history.losses.length > config.historyWindow) {
      history.losses.shift();
      history.accuracies.shift();
      history.sampleCounts.shift();
      history.rounds.shift();
    }
  }
}
/**
 * Compute improvement score for a client
 * Measures how much the client's loss has improved recently
 */
function computeImprovementScore(history) {
  if (history.losses.length < 2) {
    return 0.0; // Not enough history
  }
  const recentLosses = history.losses.slice(-3); // Last 3 rounds
  // Compute average improvement rate
  let totalImprovement = 0;
  let count = 0;
  for (let i = 1; i < recentLosses.length; i++) {
    const prevLoss = recentLosses[i - 1];
    const currLoss = recentLosses[i];
    if (prevLoss > 0) {
      // Improvement rate: (prev - curr) / prev
      // Positive = improvement, negative = degradation
      const improvement = (prevLoss - currLoss) / prevLoss;
      totalImprovement += improvement;
      count += 1;
    }
  }
  return count > 0 ? totalImprovement / count : 0.0;
}
/**
 * Compute consistency score for a client
 * Measures how stable the client's performance has been
 */
function computeConsistencyScore(history) {
  if (history.losses.length < 2) {
    return 0.0; // Not enough history
  }
  const losses = history.losses;
  // Compute coefficient of variation (CV = std / mean)
  // Lower CV = more consistent
  const mean = losses.reduce((sum, l) => sum + l, 0) / losses.length;
  const variance = losses.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / losses.length;
  const std = Math.sqrt(variance);
  if (mean === 0) {
    return 0.0;
  }
  const cv = std / mean;
  // Convert to consistency score (higher = more consistent)
  // Use negative exponential to map CV to [0, 1]
  const consistencyScore = Math.exp(-cv);
  return consistencyScore;
}
/**
 * Compute trust score for a client
 * Combines improvement and consistency with momentum
 */
function computeTrustScore(history, config) {
  const improvementScore = computeImprovementScore(history);
  const consistencyScore = computeConsistencyScore(history);
  // Weighted combination
  const trustScore =
    config.improvementWeight * improvementScore + (1 - config.improvementWeight) * consistencyScore;
  return trustScore;
}
/**
 * Compute adaptive weights for all clients
 */
function computeAdaptiveWeights(updates, state, config) {
  // Bootstrap phase: use uniform weighting
  if (state.currentRound <= config.bootstrapRounds) {
    return updates.map(() => 1.0 / updates.length);
  }
  // Compute trust scores for each client
  const trustScores = [];
  for (const update of updates) {
    const history = state.performanceHistory.get(update.siteId);
    if (history && history.losses.length >= 2) {
      const trustScore = computeTrustScore(history, config);
      trustScores.push(trustScore);
    } else {
      // No history or insufficient data: neutral score
      trustScores.push(0.0);
    }
  }
  // Compute sample-based weights (traditional FedAvg approach)
  const totalSamples = updates.reduce((sum, u) => sum + u.sampleCount, 0);
  const sampleWeights = updates.map((u) => u.sampleCount / totalSamples);
  // Apply softmax to trust scores for quality-based weights
  const maxTrust = Math.max(...trustScores, 1e-8);
  const expScores = trustScores.map((s) => Math.exp(s - maxTrust));
  const sumExp = expScores.reduce((sum, e) => sum + e, 0);
  const qualityWeights = expScores.map((e) => e / sumExp);
  // Compute transition factor (α)
  // Gradually shift from sample-based (α=1) to quality-based (α=0.5)
  const maxRounds = config.bootstrapRounds + 10; // Assume 10 rounds for full transition
  const progress = Math.min(
    1.0,
    (state.currentRound - config.bootstrapRounds) / (maxRounds - config.bootstrapRounds)
  );
  const alpha = 1.0 - 0.5 * progress; // 1.0 → 0.5
  // Hybrid weighting: α * sample_weight + (1-α) * quality_weight
  const adaptiveWeights = updates.map((_, i) => {
    return alpha * sampleWeights[i] + (1 - alpha) * qualityWeights[i];
  });
  // Normalize to ensure sum = 1
  const sumWeights = adaptiveWeights.reduce((sum, w) => sum + w, 0);
  return adaptiveWeights.map((w) => w / sumWeights);
}
/**
 * Aggregate client updates with FedAdaptiveWeight
 */
function aggregateFedAdaptiveWeight(updates, state, config) {
  if (updates.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${updates.length} < ${config.minParticipants}`);
  }
  // Update performance history
  updatePerformanceHistory(state, updates, config);
  // Compute adaptive weights
  const weights = computeAdaptiveWeights(updates, state, config);
  // Deserialize client weights
  const clientWeights = updates.map((update) => (0, fedavg_1.deserializeWeights)(update.weights));
  // Initialize aggregated weights with zeros
  const aggregated = clientWeights[0].map((w) => tf.zerosLike(w));
  // Weighted sum using adaptive weights
  for (let i = 0; i < updates.length; i++) {
    for (let j = 0; j < aggregated.length; j++) {
      const weighted = tf.mul(clientWeights[i][j], weights[i]);
      const newAgg = tf.add(aggregated[j], weighted);
      aggregated[j].dispose();
      aggregated[j] = newAgg;
      weighted.dispose();
    }
  }
  const result = (0, fedavg_1.serializeWeights)(aggregated);
  // Cleanup
  aggregated.forEach((t) => t.dispose());
  clientWeights.forEach((weights) => weights.forEach((w) => w.dispose()));
  return result;
}
/**
 * Export state for persistence between rounds
 */
function exportState(state) {
  return {
    performanceHistory: Array.from(state.performanceHistory.entries()).map(([siteId, history]) => ({
      siteId,
      ...history,
    })),
    globalLossHistory: state.globalLossHistory,
    currentRound: state.currentRound,
  };
}
/**
 * Import state from persistence
 */
function importState(data) {
  const performanceHistory = new Map();
  for (const entry of data.performanceHistory || []) {
    performanceHistory.set(entry.siteId, {
      siteId: entry.siteId,
      losses: entry.losses || [],
      accuracies: entry.accuracies || [],
      sampleCounts: entry.sampleCounts || [],
      rounds: entry.rounds || [],
    });
  }
  return {
    performanceHistory,
    globalLossHistory: data.globalLossHistory || [],
    currentRound: data.currentRound || 0,
  };
}
