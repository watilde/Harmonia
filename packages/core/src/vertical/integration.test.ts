/**
 * Integration Tests for Vertical Federated Learning
 */

import {
  SplitLearningClient,
  SplitLearningCoordinator,
  createDefaultVFLPrivacyConfig,
} from './index';
import type { VFLParticipant, EmbeddingUpdate } from './types';

describe('Vertical FL Integration', () => {
  const privacyConfig = createDefaultVFLPrivacyConfig();
  const embeddingDim = 16;
  const inputDim = 32;
  const batchSize = 4;

  let clientA: SplitLearningClient;
  let clientB: SplitLearningClient;
  let coordinator: SplitLearningCoordinator;

  beforeEach(() => {
    // Create participants
    const participantA: VFLParticipant = {
      siteId: 'site-a',
      role: 'guest',
      featureDomains: ['Condition', 'Procedure'],
      bottomModelConfig: {
        inputDim,
        outputDim: embeddingDim,
        hiddenLayers: [24],
        activation: 'relu',
      },
      hasLabels: false,
    };

    const participantB: VFLParticipant = {
      siteId: 'site-b',
      role: 'guest',
      featureDomains: ['Measurement'],
      bottomModelConfig: {
        inputDim,
        outputDim: embeddingDim,
        hiddenLayers: [24],
        activation: 'relu',
      },
      hasLabels: false,
    };

    // Initialize clients
    clientA = new SplitLearningClient(participantA, privacyConfig);
    clientB = new SplitLearningClient(participantB, privacyConfig);

    clientA.initializeBottomModel();
    clientB.initializeBottomModel();

    // Initialize coordinator
    coordinator = new SplitLearningCoordinator(
      {
        topModelConfig: {
          inputDim: embeddingDim * 2, // Concatenated embeddings
          outputDim: 1, // Binary classification
          hiddenLayers: [16],
          activation: 'relu',
        },
        optimizer: {
          type: 'adam',
          learningRate: 0.001,
        },
        batchSize,
        aggregationStrategy: 'concat',
      },
      privacyConfig,
      embeddingDim
    );

    coordinator.initializeTopModel(embeddingDim * 2);
  });

  afterEach(() => {
    clientA.dispose();
    clientB.dispose();
    coordinator.dispose();
  });

  it('should complete one training round', async () => {
    // Generate synthetic features
    const featuresA = new Float32Array(batchSize * inputDim);
    const featuresB = new Float32Array(batchSize * inputDim);

    for (let i = 0; i < featuresA.length; i++) {
      featuresA[i] = Math.random();
      featuresB[i] = Math.random();
    }

    // Step 1: Clients compute embeddings
    const embeddingA = await clientA.computeEmbeddings(
      featuresA,
      batchSize,
      false // Disable DP for testing
    );
    const embeddingB = await clientB.computeEmbeddings(featuresB, batchSize, false);

    expect(embeddingA.embeddings.shape).toEqual([batchSize, embeddingDim]);
    expect(embeddingB.embeddings.shape).toEqual([batchSize, embeddingDim]);

    // Step 2: Coordinator trains top model
    const labels = new Float32Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
      labels[i] = Math.random() > 0.5 ? 1 : 0;
    }

    const updates: EmbeddingUpdate[] = [embeddingA, embeddingB];
    const result = await coordinator.trainTopModel(updates, labels, 1);

    expect(result.loss).toBeGreaterThan(0);
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(1);
    expect(result.gradients.size).toBe(2);

    // Step 3: Clients update bottom models
    const gradientA = result.gradients.get('site-a');
    const gradientB = result.gradients.get('site-b');

    expect(gradientA).toBeDefined();
    expect(gradientB).toBeDefined();

    await clientA.updateBottomModel(gradientA!);
    await clientB.updateBottomModel(gradientB!);

    expect(clientA.getCurrentRound()).toBe(1);
    expect(clientB.getCurrentRound()).toBe(1);
  }, 30000); // Increase timeout for TensorFlow operations

  it('should handle privacy protection', async () => {
    const features = new Float32Array(batchSize * inputDim);
    for (let i = 0; i < features.length; i++) {
      features[i] = Math.random();
    }

    // Compute with DP enabled
    const embeddingWithDP = await clientA.computeEmbeddings(features, batchSize, true);

    // Compute without DP
    clientA.resetRound();
    const embeddingWithoutDP = await clientA.computeEmbeddings(features, batchSize, false);

    // Results should be different due to DP noise
    expect(Array.from(embeddingWithDP.embeddings.data)).not.toEqual(
      Array.from(embeddingWithoutDP.embeddings.data)
    );

    // DP version should have privacy stats
    expect(embeddingWithDP.privacyStats).toBeDefined();
    expect(embeddingWithDP.privacyStats!.noiseMagnitude).toBeGreaterThan(0);
  }, 30000);

  it('should export and import models', () => {
    const weights = coordinator.getTopModelWeights();

    expect(weights.data.length).toBeGreaterThan(0);
    expect(weights.shapes.length).toBeGreaterThan(0);
    expect(weights.data.length).toBe(weights.shapes.length);

    // Should be able to set weights
    expect(() => coordinator.setTopModelWeights(weights.data, weights.shapes)).not.toThrow();
  });
});
