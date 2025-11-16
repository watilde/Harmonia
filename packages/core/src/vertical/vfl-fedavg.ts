/**
 * VFL-FedAvg: Vertical Federated Averaging
 *
 * Extends FedAvg principles to vertical FL setting where participants have
 * different features. Instead of averaging model weights, we aggregate
 * intermediate representations (embeddings) with weighted strategies.
 *
 * Paper: Inspired by FedAvg (McMahan et al., 2017) adapted for vertical setting
 * Key innovation: Weighted embedding aggregation based on feature quality
 */

import type { EmbeddingUpdate, AggregatedEmbeddings, VFLConfig } from './types';

/**
 * Configuration for VFL-FedAvg
 */
export interface VFLFedAvgConfig {
  aggregationStrategy: 'weighted' | 'uniform' | 'quality-weighted';
  qualityMetric?: 'variance' | 'mutual-information' | 'contribution'; // For quality-weighted
  minParticipants: number;
  embeddingDim: number;
}

/**
 * Quality score for each participant's embeddings
 */
export interface EmbeddingQuality {
  siteId: string;
  variance: number; // Feature variance (higher = more informative)
  contributionScore: number; // Shapley-like contribution to prediction
  sampleCount: number;
}

/**
 * Compute feature variance for embedding quality assessment
 */
export function computeEmbeddingVariance(
  embeddings: Float32Array,
  shape: [number, number]
): number {
  const [batchSize, embeddingDim] = shape;
  let totalVariance = 0;

  // Compute variance for each embedding dimension
  for (let dim = 0; dim < embeddingDim; dim++) {
    let mean = 0;
    for (let i = 0; i < batchSize; i++) {
      mean += embeddings[i * embeddingDim + dim];
    }
    mean /= batchSize;

    let variance = 0;
    for (let i = 0; i < batchSize; i++) {
      const diff = embeddings[i * embeddingDim + dim] - mean;
      variance += diff * diff;
    }
    variance /= batchSize;
    totalVariance += variance;
  }

  return totalVariance / embeddingDim; // Average variance across dimensions
}

/**
 * Compute contribution score based on leave-one-out impact
 * Simplified version: uses embedding norm as proxy for contribution
 */
export function computeContributionScore(
  embeddings: Float32Array,
  shape: [number, number]
): number {
  const [batchSize, embeddingDim] = shape;
  let totalNorm = 0;

  for (let i = 0; i < batchSize; i++) {
    let norm = 0;
    for (let dim = 0; dim < embeddingDim; dim++) {
      const val = embeddings[i * embeddingDim + dim];
      norm += val * val;
    }
    totalNorm += Math.sqrt(norm);
  }

  return totalNorm / batchSize; // Average norm per sample
}

/**
 * Assess quality of embeddings from each participant
 */
export function assessEmbeddingQuality(
  updates: EmbeddingUpdate[],
  _metric: 'variance' | 'contribution' = 'variance'
): EmbeddingQuality[] {
  return updates.map((update) => {
    const variance = computeEmbeddingVariance(update.embeddings.data, update.embeddings.shape);

    const contributionScore = computeContributionScore(
      update.embeddings.data,
      update.embeddings.shape
    );

    return {
      siteId: update.siteId,
      variance,
      contributionScore,
      sampleCount: update.sampleCount,
    };
  });
}

/**
 * Aggregate embeddings from multiple participants using weighted strategy
 *
 * @param updates - Embedding updates from participants
 * @param config - VFL-FedAvg configuration
 * @returns Aggregated embeddings
 */
