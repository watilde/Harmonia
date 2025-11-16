/**
 * Embedding Aggregation for Vertical Federated Learning
 *
 * Aggregates embeddings from multiple participants into a single
 * representation for top model training.
 */

import type { EmbeddingUpdate, AggregatedEmbeddings, CoordinatorConfig } from './types';

/**
 * Validate embedding updates before aggregation
 */
export function validateEmbeddingUpdates(
  updates: EmbeddingUpdate[],
  expectedRound: number,
  expectedEmbeddingDim: number
): void {
  if (updates.length === 0) {
    throw new Error('No embedding updates provided');
  }

  // Check all updates are from the same round
  const rounds = new Set(updates.map((u) => u.roundNumber));
  if (rounds.size > 1) {
    throw new Error(`Embedding updates from multiple rounds: ${Array.from(rounds).join(', ')}`);
  }

  if (!rounds.has(expectedRound)) {
    throw new Error(`Expected round ${expectedRound}, got ${Array.from(rounds)[0]}`);
  }

  // Check all updates have the same batch size
  const batchSizes = new Set(updates.map((u) => u.embeddings.shape[0]));
  if (batchSizes.size > 1) {
    throw new Error(`Inconsistent batch sizes: ${Array.from(batchSizes).join(', ')}`);
  }

  // Check embedding dimensions
  for (const update of updates) {
    if (update.embeddings.shape[1] !== expectedEmbeddingDim) {
      throw new Error(
        `Expected embedding dim ${expectedEmbeddingDim}, got ${update.embeddings.shape[1]} from ${update.siteId}`
      );
    }
  }

  // Check for duplicate site IDs
  const siteIds = updates.map((u) => u.siteId);
  const uniqueSiteIds = new Set(siteIds);
  if (uniqueSiteIds.size !== siteIds.length) {
    throw new Error('Duplicate site IDs in embedding updates');
  }
}

/**
 * Concatenate embeddings from all participants
 * Output shape: [batchSize, embeddingDim * numParticipants]
 */
export function concatenateEmbeddings(updates: EmbeddingUpdate[]): AggregatedEmbeddings {
  if (updates.length === 0) {
    throw new Error('No embeddings to concatenate');
  }

  const batchSize = updates[0].embeddings.shape[0];
  const embeddingDim = updates[0].embeddings.shape[1];
  const numParticipants = updates.length;

  // Sort by siteId for deterministic ordering
  const sortedUpdates = [...updates].sort((a, b) => a.siteId.localeCompare(b.siteId));

  // Allocate output array
  const totalDim = embeddingDim * numParticipants;
  const concatenated = new Float32Array(batchSize * totalDim);

  // Concatenate embeddings
  for (let i = 0; i < numParticipants; i++) {
    const embeddings = sortedUpdates[i].embeddings.data;
    const offset = i * embeddingDim;

    for (let batch = 0; batch < batchSize; batch++) {
      const srcStart = batch * embeddingDim;
      const dstStart = batch * totalDim + offset;

      for (let j = 0; j < embeddingDim; j++) {
        concatenated[dstStart + j] = embeddings[srcStart + j];
      }
    }
  }

  return {
    roundNumber: sortedUpdates[0].roundNumber,
    embeddings: {
      data: concatenated,
      shape: [batchSize, totalDim],
    },
    participantIds: sortedUpdates.map((u) => u.siteId),
    aggregationMethod: 'concat',
  };
}

/**
 * Sum embeddings from all participants (element-wise addition)
 * Output shape: [batchSize, embeddingDim]
 * Requires all participants to have the same embedding dimension
 */
export function sumEmbeddings(updates: EmbeddingUpdate[]): AggregatedEmbeddings {
  if (updates.length === 0) {
    throw new Error('No embeddings to sum');
  }

  const batchSize = updates[0].embeddings.shape[0];
  const embeddingDim = updates[0].embeddings.shape[1];

  // Allocate output array
  const summed = new Float32Array(batchSize * embeddingDim);
  summed.fill(0);

  // Sum embeddings
  for (const update of updates) {
    const embeddings = update.embeddings.data;
    for (let i = 0; i < embeddings.length; i++) {
      summed[i] += embeddings[i];
    }
  }

  return {
    roundNumber: updates[0].roundNumber,
    embeddings: {
      data: summed,
      shape: [batchSize, embeddingDim],
    },
    participantIds: updates.map((u) => u.siteId),
    aggregationMethod: 'sum',
  };
}

/**
 * Average embeddings from all participants
 * Output shape: [batchSize, embeddingDim]
 */
export function averageEmbeddings(updates: EmbeddingUpdate[]): AggregatedEmbeddings {
  const summed = sumEmbeddings(updates);
  const numParticipants = updates.length;

  // Divide by number of participants
  for (let i = 0; i < summed.embeddings.data.length; i++) {
    summed.embeddings.data[i] /= numParticipants;
  }

  return summed;
}

/**
 * Compute attention weights for each participant based on embedding quality
 * Uses cosine similarity between embeddings and a learned query vector
 */
