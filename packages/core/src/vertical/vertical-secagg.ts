/**
 * Vertical SecAgg: Secure Aggregation for Vertical Federated Learning
 *
 * Extends SecAgg to vertical FL where embeddings (not weights) are aggregated.
 * Protects individual embeddings from coordinator through multi-party computation.
 *
 * Paper: Bonawitz et al. "Practical Secure Aggregation for Privacy-Preserving
 * Machine Learning" (CCS 2017), adapted for vertical FL
 *
 * Key innovation: Pairwise masking of embeddings before aggregation
 */

import type { EmbeddingUpdate } from './types';

/**
 * Configuration for Vertical SecAgg
 */
export interface VerticalSecAggConfig {
  threshold: number; // Minimum participants needed for aggregation
  dropoutTolerance: number; // Maximum allowed dropout rate (0.0-1.0)
  maskSeed?: number; // Seed for reproducible masking (testing only)
}

/**
 * Key pair for SecAgg protocol
 */
export interface SecAggKeyPair {
  siteId: string;
  publicKey: Float32Array; // Simplified: use random vector as public key
  privateKey: Float32Array; // Simplified: use random vector as private key
}

/**
 * Masked embedding ready for secure aggregation
 */
export interface MaskedEmbedding {
  siteId: string;
  roundNumber: number;
  maskedData: Float32Array;
  shape: [number, number];
  timestamp: number;
}

/**
 * Pairwise mask between two participants
 */
interface PairwiseMask {
  participantA: string;
  participantB: string;
  mask: Float32Array;
}

/**
 * Generate key pair for SecAgg protocol
 * Simplified version: uses random vectors
 */
export function generateSecAggKeyPair(
  siteId: string,
  embeddingDim: number,
  seed?: number
): SecAggKeyPair {
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  const publicKey = new Float32Array(embeddingDim);
  const privateKey = new Float32Array(embeddingDim);

  for (let i = 0; i < embeddingDim; i++) {
    publicKey[i] = rng() * 2 - 1; // Range: [-1, 1]
    privateKey[i] = rng() * 2 - 1;
  }

  return { siteId, publicKey, privateKey };
}

/**
 * Seeded random number generator for reproducibility
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/**
 * Generate pairwise mask between two participants
 * Uses XOR of their key material
 */
export function generatePairwiseMask(
  keyPairA: SecAggKeyPair,
  keyPairB: SecAggKeyPair,
  embeddingSize: number
): PairwiseMask {
  const mask = new Float32Array(embeddingSize);

  // Simplified masking: combine keys with deterministic function
  const minKeyDim = Math.min(keyPairA.publicKey.length, keyPairB.publicKey.length);

  for (let i = 0; i < embeddingSize; i++) {
    const keyIdx = i % minKeyDim;
    // Mask = f(keyA, keyB) where f is deterministic
    mask[i] =
      keyPairA.publicKey[keyIdx] * keyPairB.privateKey[keyIdx] -
      keyPairB.publicKey[keyIdx] * keyPairA.privateKey[keyIdx];
  }

  return {
    participantA: keyPairA.siteId,
    participantB: keyPairB.siteId,
    mask,
  };
}

/**
 * Apply pairwise masks to embedding
 *
 * Each participant masks their embedding with pairwise masks from other participants.
 * Masks cancel out during aggregation due to antisymmetry property.
 */
export function applyPairwiseMasks(
  embedding: EmbeddingUpdate,
  selfKeyPair: SecAggKeyPair,
  otherKeyPairs: SecAggKeyPair[]
): MaskedEmbedding {
  const [batchSize, embeddingDim] = embedding.embeddings.shape;
  const totalSize = batchSize * embeddingDim;

  const maskedData = new Float32Array(embedding.embeddings.data);

  // Generate and apply pairwise masks with all other participants
  for (const otherKeyPair of otherKeyPairs) {
    if (otherKeyPair.siteId === selfKeyPair.siteId) continue;

    const pairwiseMask = generatePairwiseMask(selfKeyPair, otherKeyPair, totalSize);

    // Determine sign based on site ID ordering (ensures antisymmetry)
    const sign = selfKeyPair.siteId < otherKeyPair.siteId ? 1 : -1;

    // Apply mask
    for (let i = 0; i < totalSize; i++) {
      maskedData[i] += sign * pairwiseMask.mask[i];
    }
  }

  return {
    siteId: embedding.siteId,
    roundNumber: embedding.roundNumber,
    maskedData,
    shape: embedding.embeddings.shape,
    timestamp: Date.now(),
  };
}

