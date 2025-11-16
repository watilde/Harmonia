/**
 * Tests for Model Dependency Resolution
 */

import {
  resolveModelDependencies,
  validateHarmoniaConfig,
  generateTrainingPlan,
  getModelExecutionOrder,
  canTrainModel,
  getModelDependencies,
  getModelDependents,
} from './dependency-resolver';
import type { HarmoniaConfig } from './../types/harmonia-config';

describe('Dependency Resolver', () => {
  describe('resolveModelDependencies', () => {
    it('should resolve 2-layer dependencies', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-b': {
            name: 'Model B',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-c': {
            name: 'Model C',
            type: 'neural-network',
            dependencies: {
              'model-a': 'embedding',
              'model-b': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-a', 'model-b'] },
            output: { type: 'prediction', task: 'binary-classification' },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const layers = resolveModelDependencies(config);

      expect(layers).toHaveLength(2);
      expect(layers[0].layer).toBe(0);
      expect(layers[0].models).toEqual(expect.arrayContaining(['model-a', 'model-b']));
      expect(layers[0].parallelizable).toBe(true);
      expect(layers[1].layer).toBe(1);
      expect(layers[1].models).toEqual(['model-c']);
      expect(layers[1].parallelizable).toBe(true);
    });

    it('should resolve 3-layer dependencies', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-b': {
            name: 'Model B',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-c': {
            name: 'Model C',
            type: 'neural-network',
            dependencies: {
              'model-a': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-a'] },
            output: { type: 'embedding', dimension: 128 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-d': {
            name: 'Model D',
            type: 'neural-network',
            dependencies: {
              'model-b': 'embedding',
              'model-c': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-b', 'model-c'] },
            output: { type: 'prediction', task: 'binary-classification' },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 15,
          strategy: 'sequential-by-layer',
        },
      };

      const layers = resolveModelDependencies(config);

      expect(layers).toHaveLength(3);
      expect(layers[0].models).toEqual(expect.arrayContaining(['model-a', 'model-b']));
      expect(layers[1].models).toEqual(['model-c']);
      expect(layers[2].models).toEqual(['model-d']);
    });

    it('should detect circular dependencies', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {
              'model-b': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-b': {
            name: 'Model B',
            type: 'logistic-regression',
            dependencies: {
              'model-a': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      expect(() => resolveModelDependencies(config)).toThrow('Circular dependency detected');
    });
  });

  describe('validateHarmoniaConfig', () => {
    it('should validate correct configuration', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const result = validateHarmoniaConfig(config);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject missing study name', () => {
      const config: HarmoniaConfig = {
        name: '',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const result = validateHarmoniaConfig(config);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('name is required');
    });

    it('should reject non-existent dependency', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'neural-network',
            dependencies: {
              'model-nonexistent': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-nonexistent'] },
            output: { type: 'prediction', task: 'binary-classification' },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const result = validateHarmoniaConfig(config);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('non-existent model');
    });

    it('should reject self-dependency', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'neural-network',
            dependencies: {
              'model-a': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-a'] },
            output: { type: 'prediction', task: 'binary-classification' },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const result = validateHarmoniaConfig(config);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('cannot depend on itself');
    });
  });

  describe('generateTrainingPlan', () => {
    it('should generate training plan with correct round distribution', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-b': {
            name: 'Model B',
            type: 'neural-network',
            dependencies: {
              'model-a': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-a'] },
            output: { type: 'prediction', task: 'binary-classification' },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const plan = generateTrainingPlan(config);

      expect(plan.totalLayers).toBe(2);
      expect(plan.layers).toHaveLength(2);
      expect(plan.layers[0].layer).toBe(1); // 1-indexed
      expect(plan.layers[0].roundsPerModel).toBe(5);
      expect(plan.layers[1].layer).toBe(2);
      expect(plan.layers[1].roundsPerModel).toBe(5);
    });
  });

  describe('getModelExecutionOrder', () => {
    it('should return models in execution order', () => {
      const config: HarmoniaConfig = {
        name: 'test-study',
        version: '1.0.0',
        description: 'Test study',
        study: {
          coordinator: {
            name: 'Test',
            email: 'test@test.com',
            organization: 'Test Org',
          },
        },
        models: {
          'model-c': {
            name: 'Model C',
            type: 'neural-network',
            dependencies: {
              'model-a': 'embedding',
              'model-b': 'embedding',
            },
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'concatenated', sources: ['model-a', 'model-b'] },
            output: { type: 'prediction', task: 'binary-classification' },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-a': {
            name: 'Model A',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
          'model-b': {
            name: 'Model B',
            type: 'logistic-regression',
            dependencies: {},
            federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
            input: { type: 'tabular' },
            output: { type: 'embedding', dimension: 64 },
            training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
          },
        },
        training: {
          totalRounds: 10,
          strategy: 'sequential-by-layer',
        },
      };

      const order = getModelExecutionOrder(config);

      const indexA = order.indexOf('model-a');
      const indexB = order.indexOf('model-b');
      const indexC = order.indexOf('model-c');

      expect(indexC).toBeGreaterThan(indexA);
      expect(indexC).toBeGreaterThan(indexB);
    });
  });

  describe('canTrainModel', () => {
    const config: HarmoniaConfig = {
      name: 'test-study',
      version: '1.0.0',
      description: 'Test study',
      study: {
        coordinator: {
          name: 'Test',
          email: 'test@test.com',
          organization: 'Test Org',
        },
      },
      models: {
        'model-a': {
          name: 'Model A',
          type: 'logistic-regression',
          dependencies: {},
          federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
          input: { type: 'tabular' },
          output: { type: 'embedding', dimension: 64 },
          training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
        },
        'model-b': {
          name: 'Model B',
          type: 'neural-network',
          dependencies: {
            'model-a': 'embedding',
          },
          federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
          input: { type: 'concatenated', sources: ['model-a'] },
          output: { type: 'prediction', task: 'binary-classification' },
          training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
        },
      },
      training: {
        totalRounds: 10,
        strategy: 'sequential-by-layer',
      },
    };

    it('should allow training model with no dependencies', () => {
      const trained = new Set<string>();
      expect(canTrainModel('model-a', config, trained)).toBe(true);
    });

    it('should not allow training model with unmet dependencies', () => {
      const trained = new Set<string>();
      expect(canTrainModel('model-b', config, trained)).toBe(false);
    });

    it('should allow training model when dependencies are met', () => {
      const trained = new Set(['model-a']);
      expect(canTrainModel('model-b', config, trained)).toBe(true);
    });
  });

  describe('getModelDependencies and getModelDependents', () => {
    const config: HarmoniaConfig = {
      name: 'test-study',
      version: '1.0.0',
      description: 'Test study',
      study: {
        coordinator: {
          name: 'Test',
          email: 'test@test.com',
          organization: 'Test Org',
        },
      },
      models: {
        'model-a': {
          name: 'Model A',
          type: 'logistic-regression',
          dependencies: {},
          federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
          input: { type: 'tabular' },
          output: { type: 'embedding', dimension: 64 },
          training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
        },
        'model-b': {
          name: 'Model B',
          type: 'neural-network',
          dependencies: {
            'model-a': 'embedding',
          },
          federation: { architecture: 'horizontal', algorithm: 'fedavg', config: {} },
          input: { type: 'concatenated', sources: ['model-a'] },
          output: { type: 'prediction', task: 'binary-classification' },
          training: { epochs: 5, batchSize: 32, learningRate: 0.01 },
        },
      },
      training: {
        totalRounds: 10,
        strategy: 'sequential-by-layer',
      },
    };

    it('should get model dependencies', () => {
      expect(getModelDependencies('model-a', config)).toEqual([]);
      expect(getModelDependencies('model-b', config)).toEqual(['model-a']);
    });

    it('should get model dependents', () => {
      expect(getModelDependents('model-a', config)).toEqual(['model-b']);
      expect(getModelDependents('model-b', config)).toEqual([]);
    });
  });
});
