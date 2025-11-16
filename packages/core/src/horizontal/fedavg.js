'use strict';
/**
 * Federated Averaging (FedAvg) Algorithm
 * McMahan et al., 2017: Communication-Efficient Learning of Deep Networks from Decentralized Data
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
exports.serializeWeights = serializeWeights;
exports.deserializeWeights = deserializeWeights;
exports.aggregateWeights = aggregateWeights;
exports.initializeGlobalModel = initializeGlobalModel;
exports.updateGlobalModel = updateGlobalModel;
const tf = __importStar(require('@tensorflow/tfjs-node'));
/**
 * Serialize TensorFlow.js model weights for transmission
 */
function serializeWeights(weights) {
  return {
    shapes: weights.map((w) => w.shape),
    data: weights.map((w) => w.dataSync()),
  };
}
/**
 * Deserialize weights back to TensorFlow.js tensors
 */
function deserializeWeights(serialized) {
  return serialized.shapes.map((shape, i) => tf.tensor(serialized.data[i], shape));
}
/**
 * Aggregate client updates using weighted averaging
 */
function aggregateWeights(updates, config) {
  if (updates.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${updates.length} < ${config.minParticipants}`);
  }
  const totalSamples =
    config.aggregationStrategy === 'weighted'
      ? updates.reduce((sum, update) => sum + update.sampleCount, 0)
      : updates.length;
  // Deserialize all client weights
  const clientWeights = updates.map((update) => deserializeWeights(update.weights));
  // Initialize aggregated weights with zeros
  const aggregated = clientWeights[0].map((w) => tf.zerosLike(w));
  // Weighted sum of all client weights
  for (let i = 0; i < updates.length; i++) {
    const weight =
      config.aggregationStrategy === 'weighted'
        ? updates[i].sampleCount / totalSamples
        : 1 / updates.length;
    for (let j = 0; j < aggregated.length; j++) {
      const weighted = tf.mul(clientWeights[i][j], weight);
      const newAgg = tf.add(aggregated[j], weighted);
      aggregated[j].dispose();
      aggregated[j] = newAgg;
      weighted.dispose();
    }
  }
  // Serialize aggregated weights
  const result = serializeWeights(aggregated);
  // Clean up tensors
  aggregated.forEach((t) => t.dispose());
  clientWeights.forEach((weights) => weights.forEach((w) => w.dispose()));
  return result;
}
/**
 * Create initial global model
 */
function initializeGlobalModel(initialWeights, totalRounds) {
  return {
    weights: initialWeights,
    round: {
      roundNumber: 0,
      totalRounds,
      participantCount: 0,
      timestamp: new Date(),
    },
    aggregatedSamples: 0,
  };
}
/**
 * Update global model with aggregated weights
 */
function updateGlobalModel(currentModel, updates, config) {
  const aggregatedWeights = aggregateWeights(updates, config);
  const totalSamples = updates.reduce((sum, update) => sum + update.sampleCount, 0);
  return {
    weights: aggregatedWeights,
    round: {
      roundNumber: currentModel.round.roundNumber + 1,
      totalRounds: currentModel.round.totalRounds,
      participantCount: updates.length,
      timestamp: new Date(),
    },
    aggregatedSamples: currentModel.aggregatedSamples + totalSamples,
  };
}