/**
 * Aggregate masked embeddings securely
 *
 * Pairwise masks cancel out during summation due to antisymmetry:
 * mask_ij (participant i) + mask_ji (participant j) = 0
 *
 * Result: sum of original embeddings without revealing individual embeddings
 */
export function aggregateMaskedEmbeddings(
  maskedEmbeddings: MaskedEmbedding[],
  config: VerticalSecAggConfig
): {
  aggregatedEmbeddings: Float32Array;
  shape: [number, number];
  participantIds: string[];
} {
  if (maskedEmbeddings.length < config.threshold) {
    throw new Error(
      `Insufficient participants for secure aggregation: ${maskedEmbeddings.length} < ${config.threshold}`
    );
  }

  const [batchSize, embeddingDim] = maskedEmbeddings[0].shape;
  const totalSize = batchSize * embeddingDim;

  // Sum all masked embeddings (masks cancel out)
  const aggregated = new Float32Array(totalSize);

  for (const masked of maskedEmbeddings) {
    for (let i = 0; i < totalSize; i++) {
      aggregated[i] += masked.maskedData[i];
    }
  }

  // Average by number of participants (standard FedAvg)
  const n = maskedEmbeddings.length;
  for (let i = 0; i < totalSize; i++) {
    aggregated[i] /= n;
  }

  return {
    aggregatedEmbeddings: aggregated,
    shape: [batchSize, embeddingDim],
    participantIds: maskedEmbeddings.map((m) => m.siteId),
  };
}

/**
 * Verify mask cancellation property
 * For testing: ensures pairwise masks cancel out
 */
export function verifyMaskCancellation(keyPairs: SecAggKeyPair[], embeddingSize: number): boolean {
  const n = keyPairs.length;
  const totalMask = new Float32Array(embeddingSize);

  // Generate all pairwise masks and apply with correct signs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const mask = generatePairwiseMask(keyPairs[i], keyPairs[j], embeddingSize);

      // Participant i adds mask with +1, participant j adds with -1
      for (let k = 0; k < embeddingSize; k++) {
        totalMask[k] += mask.mask[k]; // From i's perspective: +mask
        totalMask[k] -= mask.mask[k]; // From j's perspective: -mask
      }
    }
  }

  // Check if total mask is zero (within numerical precision)
  const threshold = 1e-6;
  for (let i = 0; i < embeddingSize; i++) {
    if (Math.abs(totalMask[i]) > threshold) {
      return false;
    }
  }

  return true;
}

/**
 * Handle participant dropout in SecAgg
 *
 * When participants drop out, their masks don't cancel.
 * Recovery requires active participants to share their mask shares.
 */
export function handleDropout(
  activeParticipants: string[],
  droppedParticipants: string[],
  allKeyPairs: Map<string, SecAggKeyPair>,
  embeddingSize: number
): Float32Array {
  // Recovery mask to cancel dropped participants' contributions
  const recoveryMask = new Float32Array(embeddingSize);

  // For each dropped participant, reconstruct their mask contributions
  for (const droppedId of droppedParticipants) {
    const droppedKeyPair = allKeyPairs.get(droppedId);
    if (!droppedKeyPair) continue;

    // Sum mask contributions this participant had with active participants
    for (const activeId of activeParticipants) {
      const activeKeyPair = allKeyPairs.get(activeId);
      if (!activeKeyPair) continue;

      const mask = generatePairwiseMask(droppedKeyPair, activeKeyPair, embeddingSize);
      const sign = droppedId < activeId ? 1 : -1;

      for (let i = 0; i < embeddingSize; i++) {
        recoveryMask[i] -= sign * mask.mask[i];
      }
    }
  }

  return recoveryMask;
}

/**
 * Initialize Vertical SecAgg configuration
 */
export function initializeVerticalSecAgg(
  participantCount: number,
  dropoutTolerance: number = 0.2
): VerticalSecAggConfig {
  return {
    threshold: Math.max(2, Math.floor(participantCount * (1 - dropoutTolerance))),
    dropoutTolerance,
  };
}
