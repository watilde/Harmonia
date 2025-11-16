/**
 * Tests for VFL-FedAvg (Vertical Federated Averaging)
 */

import {
  aggregateEmbeddings,
  assessEmbeddingQuality,
  computeEmbeddingVariance,
  computeContributionScore,
  initializeVFLFedAvg,
} from './vfl-fedavg';
import type { EmbeddingUpdate, VFLConfig } from './types';

describe('VFL-FedAvg', () => {
  describe('computeEmbeddingVariance', () => {
    it('should compute variance correctly', () => {
      // Create embeddings with known variance
      const embeddings = new Float32Array([
        1.0,
        2.0, // Sample 1
        3.0,
        4.0, // Sample 2
        5.0,
        6.0, // Sample 3
      ]);
      const shape: [number, number] = [3, 2];

      const variance = computeEmbeddingVariance(embeddings, shape);

      // Variance should be positive
      expect(variance).toBeGreaterThan(0);
    });

    it('should return zero variance for constant embeddings', () => {
      const embeddings = new Float32Array([1.0, 1.0, 1.0, 1.0]);
      const shape: [number, number] = [2, 2];

      const variance = computeEmbeddingVariance(embeddings, shape);

      expect(variance).toBe(0);
    });
  });

  describe('computeContributionScore', () => {
    it('should compute contribution score based on norm', () => {
      const embeddings = new Float32Array([
        3.0,
        4.0, // Norm = 5
        0.0,
        0.0, // Norm = 0
      ]);
      const shape: [number, number] = [2, 2];

      const score = computeContributionScore(embeddings, shape);

      // Average norm should be 2.5
      expect(score).toBeCloseTo(2.5, 1);
    });
  });

  describe('assessEmbeddingQuality', () => {
    it('should assess quality for multiple updates', () => {
      const updates: EmbeddingUpdate[] = [
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
          sampleCount: 150,
          timestamp: Date.now(),
          encrypted: false,
        },
      ];

      const qualities = assessEmbeddingQuality(updates, 'variance');

      expect(qualities).toHaveLength(2);
      expect(qualities[0].siteId).toBe('site-a');
      expect(qualities[0].variance).toBeGreaterThan(0);
      expect(qualities[0].sampleCount).toBe(100);
      expect(qualities[1].siteId).toBe('site-b');
    });
  });

  describe('aggregateEmbeddings', () => {
    it('should concatenate embeddings with uniform strategy', () => {
      const updates: EmbeddingUpdate[] = [
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
          sampleCount: 150,
          timestamp: Date.now(),
          encrypted: false,
        },
      ];

      const config = {
        aggregationStrategy: 'uniform' as const,
        minParticipants: 2,
        embeddingDim: 2,
      };

      const result = aggregateEmbeddings(updates, config);

      expect(result.roundNumber).toBe(1);
      expect(result.embeddings.shape).toEqual([2, 4]); // Concatenated: 2 + 2 = 4
      expect(result.participantIds).toEqual(['site-a', 'site-b']);
      expect(result.aggregationMethod).toBe('concat');

      // Check concatenation: [1,2,5,6] and [3,4,7,8]
      expect(result.embeddings.data[0]).toBe(1.0);
      expect(result.embeddings.data[1]).toBe(2.0);
      expect(result.embeddings.data[2]).toBe(5.0);
      expect(result.embeddings.data[3]).toBe(6.0);
    });

    it('should throw error if insufficient participants', () => {
      const updates: EmbeddingUpdate[] = [
        {
          siteId: 'site-a',
          roundNumber: 1,
          embeddings: {
            data: new Float32Array([1.0, 2.0]),
            shape: [1, 2],
          },
          sampleCount: 100,
          timestamp: Date.now(),
          encrypted: false,
        },
      ];

      const config = {
        aggregationStrategy: 'uniform' as const,
        minParticipants: 2,
        embeddingDim: 2,
      };

      expect(() => aggregateEmbeddings(updates, config)).toThrow('Insufficient participants');
    });
  });

  describe('initializeVFLFedAvg', () => {
    it('should create config from VFL config', () => {
      const vflConfig: VFLConfig = {
        studyId: 'test-study',
        participants: [
          {
            siteId: 'site-a',
            role: 'host',
            featureDomains: ['Condition'],
            bottomModelConfig: {
              inputDim: 10,
              outputDim: 8,
              hiddenLayers: [16],
              activation: 'relu',
            },
            hasLabels: true,
          },
          {
            siteId: 'site-b',
            role: 'guest',
            featureDomains: ['Procedure'],
            bottomModelConfig: {
              inputDim: 15,
              outputDim: 8,
              hiddenLayers: [16],
              activation: 'relu',
            },
            hasLabels: false,
          },
        ],
        coordinator: {
          topModelConfig: {
            inputDim: 16,
            outputDim: 2,
            hiddenLayers: [8],
            activation: 'relu',
          },
          optimizer: {
            type: 'adam',
            learningRate: 0.001,
          },
          batchSize: 32,
          aggregationStrategy: 'concat',
        },
        privacy: {
          embeddingDP: {
            enabled: false,
            epsilon: 1.0,
            delta: 1e-5,
            clipNorm: 1.0,
          },
          gradientDP: {
            enabled: false,
            epsilon: 1.0,
            delta: 1e-5,
            clipNorm: 1.0,
          },
          encryption: {
            enabled: false,
            algorithm: 'aes-256-gcm',
          },
        },
        rounds: 10,
        embeddingDim: 8,
      };

      const config = initializeVFLFedAvg(vflConfig, 'weighted');

      expect(config.aggregationStrategy).toBe('weighted');
      expect(config.minParticipants).toBeGreaterThanOrEqual(1);
      expect(config.embeddingDim).toBe(8);
    });
  });
});
