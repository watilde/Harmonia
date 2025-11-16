/**
 * Tests for Embedding Aggregation
 */

import {
  validateEmbeddingUpdates,
  concatenateEmbeddings,
  sumEmbeddings,
  averageEmbeddings,
  attentionEmbeddings,
  computeAttentionWeights,
  splitGradients,
} from './embedding-aggregation';
import type { EmbeddingUpdate } from './types';

describe('Embedding Aggregation', () => {
  const createEmbeddingUpdate = (
    siteId: string,
    round: number,
    batchSize: number,
    embeddingDim: number
  ): EmbeddingUpdate => {
    const data = new Float32Array(batchSize * embeddingDim);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random();
    }

    return {
      siteId,
      roundNumber: round,
      embeddings: {
        data,
        shape: [batchSize, embeddingDim],
      },
      sampleCount: batchSize,
      timestamp: Date.now(),
      encrypted: false,
    };
  };

  describe('validateEmbeddingUpdates', () => {
    it('should validate correct updates', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 10, 32),
        createEmbeddingUpdate('site-b', 1, 10, 32),
      ];

      expect(() => validateEmbeddingUpdates(updates, 1, 32)).not.toThrow();
    });

    it('should throw on empty updates', () => {
      expect(() => validateEmbeddingUpdates([], 1, 32)).toThrow('No embedding updates provided');
    });

    it('should throw on mismatched rounds', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 10, 32),
        createEmbeddingUpdate('site-b', 2, 10, 32),
      ];

      expect(() => validateEmbeddingUpdates(updates, 1, 32)).toThrow('multiple rounds');
    });

    it('should throw on mismatched batch sizes', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 10, 32),
        createEmbeddingUpdate('site-b', 1, 20, 32),
      ];

      expect(() => validateEmbeddingUpdates(updates, 1, 32)).toThrow('Inconsistent batch sizes');
    });

    it('should throw on duplicate site IDs', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 10, 32),
        createEmbeddingUpdate('site-a', 1, 10, 32),
      ];

      expect(() => validateEmbeddingUpdates(updates, 1, 32)).toThrow('Duplicate site IDs');
    });
  });

  describe('concatenateEmbeddings', () => {
    it('should concatenate embeddings correctly', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 2, 3),
        createEmbeddingUpdate('site-b', 1, 2, 3),
      ];

      // Set known values
      updates[0].embeddings.data = new Float32Array([1, 2, 3, 4, 5, 6]);
      updates[1].embeddings.data = new Float32Array([7, 8, 9, 10, 11, 12]);

      const result = concatenateEmbeddings(updates);

      expect(result.embeddings.shape).toEqual([2, 6]);
      expect(result.aggregationMethod).toBe('concat');
      expect(result.participantIds).toEqual(['site-a', 'site-b']);

      // Check concatenation: [batch0_siteA, batch0_siteB, batch1_siteA, batch1_siteB]
      expect(Array.from(result.embeddings.data)).toEqual([1, 2, 3, 7, 8, 9, 4, 5, 6, 10, 11, 12]);
    });
  });

  describe('sumEmbeddings', () => {
    it('should sum embeddings correctly', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 2, 3),
        createEmbeddingUpdate('site-b', 1, 2, 3),
      ];

      updates[0].embeddings.data = new Float32Array([1, 2, 3, 4, 5, 6]);
      updates[1].embeddings.data = new Float32Array([1, 1, 1, 1, 1, 1]);

      const result = sumEmbeddings(updates);

      expect(result.embeddings.shape).toEqual([2, 3]);
      expect(result.aggregationMethod).toBe('sum');
      expect(Array.from(result.embeddings.data)).toEqual([2, 3, 4, 5, 6, 7]);
    });
  });

  describe('averageEmbeddings', () => {
    it('should average embeddings correctly', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 1, 2),
        createEmbeddingUpdate('site-b', 1, 1, 2),
      ];

      updates[0].embeddings.data = new Float32Array([2, 4]);
      updates[1].embeddings.data = new Float32Array([4, 6]);

      const result = averageEmbeddings(updates);

      expect(result.embeddings.shape).toEqual([1, 2]);
      expect(Array.from(result.embeddings.data)).toEqual([3, 5]);
    });
  });

  describe('computeAttentionWeights', () => {
    it('should compute attention weights that sum to 1', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 2, 3),
        createEmbeddingUpdate('site-b', 1, 2, 3),
        createEmbeddingUpdate('site-c', 1, 2, 3),
      ];

      // Set known values with different magnitudes
      updates[0].embeddings.data = new Float32Array([1, 2, 3, 4, 5, 6]);
      updates[1].embeddings.data = new Float32Array([2, 3, 4, 5, 6, 7]);
      updates[2].embeddings.data = new Float32Array([0.5, 1, 1.5, 2, 2.5, 3]);

      const weights = computeAttentionWeights(updates);

      // Check shape: batchSize * numParticipants
      expect(weights.length).toBe(2 * 3); // 2 batches, 3 participants

      // Check that weights sum to 1 for each batch
      for (let batch = 0; batch < 2; batch++) {
        let sum = 0;
        for (let i = 0; i < 3; i++) {
          const weight = weights[batch * 3 + i];
          expect(weight).toBeGreaterThanOrEqual(0);
          expect(weight).toBeLessThanOrEqual(1);
          sum += weight;
        }
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it('should give equal weights for identical embeddings', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 1, 2),
        createEmbeddingUpdate('site-b', 1, 1, 2),
      ];

      // Set identical values
      updates[0].embeddings.data = new Float32Array([1, 2]);
      updates[1].embeddings.data = new Float32Array([1, 2]);

      const weights = computeAttentionWeights(updates);

      expect(weights[0]).toBeCloseTo(0.5, 5);
      expect(weights[1]).toBeCloseTo(0.5, 5);
    });
  });

  describe('attentionEmbeddings', () => {
    it('should aggregate embeddings using attention', () => {
      const updates = [
        createEmbeddingUpdate('site-a', 1, 2, 3),
        createEmbeddingUpdate('site-b', 1, 2, 3),
      ];

      updates[0].embeddings.data = new Float32Array([1, 2, 3, 4, 5, 6]);
      updates[1].embeddings.data = new Float32Array([2, 3, 4, 5, 6, 7]);

      const result = attentionEmbeddings(updates);

      expect(result.embeddings.shape).toEqual([2, 3]);
      expect(result.aggregationMethod).toBe('attention');
      expect(result.participantIds).toEqual(['site-a', 'site-b']);

      // Result should be a weighted average (values between the two inputs)
      const data = result.embeddings.data;
      for (let i = 0; i < data.length; i++) {
        const minVal = Math.min(updates[0].embeddings.data[i], updates[1].embeddings.data[i]);
        const maxVal = Math.max(updates[0].embeddings.data[i], updates[1].embeddings.data[i]);
        expect(data[i]).toBeGreaterThanOrEqual(minVal);
        expect(data[i]).toBeLessThanOrEqual(maxVal);
      }
    });

    it('should handle single participant', () => {
      const updates = [createEmbeddingUpdate('site-a', 1, 1, 2)];
      updates[0].embeddings.data = new Float32Array([3, 4]);

      const result = attentionEmbeddings(updates);

      expect(result.embeddings.shape).toEqual([1, 2]);
      // With single participant, result should equal input
      expect(Array.from(result.embeddings.data)).toEqual([3, 4]);
    });

    it('should throw on empty updates', () => {
      expect(() => attentionEmbeddings([])).toThrow('No embeddings to aggregate');
    });
  });

  describe('splitGradients', () => {
    it('should split concatenated gradients correctly', () => {
      const aggregatedGradients = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const participantIds = ['site-a', 'site-b'];

      const result = splitGradients(
        aggregatedGradients,
        'concat',
        participantIds,
        3, // embeddingDim
        1 // roundNumber
      );

      expect(result.size).toBe(2);
      expect(result.has('site-a')).toBe(true);
      expect(result.has('site-b')).toBe(true);

      const gradA = result.get('site-a')!;
      expect(gradA.gradients.shape).toEqual([2, 3]);
      expect(Array.from(gradA.gradients.data)).toEqual([1, 2, 3, 7, 8, 9]);

      const gradB = result.get('site-b')!;
      expect(Array.from(gradB.gradients.data)).toEqual([4, 5, 6, 10, 11, 12]);
    });

    it('should handle sum aggregation', () => {
      const aggregatedGradients = new Float32Array([1, 2, 3, 4, 5, 6]);
      const participantIds = ['site-a', 'site-b'];

      const result = splitGradients(aggregatedGradients, 'sum', participantIds, 3, 1);

      // Both participants get the same gradients
      const gradA = result.get('site-a')!;
      const gradB = result.get('site-b')!;

      expect(Array.from(gradA.gradients.data)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(Array.from(gradB.gradients.data)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
});
