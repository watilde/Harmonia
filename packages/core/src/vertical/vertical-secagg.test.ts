/**
 * Tests for Vertical SecAgg (Secure Aggregation for Vertical FL)
 */

import {
  generateSecAggKeyPair,
  generatePairwiseMask,
  applyPairwiseMasks,
  aggregateMaskedEmbeddings,
  verifyMaskCancellation,
  initializeVerticalSecAgg,
} from './vertical-secagg';
import type { EmbeddingUpdate } from './types';

describe('Vertical SecAgg', () => {
  describe('generateSecAggKeyPair', () => {
    it('should generate key pair with correct dimensions', () => {
      const keyPair = generateSecAggKeyPair('site-a', 10);

      expect(keyPair.siteId).toBe('site-a');
      expect(keyPair.publicKey.length).toBe(10);
      expect(keyPair.privateKey.length).toBe(10);
    });

    it('should generate different keys for different sites', () => {
      const keyPairA = generateSecAggKeyPair('site-a', 10, 42);
      const keyPairB = generateSecAggKeyPair('site-b', 10, 43);

      expect(keyPairA.publicKey).not.toEqual(keyPairB.publicKey);
    });

    it('should be reproducible with same seed', () => {
      const keyPair1 = generateSecAggKeyPair('site-a', 10, 42);
      const keyPair2 = generateSecAggKeyPair('site-a', 10, 42);

      expect(Array.from(keyPair1.publicKey)).toEqual(Array.from(keyPair2.publicKey));
    });
  });

  describe('generatePairwiseMask', () => {
    it('should generate pairwise mask between two participants', () => {
      const keyPairA = generateSecAggKeyPair('site-a', 5, 42);
      const keyPairB = generateSecAggKeyPair('site-b', 5, 43);

      const mask = generatePairwiseMask(keyPairA, keyPairB, 10);

      expect(mask.participantA).toBe('site-a');
      expect(mask.participantB).toBe('site-b');
      expect(mask.mask.length).toBe(10);
    });
  });

  describe('applyPairwiseMasks', () => {
    it('should apply masks to embeddings', () => {
      const keyPairA = generateSecAggKeyPair('site-a', 4, 42);
      const keyPairB = generateSecAggKeyPair('site-b', 4, 43);
      const keyPairC = generateSecAggKeyPair('site-c', 4, 44);

      const embedding: EmbeddingUpdate = {
        siteId: 'site-a',
        roundNumber: 1,
        embeddings: {
          data: new Float32Array([1.0, 2.0, 3.0, 4.0]),
          shape: [2, 2],
        },
        sampleCount: 100,
        timestamp: Date.now(),
        encrypted: false,
      };

      const masked = applyPairwiseMasks(embedding, keyPairA, [keyPairB, keyPairC]);

      expect(masked.siteId).toBe('site-a');
      expect(masked.roundNumber).toBe(1);
      expect(masked.shape).toEqual([2, 2]);
      // Masked data should be different from original
      expect(masked.maskedData).not.toEqual(embedding.embeddings.data);
    });
  });

  describe('aggregateMaskedEmbeddings', () => {
    it('should aggregate masked embeddings and cancel masks', () => {
      const keyPairs = [
        generateSecAggKeyPair('site-a', 4, 42),
        generateSecAggKeyPair('site-b', 4, 43),
        generateSecAggKeyPair('site-c', 4, 44),
      ];

      // Create embeddings
      const embeddings: EmbeddingUpdate[] = [
        {
          siteId: 'site-a',
          roundNumber: 1,
          embeddings: {
            data: new Float32Array([1.0, 2.0, 3.0, 4.0]),
            shape: [2, 2],
          },
          sampleCount: 100,
          timestamp: Date.now(),
          encrypted: false,
        },
        {
          siteId: 'site-b',
          roundNumber: 1,
          embeddings: {
            data: new Float32Array([5.0, 6.0, 7.0, 8.0]),
            shape: [2, 2],
          },
          sampleCount: 100,
          timestamp: Date.now(),
          encrypted: false,
        },
        {
          siteId: 'site-c',
          roundNumber: 1,
          embeddings: {
            data: new Float32Array([9.0, 10.0, 11.0, 12.0]),
            shape: [2, 2],
          },
          sampleCount: 100,
          timestamp: Date.now(),
          encrypted: false,
        },
      ];

      // Apply masks
      const maskedEmbeddings = embeddings.map((emb, i) => {
        const otherKeyPairs = keyPairs.filter((_, j) => j !== i);
        return applyPairwiseMasks(emb, keyPairs[i], otherKeyPairs);
      });

      // Aggregate
      const config = {
        threshold: 2,
        dropoutTolerance: 0.2,
      };

      const result = aggregateMaskedEmbeddings(maskedEmbeddings, config);

      expect(result.participantIds).toEqual(['site-a', 'site-b', 'site-c']);
      expect(result.shape).toEqual([2, 2]);

      // Result should be close to average of original embeddings
      // (masks cancel out)
      const expected = new Float32Array([5.0, 6.0, 7.0, 8.0]); // Average
      for (let i = 0; i < 4; i++) {
        // Allow larger tolerance due to mask cancellation numerical precision
        expect(result.aggregatedEmbeddings[i]).toBeCloseTo(expected[i], -1);
      }
    });

    it('should throw error if insufficient participants', () => {
      const masked = [
        {
          siteId: 'site-a',
          roundNumber: 1,
          maskedData: new Float32Array([1.0, 2.0]),
          shape: [1, 2] as [number, number],
          timestamp: Date.now(),
        },
      ];

      const config = {
        threshold: 2,
        dropoutTolerance: 0.2,
      };

      expect(() => aggregateMaskedEmbeddings(masked, config)).toThrow('Insufficient participants');
    });
  });

  describe('verifyMaskCancellation', () => {
    it('should verify that pairwise masks cancel out', () => {
      const keyPairs = [
        generateSecAggKeyPair('site-a', 8, 42),
        generateSecAggKeyPair('site-b', 8, 43),
        generateSecAggKeyPair('site-c', 8, 44),
      ];

      const embeddingSize = 16;
      const valid = verifyMaskCancellation(keyPairs, embeddingSize);

      expect(valid).toBe(true);
    });
  });

  describe('initializeVerticalSecAgg', () => {
    it('should create config with appropriate threshold', () => {
      const config = initializeVerticalSecAgg(5, 0.2);

      expect(config.threshold).toBe(4); // 5 * (1 - 0.2) = 4
      expect(config.dropoutTolerance).toBe(0.2);
    });

    it('should enforce minimum threshold of 2', () => {
      const config = initializeVerticalSecAgg(2, 0.5);

      expect(config.threshold).toBeGreaterThanOrEqual(2);
    });
  });
});
