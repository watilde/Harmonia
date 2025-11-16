/**
 * Tests for VFL Privacy Protection
 */

import {
  addDPToEmbeddings,
  addDPToGradients,
  calculateVFLPrivacyBudget,
  validatePrivacyConfig,
  createDefaultVFLPrivacyConfig,
} from './privacy';
import type { VFLPrivacyConfig } from './types';

describe('VFL Privacy Protection', () => {
  const testConfig: VFLPrivacyConfig = {
    embeddingDP: {
      enabled: true,
      epsilon: 1.0,
      delta: 1e-5,
      clipNorm: 1.0,
    },
    gradientDP: {
      enabled: true,
      epsilon: 1.0,
      delta: 1e-5,
      clipNorm: 1.0,
    },
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
    },
  };

  describe('addDPToEmbeddings', () => {
    it('should add noise to embeddings', () => {
      const embeddings = new Float32Array([1.0, 2.0, 3.0, 4.0]);
      const shape: [number, number] = [2, 2];

      const { noisy, stats } = addDPToEmbeddings(embeddings, shape, testConfig);

      expect(noisy.length).toBe(embeddings.length);
      expect(stats.noiseMagnitude).toBeGreaterThan(0);
      expect(stats.clippedNorm).toBeGreaterThan(0);

      // Noise should make values different
      expect(Array.from(noisy)).not.toEqual(Array.from(embeddings));
    });

    it('should not add noise when DP disabled', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        embeddingDP: { ...testConfig.embeddingDP, enabled: false },
      };

      const embeddings = new Float32Array([1.0, 2.0, 3.0, 4.0]);
      const shape: [number, number] = [2, 2];

      const { noisy, stats } = addDPToEmbeddings(embeddings, shape, config);

      expect(Array.from(noisy)).toEqual(Array.from(embeddings));
      expect(stats.noiseMagnitude).toBe(0);
    });

    it('should clip large embeddings', () => {
      const embeddings = new Float32Array([10.0, 10.0, 10.0, 10.0]);
      const shape: [number, number] = [2, 2];

      const { stats } = addDPToEmbeddings(embeddings, shape, testConfig);

      // Should be clipped to clipNorm = 1.0
      expect(stats.clippedNorm).toBeLessThanOrEqual(testConfig.embeddingDP.clipNorm);
    });
  });

  describe('addDPToGradients', () => {
    it('should add noise to gradients', () => {
      const gradients = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const shape: [number, number] = [2, 2];

      const { noisy, stats } = addDPToGradients(gradients, shape, testConfig);

      expect(noisy.length).toBe(gradients.length);
      expect(stats.noiseMagnitude).toBeGreaterThan(0);

      // Noise should make values different
      expect(Array.from(noisy)).not.toEqual(Array.from(gradients));
    });

    it('should not add noise when DP disabled', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        gradientDP: { ...testConfig.gradientDP, enabled: false },
      };

      const gradients = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const shape: [number, number] = [2, 2];

      const { noisy } = addDPToGradients(gradients, shape, config);

      expect(Array.from(noisy)).toEqual(Array.from(gradients));
    });
  });

  describe('calculateVFLPrivacyBudget', () => {
    it('should calculate total privacy budget', () => {
      const rounds = 10;
      const budget = calculateVFLPrivacyBudget(rounds, testConfig);

      // Both embedding and gradient DP enabled
      expect(budget.epsilon).toBe(2.0 * rounds); // 1.0 + 1.0 per round
      expect(budget.delta).toBe(2e-5 * rounds);
    });

    it('should handle only embedding DP', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        gradientDP: { ...testConfig.gradientDP, enabled: false },
      };

      const budget = calculateVFLPrivacyBudget(10, config);

      expect(budget.epsilon).toBe(10.0);
      expect(budget.delta).toBe(1e-4);
    });

    it('should return zero when DP disabled', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        embeddingDP: { ...testConfig.embeddingDP, enabled: false },
        gradientDP: { ...testConfig.gradientDP, enabled: false },
      };

      const budget = calculateVFLPrivacyBudget(10, config);

      expect(budget.epsilon).toBe(0);
      expect(budget.delta).toBe(0);
    });
  });

  describe('validatePrivacyConfig', () => {
    it('should validate correct config', () => {
      expect(() => validatePrivacyConfig(testConfig)).not.toThrow();
    });

    it('should reject negative epsilon', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        embeddingDP: { ...testConfig.embeddingDP, epsilon: -1.0 },
      };

      expect(() => validatePrivacyConfig(config)).toThrow('epsilon must be positive');
    });

    it('should reject invalid delta', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        embeddingDP: { ...testConfig.embeddingDP, delta: 1.5 },
      };

      expect(() => validatePrivacyConfig(config)).toThrow('delta must be in');
    });

    it('should reject negative clip norm', () => {
      const config: VFLPrivacyConfig = {
        ...testConfig,
        gradientDP: { ...testConfig.gradientDP, clipNorm: -0.5 },
      };

      expect(() => validatePrivacyConfig(config)).toThrow('clip norm must be positive');
    });
  });

  describe('createDefaultVFLPrivacyConfig', () => {
    it('should create valid default config', () => {
      const config = createDefaultVFLPrivacyConfig();

      expect(config.embeddingDP.enabled).toBe(true);
      expect(config.gradientDP.enabled).toBe(true);
      expect(config.encryption.enabled).toBe(true);
      expect(config.embeddingDP.epsilon).toBeGreaterThan(0);
      expect(config.embeddingDP.delta).toBeGreaterThan(0);
      expect(config.embeddingDP.delta).toBeLessThan(1);

      // Should pass validation
      expect(() => validatePrivacyConfig(config)).not.toThrow();
    });
  });
});
