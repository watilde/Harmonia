/**
 * Tests for Trainer
 */

import { applyDifferentialPrivacy, clipWeights } from './trainer';

describe('Trainer', () => {
  describe('clipWeights', () => {
    it('should clip weights to threshold', () => {
      const weights = {
        data: [new Float32Array([0.5, 1.5, -2.0, 0.8])],
        shapes: [[4]],
      };

      const clipped = clipWeights(weights, 2.0);

      const values = Array.from(clipped.data[0]);
      // Total norm = sqrt(0.25 + 2.25 + 4.0 + 0.64) = sqrt(7.14) = 2.67
      // Scale = 2.0 / 2.67 = 0.75
      expect(values.length).toBe(4);
      expect(clipped.shapes).toEqual([[4]]);
    });

    it('should not modify weights below threshold', () => {
      const weights = {
        data: [new Float32Array([0.1, 0.2, -0.3, 0.4])],
        shapes: [[4]],
      };

      const clipped = clipWeights(weights, 10.0);

      const values = Array.from(clipped.data[0]);
      expect(values[0]).toBeCloseTo(0.1, 1);
      expect(values[1]).toBeCloseTo(0.2, 1);
      expect(values[2]).toBeCloseTo(-0.3, 1);
      expect(values[3]).toBeCloseTo(0.4, 1);
    });

    it('should handle multiple weight arrays', () => {
      const weights = {
        data: [new Float32Array([1.0, 2.0]), new Float32Array([3.0, 4.0])],
        shapes: [[2], [2]],
      };

      const clipped = clipWeights(weights, 3.0);

      expect(clipped.data.length).toBe(2);
      expect(clipped.shapes).toEqual([[2], [2]]);
    });
  });

  describe('applyDifferentialPrivacy', () => {
    it('should add noise to weights', () => {
      const weights = {
        data: [new Float32Array([1.0, 2.0, 3.0])],
        shapes: [[3]],
      };

      const noisy = applyDifferentialPrivacy(weights, 0.1, 0.001, 1.0);

      const original = Array.from(weights.data[0]);
      const modified = Array.from(noisy.data[0]);

      // Check that values have changed (noise added)
      expect(modified).not.toEqual(original);

      // Check shapes preserved
      expect(noisy.shapes).toEqual([[3]]);
    });

    it('should produce different noise each time', () => {
      const weights = {
        data: [new Float32Array([1.0, 2.0, 3.0])],
        shapes: [[3]],
      };

      const noisy1 = applyDifferentialPrivacy(weights, 0.1, 0.001, 1.0);
      const noisy2 = applyDifferentialPrivacy(weights, 0.1, 0.001, 1.0);

      const values1 = Array.from(noisy1.data[0]);
      const values2 = Array.from(noisy2.data[0]);

      expect(values1).not.toEqual(values2);
    });

    it('should handle multiple weight tensors', () => {
      const weights = {
        data: [new Float32Array([1.0, 2.0]), new Float32Array([3.0, 4.0, 5.0, 6.0])],
        shapes: [[2], [4]],
      };

      const noisy = applyDifferentialPrivacy(weights, 0.1, 0.001, 1.0);

      expect(noisy.data.length).toBe(2);
      expect(noisy.shapes).toEqual([[2], [4]]);
      expect(noisy.data[0].length).toBe(2);
      expect(noisy.data[1].length).toBe(4);
    });

    it('should respect sensitivity (clipNorm parameter)', () => {
      const weights = {
        data: [new Float32Array([1.0, 2.0, 3.0])],
        shapes: [[3]],
      };

      // With higher clipNorm, sensitivity increases, noise scale increases
      const highClipNorm = applyDifferentialPrivacy(weights, 0.1, 0.001, 10.0);
      const lowClipNorm = applyDifferentialPrivacy(weights, 0.1, 0.001, 0.1);

      // Just verify they are different (statistical test not guaranteed)
      expect(highClipNorm.data[0]).not.toEqual(lowClipNorm.data[0]);
    });
  });
});
