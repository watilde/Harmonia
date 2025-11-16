'use strict';
/**
 * Federated Proximal (FedProx) Algorithm
 * Li et al., 2020: Federated Optimization in Heterogeneous Networks
 *
 * FedProx adds a proximal term to handle non-IID data and system heterogeneity.
 * Loss: L(w) + (μ/2)||w - w_global||²
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
exports.DEFAULT_FEDPROX_CONFIG = void 0;
exports.computeProximalTerm = computeProximalTerm;
exports.applyProximalRegularization = applyProximalRegularization;
exports.aggregateFedProx = aggregateFedProx;
const tf = __importStar(require('@tensorflow/tfjs-node'));
const fedavg_1 = require('./fedavg');
/**
 * Compute proximal term for local training
 * Returns the gradient of (μ/2)||w - w_global||²
 */
function computeProximalTerm(localWeights, globalWeights, mu) {
  if (localWeights.length !== globalWeights.length) {
    throw new Error('Weight dimensions mismatch');
  }
  return localWeights.map((local, i) => {
    // ∇(μ/2)||w - w_global||² = μ(w - w_global)
    return tf.mul(tf.sub(local, globalWeights[i]), mu);
  });
}
/**
 * Apply proximal regularization during local training
 * Should be called at each training step
 */
function applyProximalRegularization(model, globalWeights, mu) {
  const localWeights = model.getWeights();
  const globalWeightsTensors = (0, fedavg_1.deserializeWeights)(globalWeights);
  // Compute (μ/2)||w - w_global||²
  let proximalLoss = tf.scalar(0);
  for (let i = 0; i < localWeights.length; i++) {
    const diff = tf.sub(localWeights[i], globalWeightsTensors[i]);
    const squaredNorm = tf.sum(tf.square(diff));
    const weighted = tf.mul(squaredNorm, mu / 2);
    proximalLoss = tf.add(proximalLoss, weighted);
    diff.dispose();
    squaredNorm.dispose();
    weighted.dispose();
  }
  globalWeightsTensors.forEach((w) => w.dispose());
  return proximalLoss;
}
/**
 * Aggregate client updates with FedProx
 * Aggregation is same as FedAvg, but local training includes proximal term
 */
function aggregateFedProx(updates, config) {
  if (updates.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${updates.length} < ${config.minParticipants}`);
  }
  const totalSamples =
    config.aggregationStrategy === 'weighted'
      ? updates.reduce((sum, update) => sum + update.sampleCount, 0)
      : updates.length;
  const clientWeights = updates.map((update) => (0, fedavg_1.deserializeWeights)(update.weights));
  const aggregated = clientWeights[0].map((w) => tf.zerosLike(w));
  // Weighted averaging (same as FedAvg)
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
  const result = (0, fedavg_1.serializeWeights)(aggregated);
  // Cleanup
  aggregated.forEach((t) => t.dispose());
  clientWeights.forEach((weights) => weights.forEach((w) => w.dispose()));
  return result;
}
/**
 * Default FedProx configuration
 */
exports.DEFAULT_FEDPROX_CONFIG = {
  mu: 0.01, // Small mu for similar data, larger (0.1-1.0) for highly non-IID
  minParticipants: 2,
  aggregationStrategy: 'weighted',
};
