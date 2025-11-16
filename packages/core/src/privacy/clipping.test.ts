/**
 * Tests for gradient clipping
 */

import {
  l2Norm,
  calculateWeightsNorm,
  clipVector,
  clipWeights,
  clipClientUpdates,
  getClippingRatio,
} from './clipping';

describe('Gradient Clipping', () => {
  describe('l2Norm', () => {
    it('should calculate L2 norm correctly', () => {
      const vector = new Float32Array([3.0, 4.0]);
      const norm = l2Norm(vector);
      expect(norm).toBeCloseTo(5.0, 5);
    });

    it('should return 0 for zero vector', () => {
      const vector = new Float32Array([0, 0, 0]);
      const norm = l2Norm(vector);
      expect(norm).toBe(0);
    });
  });

  describe('calculateWeightsNorm', () => {
    it('should calculate total norm across multiple arrays', () => {
      const weights = [new Float32Array([3.0]), new Float32Array([4.0])];
      const norm = calculateWeightsNorm(weights);
      expect(norm).toBeCloseTo(5.0, 5);
    });
  });

  describe('clipVector', () => {
    it('should not clip if norm is below threshold', () => {
      const vector = new Float32Array([1.0, 1.0]);
      const clipped = clipVector(vector, 10.0);

      expect(clipped[0]).toBeCloseTo(1.0, 5);
      expect(clipped[1]).toBeCloseTo(1.0, 5);
    });

    it('should clip if norm exceeds threshold', () => {
      const vector = new Float32Array([3.0, 4.0]); // norm = 5
      const clipped = clipVector(vector, 2.5);

      const norm = l2Norm(clipped);
      expect(norm).toBeCloseTo(2.5, 5);
    });
  });

  describe('clipWeights', () => {
    it('should clip weights correctly', () => {
      const weights = [new Float32Array([3.0]), new Float32Array([4.0])];

      const { clipped, stats } = clipWeights(weights, 2.5);

      const norm = calculateWeightsNorm(clipped);
      expect(norm).toBeCloseTo(2.5, 5);
      expect(stats.clippedCount).toBe(1);
      expect(stats.maxNorm).toBeCloseTo(5.0, 5);
    });

    it('should not clip if norm is below threshold', () => {
      const weights = [new Float32Array([1.0]), new Float32Array([1.0])];

      const { clipped, stats } = clipWeights(weights, 10.0);

      expect(clipped).toEqual(weights);
      expect(stats.clippedCount).toBe(0);
    });
  });

  describe('clipClientUpdates', () => {
    it('should clip multiple client updates', () => {
      const updates = [
        [new Float32Array([3.0]), new Float32Array([4.0])],
        [new Float32Array([6.0]), new Float32Array([8.0])],
      ];

      const { clipped, stats } = clipClientUpdates(updates, 2.5);

      expect(clipped.length).toBe(2);
      expect(stats.totalCount).toBe(2);
      expect(stats.clippedCount).toBe(2);
    });
  });

  describe('getClippingRatio', () => {
    it('should calculate clipping ratio', () => {
      const stats = {
        clippedCount: 3,
        totalCount: 10,
        averageNormBefore: 5.0,
        averageNormAfter: 2.5,
        maxNorm: 10.0,
      };

      const ratio = getClippingRatio(stats);
      expect(ratio).toBe(0.3);
    });
  });
});