export function computeAttentionWeights(updates: EmbeddingUpdate[]): Float32Array {
  if (updates.length === 0) {
    throw new Error('No embeddings for attention computation');
  }

  const batchSize = updates[0].embeddings.shape[0];
  const embeddingDim = updates[0].embeddings.shape[1];
  const numParticipants = updates.length;

  // Initialize attention weights (one per participant per sample)
  const attentionWeights = new Float32Array(batchSize * numParticipants);

  // For each sample in batch
  for (let batch = 0; batch < batchSize; batch++) {
    // Compute mean embedding across all participants as query vector
    const queryVector = new Float32Array(embeddingDim);
    queryVector.fill(0);

    for (const update of updates) {
      const embeddings = update.embeddings.data;
      const offset = batch * embeddingDim;
      for (let j = 0; j < embeddingDim; j++) {
        queryVector[j] += embeddings[offset + j];
      }
    }
    for (let j = 0; j < embeddingDim; j++) {
      queryVector[j] /= numParticipants;
    }

    // Compute attention scores (cosine similarity with query)
    const scores: number[] = [];
    let sumExp = 0;

    for (let i = 0; i < numParticipants; i++) {
      const update = updates[i];
      const embeddings = update.embeddings.data;
      const offset = batch * embeddingDim;

      // Compute dot product
      let dotProduct = 0;
      let normEmb = 0;
      let normQuery = 0;

      for (let j = 0; j < embeddingDim; j++) {
        const embVal = embeddings[offset + j];
        const queryVal = queryVector[j];
        dotProduct += embVal * queryVal;
        normEmb += embVal * embVal;
        normQuery += queryVal * queryVal;
      }

      // Cosine similarity (normalized dot product)
      const similarity =
        normEmb > 0 && normQuery > 0 ? dotProduct / (Math.sqrt(normEmb) * Math.sqrt(normQuery)) : 0;

      // Apply softmax (exp for numerical stability)
      const score = Math.exp(similarity);
      scores.push(score);
      sumExp += score;
    }

    // Normalize to get attention weights (softmax)
    for (let i = 0; i < numParticipants; i++) {
      attentionWeights[batch * numParticipants + i] = scores[i] / sumExp;
    }
  }

  return attentionWeights;
}

/**
 * Aggregate embeddings using attention mechanism
 * Computes weighted average based on learned attention weights
 * Output shape: [batchSize, embeddingDim]
 */
export function attentionEmbeddings(updates: EmbeddingUpdate[]): AggregatedEmbeddings {
  if (updates.length === 0) {
    throw new Error('No embeddings to aggregate');
  }

  const batchSize = updates[0].embeddings.shape[0];
  const embeddingDim = updates[0].embeddings.shape[1];
  const numParticipants = updates.length;

  // Compute attention weights
  const attentionWeights = computeAttentionWeights(updates);

  // Allocate output array
  const aggregated = new Float32Array(batchSize * embeddingDim);
  aggregated.fill(0);

  // Weighted sum using attention weights
  for (let batch = 0; batch < batchSize; batch++) {
    for (let i = 0; i < numParticipants; i++) {
      const weight = attentionWeights[batch * numParticipants + i];
      const embeddings = updates[i].embeddings.data;
      const embOffset = batch * embeddingDim;
      const outOffset = batch * embeddingDim;

      for (let j = 0; j < embeddingDim; j++) {
        aggregated[outOffset + j] += weight * embeddings[embOffset + j];
      }
    }
  }

  return {
    roundNumber: updates[0].roundNumber,
    embeddings: {
      data: aggregated,
      shape: [batchSize, embeddingDim],
    },
    participantIds: updates.map((u) => u.siteId),
    aggregationMethod: 'attention',
  };
}

/**
 * Aggregate embeddings based on configuration strategy
 */
export function aggregateEmbeddings(
  updates: EmbeddingUpdate[],
  config: CoordinatorConfig,
  expectedRound: number,
  expectedEmbeddingDim: number
): AggregatedEmbeddings {
  // Validate updates
  validateEmbeddingUpdates(updates, expectedRound, expectedEmbeddingDim);

  // Aggregate based on strategy
  switch (config.aggregationStrategy) {
    case 'concat':
      return concatenateEmbeddings(updates);
    case 'sum':
      return sumEmbeddings(updates);
    case 'attention':
      return attentionEmbeddings(updates);
    default:
      throw new Error(`Unknown aggregation strategy: ${config.aggregationStrategy}`);
  }
}

/**
 * Split aggregated gradients back to individual participants
 */
export function splitGradients(
  aggregatedGradients: Float32Array,
  aggregationMethod: 'concat' | 'sum' | 'attention',
  participantIds: string[],
  embeddingDim: number,
  roundNumber: number
): Map<string, GradientUpdate> {
  const result = new Map<string, GradientUpdate>();

  if (aggregationMethod === 'concat') {
    // Split concatenated gradients
    const batchSize = aggregatedGradients.length / (embeddingDim * participantIds.length);
    const totalDim = embeddingDim * participantIds.length;

    for (let i = 0; i < participantIds.length; i++) {
      const siteId = participantIds[i];
      const gradients = new Float32Array(batchSize * embeddingDim);
      const offset = i * embeddingDim;

      for (let batch = 0; batch < batchSize; batch++) {
        const srcStart = batch * totalDim + offset;
        const dstStart = batch * embeddingDim;

        for (let j = 0; j < embeddingDim; j++) {
          gradients[dstStart + j] = aggregatedGradients[srcStart + j];
        }
      }

      result.set(siteId, {
        siteId,
        roundNumber,
        gradients: {
          data: gradients,
          shape: [batchSize, embeddingDim],
        },
        timestamp: Date.now(),
        encrypted: false,
      });
    }
  } else if (aggregationMethod === 'sum') {
    // All participants get the same gradients
    const batchSize = aggregatedGradients.length / embeddingDim;

    for (const siteId of participantIds) {
      result.set(siteId, {
        siteId,
        roundNumber,
        gradients: {
          data: new Float32Array(aggregatedGradients),
          shape: [batchSize, embeddingDim],
        },
        timestamp: Date.now(),
        encrypted: false,
      });
    }
  } else {
    throw new Error(`Unsupported aggregation method: ${aggregationMethod}`);
  }

  return result;
}

/**
 * Import GradientUpdate type
 */
import type { GradientUpdate } from './types';
