/**
 * FedMD: Federated Model Distillation
 *
 * Enables knowledge transfer across heterogeneous domains through
 * model distillation using a public dataset. Participants can have
 * different feature spaces, label spaces, and model architectures.
 *
 * Paper: Li & Wang (2019) "FedMD: Heterogeneous Federated Learning
 * via Model Distillation"
 *
 * Key innovation: Knowledge transfer through soft labels on public data
 */

/**
 * Configuration for FedMD
 */
export interface FedMDConfig {
  studyId: string;
  totalRounds: number;
  publicDatasetSize: number; // Size of public dataset for distillation
  distillationTemperature: number; // Temperature for softmax (typically 1-5)
  consensusThreshold: number; // Minimum agreement threshold (0-1)
  minParticipants: number;
}

/**
 * Participant in FedMD (can have different domains/architectures)
 */
export interface FedMDParticipant {
  siteId: string;
  domain: string; // e.g., 'hospital-A', 'clinic-B'
  featureSpace: string; // Description of features available
  labelSpace: number; // Number of classes (can differ across participants)
  modelArchitecture: string; // Model type identifier
  dataSize: number; // Private dataset size
}

/**
 * Soft predictions (logits) from a participant on public dataset
 */
export interface SoftPredictions {
  siteId: string;
  roundNumber: number;
  predictions: Float32Array; // Shape: [publicDatasetSize, numClasses]
  numClasses: number;
  publicDatasetSize: number;
  temperature: number; // Temperature used for softmax
  timestamp: number;
}

/**
 * Consensus predictions aggregated from all participants
 */
export interface ConsensusPredictions {
  roundNumber: number;
  predictions: Float32Array; // Shape: [publicDatasetSize, maxNumClasses]
  numClasses: number;
  participantCount: number;
  agreement: number; // Agreement score (0-1)
  timestamp: number;
}

/**
 * Apply temperature scaling to logits (softmax with temperature)
 *
 * @param logits - Raw model outputs
 * @param temperature - Temperature parameter (higher = softer distribution)
 * @returns Softened probabilities
 */
export function applyTemperatureScaling(
  logits: Float32Array,
  numClasses: number,
  temperature: number
): Float32Array {
  const numSamples = logits.length / numClasses;
  const scaled = new Float32Array(logits.length);

  for (let i = 0; i < numSamples; i++) {
    // Find max logit for numerical stability
    let maxLogit = -Infinity;
    for (let c = 0; c < numClasses; c++) {
      maxLogit = Math.max(maxLogit, logits[i * numClasses + c]);
    }

    // Compute exp(logit/T) / sum(exp(logit/T))
    let sum = 0;
    for (let c = 0; c < numClasses; c++) {
      const scaledLogit = (logits[i * numClasses + c] - maxLogit) / temperature;
      scaled[i * numClasses + c] = Math.exp(scaledLogit);
      sum += scaled[i * numClasses + c];
    }

    // Normalize to probabilities
    for (let c = 0; c < numClasses; c++) {
      scaled[i * numClasses + c] /= sum;
    }
  }

  return scaled;
}

/**
 * Aggregate soft predictions from multiple participants
 *
 * Uses weighted averaging based on participant data sizes.
 * Handles different label spaces by padding/aligning.
 */
