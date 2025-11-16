/**
 * Tests for Model Builder
 */

import * as tf from '@tensorflow/tfjs-node';

import { buildModel } from './model-builder';
import { ModelConfig } from '../types';

describe('Model Builder', () => {
  afterEach(() => {
    tf.dispose();
  });

  describe('buildModel', () => {
    it('should build a simple sequential model', () => {
      const config: ModelConfig = {
        type: 'sequential',
        layers: [
          { type: 'dense', units: 64, activation: 'relu', inputShape: [10] },
          { type: 'dense', units: 32, activation: 'relu' },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
        optimizer: {
          type: 'adam',
          learningRate: 0.001,
        },
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
        epochs: 10,
        batchSize: 32,
      };

      const model = buildModel(config);

      expect(model).toBeDefined();
      expect(model.layers.length).toBe(3);
      expect(model.inputs[0].shape).toEqual([null, 10]);
      expect(model.outputs[0].shape).toEqual([null, 1]);

      model.dispose();
    });

    it('should build model with dropout layers', () => {
      const config: ModelConfig = {
        type: 'sequential',
        layers: [
          { type: 'dense', units: 32, activation: 'relu', inputShape: [8] },
          { type: 'dropout', rate: 0.3 },
          { type: 'dense', units: 16, activation: 'relu' },
          { type: 'dropout', rate: 0.2 },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
        optimizer: {
          type: 'adam',
          learningRate: 0.001,
        },
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
        epochs: 10,
        batchSize: 32,
      };

      const model = buildModel(config);

      expect(model.layers.length).toBe(5);

      model.dispose();
    });

    it('should configure optimizer correctly', () => {
      const config: ModelConfig = {
        type: 'sequential',
        layers: [
          { type: 'dense', units: 10, activation: 'relu', inputShape: [5] },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
        optimizer: {
          type: 'sgd',
          learningRate: 0.01,
        },
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
        epochs: 10,
        batchSize: 32,
      };

      const model = buildModel(config);

      // Verify model is compiled
      expect(model.optimizer).toBeDefined();
      expect(model.loss).toBeDefined();

      model.dispose();
    });

    it('should handle different activation functions', () => {
      const activations = ['relu', 'sigmoid', 'tanh', 'softmax'];

      activations.forEach((activation) => {
        const config: ModelConfig = {
          type: 'sequential',
          layers: [{ type: 'dense', units: 10, activation: activation as any, inputShape: [5] }],
          optimizer: {
            type: 'adam',
            learningRate: 0.001,
          },
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy'],
          epochs: 10,
          batchSize: 32,
        };

        const model = buildModel(config);
        expect(model).toBeDefined();
        model.dispose();
      });
    });

    it('should throw error for invalid layer type', () => {
      const config: ModelConfig = {
        type: 'sequential',
        layers: [{ type: 'invalid' as any, units: 10, inputShape: [5] }],
        optimizer: {
          type: 'adam',
          learningRate: 0.001,
        },
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
        epochs: 10,
        batchSize: 32,
      };

      expect(() => buildModel(config)).toThrow();
    });

    it('should handle multi-class classification', () => {
      const config: ModelConfig = {
        type: 'sequential',
        layers: [
          { type: 'dense', units: 64, activation: 'relu', inputShape: [20] },
          { type: 'dense', units: 32, activation: 'relu' },
          { type: 'dense', units: 5, activation: 'softmax' },
        ],
        optimizer: {
          type: 'adam',
          learningRate: 0.001,
        },
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
        epochs: 10,
        batchSize: 32,
      };

      const model = buildModel(config);

      expect(model.outputs[0].shape).toEqual([null, 5]);

      model.dispose();
    });
  });
});
