/**
 * Tests for Federated Averaging Algorithm
 */

import * as tf from '@tensorflow/tfjs-node';

import {
  aggregateWeights,
  deserializeWeights,
  initializeGlobalModel,
  serializeWeights,
  updateGlobalModel,
} from './fedavg';
import { ClientUpdate, FedAvgConfig } from '../types';

describe('FedAvg Algorithm', () => {
  afterEach(() => {
    // Clean up TensorFlow.js memory
    tf.dispose();
  });

  describe('serializeWeights', () => {
    it('should serialize model weights correctly', () => {
      const weights = [
        tf.tensor2d([
          [1, 2],
          [3, 4],
        ]),
        tf.tensor1d([5, 6, 7]),
      ];

      const serialized = serializeWeights(weights);

      expect(serialized.shapes).toEqual([[2, 2], [3]]);
      expect(serialized.data).toHaveLength(2);
      expect(Array.from(serialized.data[0])).toEqual([1, 2, 3, 4]);
      expect(Array.from(serialized.data[1])).toEqual([5, 6, 7]);

      weights.forEach((w) => w.dispose());
    });

    it('should handle empty weights', () => {
      const weights: tf.Tensor[] = [];
      const serialized = serializeWeights(weights);

      expect(serialized.shapes).toEqual([]);
      expect(serialized.data).toEqual([]);
    });
  });

  describe('deserializeWeights', () => {
    it('should deserialize weights correctly', () => {
      const serialized = {
        shapes: [[2, 2], [3]] as number[][],
        data: [new Float32Array([1, 2, 3, 4]), new Float32Array([5, 6, 7])],
      };

      const weights = deserializeWeights(serialized);

      expect(weights).toHaveLength(2);
      expect(weights[0].shape).toEqual([2, 2]);
      expect(weights[1].shape).toEqual([3]);
      expect(Array.from(weights[0].dataSync())).toEqual([1, 2, 3, 4]);
      expect(Array.from(weights[1].dataSync())).toEqual([5, 6, 7]);

      weights.forEach((w) => w.dispose());
    });
  });

  describe('aggregateWeights', () => {
    it('should aggregate weights with weighted strategy', () => {
      const update1: ClientUpdate = {
        siteId: 'site1',
        weights: {
          shapes: [[2]],
          data: [new Float32Array([2, 4])],
        },
        sampleCount: 100,
        roundNumber: 1,
        metrics: { loss: 0.5, accuracy: 0.8 },
      };

      const update2: ClientUpdate = {
        siteId: 'site2',
        weights: {
          shapes: [[2]],
          data: [new Float32Array([4, 6])],
        },
        sampleCount: 200,
        roundNumber: 1,
        metrics: { loss: 0.4, accuracy: 0.85 },
      };

      const config: FedAvgConfig = {
        totalRounds: 10,
        minParticipants: 2,
        aggregationStrategy: 'weighted',
      };

      const aggregated = aggregateWeights([update1, update2], config);

      // Expected: (100*[2,4] + 200*[4,6]) / 300 = [3.33, 5.33]
      expect(aggregated.shapes).toEqual([[2]]);
      const values = Array.from(aggregated.data[0]);
      expect(values[0]).toBeCloseTo(3.33, 1);
      expect(values[1]).toBeCloseTo(5.33, 1);
    });

    it('should aggregate weights with uniform strategy', () => {
      const update1: ClientUpdate = {
        siteId: 'site1',
        weights: {
          shapes: [[2]],
          data: [new Float32Array([2, 4])],
        },
        sampleCount: 100,
        roundNumber: 1,
        metrics: { loss: 0.5, accuracy: 0.8 },
      };

      const update2: ClientUpdate = {
        siteId: 'site2',
        weights: {
          shapes: [[2]],
          data: [new Float32Array([4, 6])],
        },
        sampleCount: 200,
        roundNumber: 1,
        metrics: { loss: 0.4, accuracy: 0.85 },
      };

      const config: FedAvgConfig = {
        totalRounds: 10,
        minParticipants: 2,
        aggregationStrategy: 'uniform',
      };

      const aggregated = aggregateWeights([update1, update2], config);

      // Expected: ([2,4] + [4,6]) / 2 = [3, 5]
      expect(aggregated.shapes).toEqual([[2]]);
      const values = Array.from(aggregated.data[0]);
      expect(values[0]).toBeCloseTo(3, 1);
      expect(values[1]).toBeCloseTo(5, 1);
    });

    it('should throw error if insufficient participants', () => {
      const update: ClientUpdate = {
        siteId: 'site1',
        weights: {
          shapes: [[2]],
          data: [new Float32Array([2, 4])],
        },
        sampleCount: 100,
        roundNumber: 1,
        metrics: { loss: 0.5, accuracy: 0.8 },
      };

      const config: FedAvgConfig = {
        totalRounds: 10,
        minParticipants: 2,
        aggregationStrategy: 'weighted',
      };

      expect(() => aggregateWeights([update], config)).toThrow('Insufficient participants: 1 < 2');
    });
  });

  describe('initializeGlobalModel', () => {
    it('should create initial global model', () => {
      const initialWeights = {
        shapes: [[2, 2]],
        data: [new Float32Array([1, 2, 3, 4])],
      };

      const model = initializeGlobalModel(initialWeights, 10);

      expect(model.weights).toEqual(initialWeights);
      expect(model.round.roundNumber).toBe(0);
      expect(model.round.totalRounds).toBe(10);
      expect(model.round.participantCount).toBe(0);
      expect(model.aggregatedSamples).toBe(0);
      expect(model.round.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('updateGlobalModel', () => {
    it('should update global model with new round', () => {
      const currentModel = initializeGlobalModel(
        {
          shapes: [[2]],
          data: [new Float32Array([1, 2])],
        },
        10
      );

      const updates: ClientUpdate[] = [
        {
          siteId: 'site1',
          weights: {
            shapes: [[2]],
            data: [new Float32Array([2, 3])],
          },
          sampleCount: 100,
          roundNumber: 1,
          metrics: { loss: 0.5, accuracy: 0.8 },
        },
        {
          siteId: 'site2',
          weights: {
            shapes: [[2]],
            data: [new Float32Array([3, 4])],
          },
          sampleCount: 150,
          roundNumber: 1,
          metrics: { loss: 0.4, accuracy: 0.85 },
        },
      ];

      const config: FedAvgConfig = {
        totalRounds: 10,
        minParticipants: 2,
        aggregationStrategy: 'weighted',
      };

      const updatedModel = updateGlobalModel(currentModel, updates, config);

      expect(updatedModel.round.roundNumber).toBe(1);
      expect(updatedModel.round.participantCount).toBe(2);
      expect(updatedModel.aggregatedSamples).toBe(250);
      expect(updatedModel.weights.shapes).toEqual([[2]]);
    });
  });
});