export function aggregateSoftPredictions(
  predictions: SoftPredictions[],
  participants: FedMDParticipant[],
  config: FedMDConfig
): ConsensusPredictions {
  if (predictions.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${predictions.length} < ${config.minParticipants}`);
  }

  const roundNumber = predictions[0].roundNumber;
  const publicDatasetSize = predictions[0].publicDatasetSize;

  // Find maximum number of classes across all participants
  const maxNumClasses = Math.max(...predictions.map((p) => p.numClasses));

  // Compute weights based on data sizes
  const participantMap = new Map(participants.map((p) => [p.siteId, p]));
  const totalDataSize = predictions.reduce((sum, pred) => {
    const participant = participantMap.get(pred.siteId);
    return sum + (participant?.dataSize || 1);
  }, 0);

  const weights = predictions.map((pred) => {
    const participant = participantMap.get(pred.siteId);
    return (participant?.dataSize || 1) / totalDataSize;
  });

  // Initialize consensus predictions
  const consensus = new Float32Array(publicDatasetSize * maxNumClasses);

  // Weighted average of predictions (with alignment for different label spaces)
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const weight = weights[i];
    const numClasses = pred.numClasses;

    for (let sample = 0; sample < publicDatasetSize; sample++) {
      for (let c = 0; c < numClasses; c++) {
        consensus[sample * maxNumClasses + c] += weight * pred.predictions[sample * numClasses + c];
      }
      // If participant has fewer classes, remaining classes get 0 contribution
    }
  }

  // Compute agreement score (entropy-based)
  const agreement = computeAgreementScore(consensus, publicDatasetSize, maxNumClasses);

  return {
    roundNumber,
    predictions: consensus,
    numClasses: maxNumClasses,
    participantCount: predictions.length,
    agreement,
    timestamp: Date.now(),
  };
}

/**
 * Compute agreement score based on prediction entropy
 *
 * Lower entropy = higher agreement
 * Returns score in [0, 1] where 1 = perfect agreement
 */
function computeAgreementScore(
  predictions: Float32Array,
  numSamples: number,
  numClasses: number
): number {
  let totalEntropy = 0;
  const maxEntropy = Math.log(numClasses); // Maximum possible entropy

  for (let i = 0; i < numSamples; i++) {
    let entropy = 0;
    for (let c = 0; c < numClasses; c++) {
      const p = predictions[i * numClasses + c];
      if (p > 0) {
        entropy -= p * Math.log(p);
      }
    }
    totalEntropy += entropy;
  }

  const avgEntropy = totalEntropy / numSamples;
  return 1 - avgEntropy / maxEntropy; // Normalize to [0, 1]
}

/**
 * Compute KL divergence for distillation loss
 *
 * KL(consensus || local) measures how much local predictions diverge from consensus
 */
export function computeDistillationLoss(
  localPredictions: Float32Array,
  consensusPredictions: Float32Array,
  numSamples: number,
  numClasses: number
): number {
  let totalKL = 0;

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numClasses; c++) {
      const p = consensusPredictions[i * numClasses + c];
      const q = localPredictions[i * numClasses + c];

      if (p > 0 && q > 0) {
        totalKL += p * Math.log(p / q);
      }
    }
  }

  return totalKL / numSamples;
}

/**
 * Create distillation dataset from consensus predictions
 *
 * Returns pseudo-labels for training local models
 */
export function createDistillationDataset(
  publicData: Float32Array[], // Public features
  consensus: ConsensusPredictions
): {
  features: Float32Array[];
  softLabels: Float32Array; // Soft labels for distillation
  hardLabels: Uint8Array; // Hard labels (argmax)
} {
  const numSamples = publicData.length;
  const numClasses = consensus.numClasses;

  const softLabels = consensus.predictions;
  const hardLabels = new Uint8Array(numSamples);

  // Generate hard labels by taking argmax
  for (let i = 0; i < numSamples; i++) {
    let maxProb = -Infinity;
    let maxClass = 0;

    for (let c = 0; c < numClasses; c++) {
      const prob = consensus.predictions[i * numClasses + c];
      if (prob > maxProb) {
        maxProb = prob;
        maxClass = c;
      }
    }

    hardLabels[i] = maxClass;
  }

  return {
    features: publicData,
    softLabels,
    hardLabels,
  };
}

/**
 * Check if consensus meets threshold for reliable distillation
 */
export function validateConsensus(
  consensus: ConsensusPredictions,
  config: FedMDConfig
): { valid: boolean; reason?: string } {
  if (consensus.participantCount < config.minParticipants) {
    return {
      valid: false,
      reason: `Insufficient participants: ${consensus.participantCount} < ${config.minParticipants}`,
    };
  }

  if (consensus.agreement < config.consensusThreshold) {
    return {
      valid: false,
      reason: `Low agreement: ${consensus.agreement.toFixed(3)} < ${config.consensusThreshold}`,
    };
  }

  return { valid: true };
}

/**
 * Initialize FedMD configuration
 */
export function initializeFedMD(
  studyId: string,
  participantCount: number,
  publicDatasetSize: number = 1000
): FedMDConfig {
  return {
    studyId,
    totalRounds: 20,
    publicDatasetSize,
    distillationTemperature: 3.0, // Softer predictions for better transfer
    consensusThreshold: 0.6, // Require 60% agreement
    minParticipants: Math.max(2, Math.floor(participantCount * 0.5)),
  };
}

/**
 * FedMD Round Summary
 */
export interface FedMDRoundSummary {
  roundNumber: number;
  participantCount: number;
  agreement: number;
  avgDistillationLoss: number;
  consensusEntropy: number;
  timestamp: number;
}

/**
 * Track FedMD training progress
 */
export class FedMDTracker {
  private rounds: FedMDRoundSummary[] = [];

  addRound(summary: FedMDRoundSummary): void {
    this.rounds.push(summary);
  }

  getCurrentRound(): number {
    return this.rounds.length;
  }

  getAverageAgreement(): number {
    if (this.rounds.length === 0) return 0;
    const sum = this.rounds.reduce((s, r) => s + r.agreement, 0);
    return sum / this.rounds.length;
  }

  getSummary(): {
    totalRounds: number;
    avgAgreement: number;
    finalAgreement: number;
    improvementRate: number;
  } {
    if (this.rounds.length === 0) {
      return {
        totalRounds: 0,
        avgAgreement: 0,
        finalAgreement: 0,
        improvementRate: 0,
      };
    }

    const finalRound = this.rounds[this.rounds.length - 1];
    const firstRound = this.rounds[0];
    const improvementRate = (finalRound.agreement - firstRound.agreement) / firstRound.agreement;

    return {
      totalRounds: this.rounds.length,
      avgAgreement: this.getAverageAgreement(),
      finalAgreement: finalRound.agreement,
      improvementRate,
    };
  }
}