export function aggregateEmbeddings(
  updates: EmbeddingUpdate[],
  config: VFLFedAvgConfig
): AggregatedEmbeddings {
  if (updates.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${updates.length} < ${config.minParticipants}`);
  }

  const roundNumber = updates[0].roundNumber;

  // For vertical FL, we typically concatenate embeddings from different participants
  // since they represent different feature spaces
  if (config.aggregationStrategy === 'uniform' || config.aggregationStrategy === 'weighted') {
    return concatenateEmbeddings(updates, roundNumber);
  }

  // Quality-weighted aggregation: weight by feature quality
  if (config.aggregationStrategy === 'quality-weighted') {
    return qualityWeightedAggregation(updates, config, roundNumber);
  }

  throw new Error(`Unknown aggregation strategy: ${config.aggregationStrategy}`);
}

/**
 * Concatenate embeddings from all participants
 * This is the standard approach for vertical FL
 */
function concatenateEmbeddings(
  updates: EmbeddingUpdate[],
  roundNumber: number
): AggregatedEmbeddings {
  const batchSize = updates[0].embeddings.shape[0];
  const totalEmbeddingDim = updates.reduce((sum, u) => sum + u.embeddings.shape[1], 0);

  const concatenated = new Float32Array(batchSize * totalEmbeddingDim);

  let offset = 0;
  for (const update of updates) {
    const embeddingDim = update.embeddings.shape[1];
    for (let i = 0; i < batchSize; i++) {
      for (let j = 0; j < embeddingDim; j++) {
        concatenated[i * totalEmbeddingDim + offset + j] =
          update.embeddings.data[i * embeddingDim + j];
      }
    }
    offset += embeddingDim;
  }

  return {
    roundNumber,
    embeddings: {
      data: concatenated,
      shape: [batchSize, totalEmbeddingDim],
    },
    participantIds: updates.map((u) => u.siteId),
    aggregationMethod: 'concat',
  };
}

/**
 * Quality-weighted aggregation for vertical FL
 * Weight embeddings by their feature quality scores
 */
function qualityWeightedAggregation(
  updates: EmbeddingUpdate[],
  config: VFLFedAvgConfig,
  roundNumber: number
): AggregatedEmbeddings {
  const assessmentMetric =
    config.qualityMetric === 'mutual-information' ? 'variance' : config.qualityMetric || 'variance';
  const qualities = assessEmbeddingQuality(updates, assessmentMetric);

  // Compute weights based on quality scores
  const weightMetric =
    config.qualityMetric === 'mutual-information' ? 'variance' : config.qualityMetric || 'variance';
  const scores = qualities.map((q) =>
    weightMetric === 'variance' ? q.variance : q.contributionScore
  );
  const totalScore = scores.reduce((sum, s) => sum + s, 0);
  const weights = scores.map((s) => s / totalScore);

  const batchSize = updates[0].embeddings.shape[0];
  const totalEmbeddingDim = updates.reduce((sum, u) => sum + u.embeddings.shape[1], 0);

  const weighted = new Float32Array(batchSize * totalEmbeddingDim);

  let offset = 0;
  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];
    const weight = weights[i];
    const embeddingDim = update.embeddings.shape[1];

    for (let b = 0; b < batchSize; b++) {
      for (let d = 0; d < embeddingDim; d++) {
        weighted[b * totalEmbeddingDim + offset + d] =
          update.embeddings.data[b * embeddingDim + d] * weight;
      }
    }
    offset += embeddingDim;
  }

  return {
    roundNumber,
    embeddings: {
      data: weighted,
      shape: [batchSize, totalEmbeddingDim],
    },
    participantIds: updates.map((u) => u.siteId),
    aggregationMethod: 'concat',
  };
}

/**
 * Initialize VFL-FedAvg configuration from VFL config
 */
export function initializeVFLFedAvg(
  vflConfig: VFLConfig,
  aggregationStrategy: 'weighted' | 'uniform' | 'quality-weighted' = 'uniform'
): VFLFedAvgConfig {
  return {
    aggregationStrategy,
    qualityMetric: 'variance',
    minParticipants: Math.max(2, Math.floor(vflConfig.participants.length / 2)),
    embeddingDim: vflConfig.embeddingDim,
  };
}
