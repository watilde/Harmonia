/**
 * FMTL: Federated Multi-Task Learning
 *
 * Learns relationships between related tasks across sites.
 * Each site may have a different (but related) task, and FMTL
 * enables knowledge transfer through shared representations.
 *
 * Paper: Smith et al. (2017) "Federated Multi-Task Learning"
 *
 * Key innovation: Learn task relationships while preserving privacy
 */

/**
 * Configuration for FMTL
 */
export interface FMTLConfig {
  studyId: string;
  totalRounds: number;
  sharedLayerDepth: number; // How many layers to share across tasks
  taskSpecificLayers: number; // Task-specific layers per site
  regularizationStrength: number; // Lambda for task relationship regularization
  minParticipants: number;
}

/**
 * Task definition for a participant
 */
export interface Task {
  taskId: string;
  siteId: string;
  taskType: 'classification' | 'regression';
  numClasses?: number; // For classification
  outputDim: number; // Output dimension
  description: string;
  sampleCount: number;
}

/**
 * Model weights split into shared and task-specific parts
 */
export interface MTLModelWeights {
  siteId: string;
  taskId: string;
  roundNumber: number;
  sharedWeights: {
    // Weights shared across all tasks
    data: Float32Array[];
    shapes: number[][];
  };
  taskSpecificWeights: {
    // Task-specific weights
    data: Float32Array[];
    shapes: number[][];
  };
  sampleCount: number;
  timestamp: number;
}

/**
 * Task relationship matrix (learned during training)
 * Captures how similar/related different tasks are
 */
export interface TaskRelationshipMatrix {
  taskIds: string[];
  relationships: Float32Array; // Shape: [numTasks, numTasks]
  confidence: number; // Confidence in the learned relationships
  roundNumber: number;
}

/**
 * Aggregate shared representations from multiple tasks
 *
 * Uses weighted averaging based on task similarity and sample sizes
 */
export function aggregateSharedWeights(
  updates: MTLModelWeights[],
  relationships: TaskRelationshipMatrix,
  config: FMTLConfig
): {
  aggregatedWeights: {
    data: Float32Array[];
    shapes: number[][];
  };
  participantIds: string[];
} {
  if (updates.length < config.minParticipants) {
    throw new Error(`Insufficient participants: ${updates.length} < ${config.minParticipants}`);
  }

  // Compute weights based on sample sizes and task relationships
  const weights = computeAggregationWeights(updates, relationships);

  // Get weight structure from first update
  const numLayers = updates[0].sharedWeights.data.length;
  const aggregated: {
    data: Float32Array[];
    shapes: number[][];
  } = {
    data: [],
    shapes: [],
  };

  // Aggregate each layer
  for (let layer = 0; layer < numLayers; layer++) {
    const shape = updates[0].sharedWeights.shapes[layer];
    const size = shape.reduce((a, b) => a * b, 1);
    const layerWeights = new Float32Array(size);

    // Weighted sum
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const weight = weights[i];
      const data = update.sharedWeights.data[layer];

      for (let j = 0; j < size; j++) {
        layerWeights[j] += weight * data[j];
      }
    }

    aggregated.data.push(layerWeights);
    aggregated.shapes.push(shape);
  }

  return {
    aggregatedWeights: aggregated,
    participantIds: updates.map((u) => u.siteId),
  };
}

/**
 * Compute aggregation weights based on task relationships and sample sizes
 */
function computeAggregationWeights(
  updates: MTLModelWeights[],
  relationships: TaskRelationshipMatrix
): number[] {
  const n = updates.length;
  const weights = new Array(n).fill(0);

  // Create task ID to index mapping
  const taskIdToIdx = new Map(relationships.taskIds.map((id, idx) => [id, idx]));

  // Compute weights based on task relationships
  for (let i = 0; i < n; i++) {
    const update = updates[i];
    const taskIdx = taskIdToIdx.get(update.taskId);

    if (taskIdx === undefined) {
      // If task not in relationship matrix, use uniform weight
      weights[i] = 1.0 / n;
      continue;
    }

    // Weight is based on average relationship with other tasks
    let relationshipSum = 0;
    let count = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const otherTaskIdx = taskIdToIdx.get(updates[j].taskId);
      if (otherTaskIdx !== undefined) {
        const relationshipValue =
          relationships.relationships[taskIdx * relationships.taskIds.length + otherTaskIdx];
        relationshipSum += relationshipValue;
        count++;
      }
    }

    const avgRelationship = count > 0 ? relationshipSum / count : 1.0;
    const sampleWeight = update.sampleCount;

    // Combine relationship and sample size
    weights[i] = avgRelationship * Math.sqrt(sampleWeight);
  }

  // Normalize weights
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

/**
 * Learn task relationship matrix from model weights
 *
 * Uses cosine similarity of shared representations
 */
export function learnTaskRelationships(updates: MTLModelWeights[]): TaskRelationshipMatrix {
  const n = updates.length;
  const taskIds = updates.map((u) => u.taskId);
  const relationships = new Float32Array(n * n);

  // Compute pairwise similarities
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        relationships[i * n + j] = 1.0; // Self-similarity = 1
      } else {
        const similarity = computeWeightSimilarity(
          updates[i].sharedWeights,
          updates[j].sharedWeights
        );
        relationships[i * n + j] = similarity;
      }
    }
  }

  // Compute confidence based on consistency of relationships
  const confidence = computeRelationshipConfidence(relationships, n);

  return {
    taskIds,
    relationships,
    confidence,
    roundNumber: updates[0].roundNumber,
  };
}

/**
 * Compute cosine similarity between two weight sets
 */
