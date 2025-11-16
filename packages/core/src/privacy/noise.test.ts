/**
 * Tests for noise mechanisms
 */

import {
  sampleLaplace,
  sampleGaussian,
  calculateLaplaceScale,
  calculateGaussianStddev,
  addLaplaceNoise,
  addGaussianNoise,
  addNoiseToWeights,
} from './noise';

describe('Noise Mechanisms', () => {
  describe('calculateLaplaceScale', () => {
    it('should calculate correct scale', () => {
      const scale = calculateLaplaceScale(1.0, 0.5);
      expect(scale).toBe(2.0);
    });

    it('should throw error for non-positive epsilon', () => {
      expect(() => calculateLaplaceScale(1.0, 0)).toThrow();
      expect(() => calculateLaplaceScale(1.0, -1)).toThrow();
    });
  });

  describe('calculateGaussianStddev', () => {
    it('should calculate correct standard deviation', () => {
      const stddev = calculateGaussianStddev(1.0, 1.0, 1e-5);
      expect(stddev).toBeGreaterThan(0);
      expect(stddev).toBeLessThan(10);
    });

    it('should throw error for invalid delta', () => {
      expect(() => calculateGaussianStddev(1.0, 1.0, 0)).toThrow();
      expect(() => calculateGaussianStddev(1.0, 1.0, 1.0)).toThrow();
    });
  });

  describe('sampleLaplace', () => {
    it('should generate samples with correct distribution properties', () => {
      const samples: number[] = [];
      const n = 10000;

      for (let i = 0; i < n; i++) {
        samples.push(sampleLaplace(0, 1));
      }

      const mean = samples.reduce((a, b) => a + b, 0) / n;

      // Mean should be close to 0
      expect(Math.abs(mean)).toBeLessThan(0.1);
    });
  });

  describe('sampleGaussian', () => {
    it('should generate samples with correct distribution properties', () => {
      const samples: number[] = [];
      const n = 10000;

      for (let i = 0; i < n; i++) {
        samples.push(sampleGaussian(0, 1));
      }

      const mean = samples.reduce((a, b) => a + b, 0) / n;

      // Mean should be close to 0
      expect(Math.abs(mean)).toBeLessThan(0.1);
    });
  });

  describe('addLaplaceNoise', () => {
    it('should add noise to vector', () => {
      const vector = new Float32Array([1.0, 2.0, 3.0]);
      const noisy = addLaplaceNoise(vector, 0.1);

      expect(noisy.length).toBe(vector.length);

      // Values should be different but close
      for (let i = 0; i < vector.length; i++) {
        expect(Math.abs(noisy[i] - vector[i])).toBeLessThan(5.0);
      }
    });
  });

  describe('addGaussianNoise', () => {
    it('should add noise to vector', () => {
      const vector = new Float32Array([1.0, 2.0, 3.0]);
      const noisy = addGaussianNoise(vector, 0.1);

      expect(noisy.length).toBe(vector.length);

      // Values should be different but close
      for (let i = 0; i < vector.length; i++) {
        expect(Math.abs(noisy[i] - vector[i])).toBeLessThan(5.0);
      }
    });
  });

  describe('addNoiseToWeights', () => {
    it('should add Laplace noise to weights', () => {
      const weights = [new Float32Array([1.0, 2.0]), new Float32Array([3.0, 4.0])];

      const config = {
        epsilon: 1.0,
        delta: 0,
        clipNorm: 1.0,
        mechanism: 'laplace' as const,
      };

      const { noisy, stats } = addNoiseToWeights(weights, config);

      expect(noisy.length).toBe(weights.length);
      expect(stats.mechanism).toBe('laplace');
      expect(stats.noiseScale).toBeGreaterThan(0);
    });

    it('should add Gaussian noise to weights', () => {
      const weights = [new Float32Array([1.0, 2.0]), new Float32Array([3.0, 4.0])];

      const config = {
        epsilon: 1.0,
        delta: 1e-5,
        clipNorm: 1.0,
        mechanism: 'gaussian' as const,
      };

      const { noisy, stats } = addNoiseToWeights(weights, config);

      expect(noisy.length).toBe(weights.length);
      expect(stats.mechanism).toBe('gaussian');
      expect(stats.noiseScale).toBeGreaterThan(0);
    });
  });
});