function computeWeightSimilarity(
  weightsA: { data: Float32Array[]; shapes: number[][] },
  weightsB: { data: Float32Array[]; shapes: number[][] }
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Compute across all layers
  for (let layer = 0; layer < weightsA.data.length; layer++) {
    const dataA = weightsA.data[layer];
    const dataB = weightsB.data[layer];
    const size = Math.min(dataA.length, dataB.length);

    for (let i = 0; i < size; i++) {
      dotProduct += dataA[i] * dataB[i];
      normA += dataA[i] * dataA[i];
      normB += dataB[i] * dataB[i];
    }
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

/**
 * Compute confidence in learned relationships
 * Based on triangle inequality consistency
 */
function computeRelationshipConfidence(relationships: Float32Array, n: number): number {
  let violations = 0;
  let totalTriangles = 0;

  // Check triangle inequality: d(i,k) <= d(i,j) + d(j,k)
  // where d = 1 - similarity
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;

        const dik = 1 - relationships[i * n + k];
        const dij = 1 - relationships[i * n + j];
        const djk = 1 - relationships[j * n + k];

        if (dik > dij + djk + 0.1) {
          // 0.1 tolerance
          violations++;
        }
        totalTriangles++;
      }
    }
  }

  return 1 - violations / totalTriangles;
}

/**
 * Apply task-relationship regularization to local model update
 *
 * Encourages similar tasks to have similar shared representations
 */
export function applyTaskRegularization(
  localWeights: MTLModelWeights,
  globalSharedWeights: {
    data: Float32Array[];
    shapes: number[][];
  },
  relationships: TaskRelationshipMatrix,
  lambda: number
): Float32Array[] {
  const regularized: Float32Array[] = [];
  const taskIdx = relationships.taskIds.indexOf(localWeights.taskId);

  if (taskIdx === -1) {
    // Task not in relationship matrix, return local weights as-is
    return localWeights.sharedWeights.data;
  }

  // Compute average task similarity
  const n = relationships.taskIds.length;
  let avgSimilarity = 0;
  for (let i = 0; i < n; i++) {
    if (i !== taskIdx) {
      avgSimilarity += relationships.relationships[taskIdx * n + i];
    }
  }
  avgSimilarity /= n - 1;

  // Apply regularization: w_local + lambda * similarity * (w_global - w_local)
  for (let layer = 0; layer < localWeights.sharedWeights.data.length; layer++) {
    const localData = localWeights.sharedWeights.data[layer];
    const globalData = globalSharedWeights.data[layer];
    const size = localData.length;
    const regularizedData = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const diff = globalData[i] - localData[i];
      regularizedData[i] = localData[i] + lambda * avgSimilarity * diff;
    }

    regularized.push(regularizedData);
  }

  return regularized;
}

/**
 * Compute personalization score for a task
 *
 * How much task-specific vs shared information is used
 */
export function computePersonalizationScore(weights: MTLModelWeights): number {
  let sharedNorm = 0;
  let taskSpecificNorm = 0;

  // Compute norms
  for (const data of weights.sharedWeights.data) {
    for (let i = 0; i < data.length; i++) {
      sharedNorm += data[i] * data[i];
    }
  }

  for (const data of weights.taskSpecificWeights.data) {
    for (let i = 0; i < data.length; i++) {
      taskSpecificNorm += data[i] * data[i];
    }
  }

  sharedNorm = Math.sqrt(sharedNorm);
  taskSpecificNorm = Math.sqrt(taskSpecificNorm);

  const total = sharedNorm + taskSpecificNorm;
  if (total === 0) return 0.5;

  return taskSpecificNorm / total; // Higher = more personalized
}

/**
 * Initialize FMTL configuration
 */
export function initializeFMTL(
  studyId: string,
  participantCount: number,
  sharedLayerDepth: number = 3
): FMTLConfig {
  return {
    studyId,
    totalRounds: 30,
    sharedLayerDepth,
    taskSpecificLayers: 2,
    regularizationStrength: 0.1,
    minParticipants: Math.max(2, Math.floor(participantCount * 0.5)),
  };
}

/**
 * FMTL Round Summary
 */
export interface FMTLRoundSummary {
  roundNumber: number;
  participantCount: number;
  avgTaskSimilarity: number;
  relationshipConfidence: number;
  avgPersonalization: number;
  timestamp: number;
}

/**
 * Track FMTL training progress
 */
export class FMTLTracker {
  private rounds: FMTLRoundSummary[] = [];

  addRound(summary: FMTLRoundSummary): void {
    this.rounds.push(summary);
  }

  getCurrentRound(): number {
    return this.rounds.length;
  }

  getRelationshipStability(): number {
    if (this.rounds.length < 2) return 0;

    let stabilitySum = 0;
    for (let i = 1; i < this.rounds.length; i++) {
      const prev = this.rounds[i - 1].avgTaskSimilarity;
      const curr = this.rounds[i].avgTaskSimilarity;
      const change = Math.abs(curr - prev) / prev;
      stabilitySum += 1 - change;
    }

    return stabilitySum / (this.rounds.length - 1);
  }

  getSummary(): {
    totalRounds: number;
    finalConfidence: number;
    avgPersonalization: number;
    relationshipStability: number;
  } {
    if (this.rounds.length === 0) {
      return {
        totalRounds: 0,
        finalConfidence: 0,
        avgPersonalization: 0,
        relationshipStability: 0,
      };
    }

    const finalRound = this.rounds[this.rounds.length - 1];
    const avgPersonalization =
      this.rounds.reduce((s, r) => s + r.avgPersonalization, 0) / this.rounds.length;

    return {
      totalRounds: this.rounds.length,
      finalConfidence: finalRound.relationshipConfidence,
      avgPersonalization,
      relationshipStability: this.getRelationshipStability(),
    };
  }
}
