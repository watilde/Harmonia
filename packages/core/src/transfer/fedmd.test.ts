/**
 * Tests for FedMD (Federated Model Distillation)
 */

import {
  applyTemperatureScaling,
  aggregateSoftPredictions,
  computeDistillationLoss,
  createDistillationDataset,
  validateConsensus,
  initializeFedMD,
  FedMDTracker,
} from './fedmd';
import type { SoftPredictions, FedMDParticipant } from './fedmd';

describe('FedMD', () => {
  describe('applyTemperatureScaling', () => {
    it('should apply temperature scaling to logits', () => {
      const logits = new Float32Array([
        2.0,
        1.0,
        0.1, // Sample 1
        1.0,
        3.0,
        2.0, // Sample 2
      ]);
      const numClasses = 3;
      const temperature = 2.0;

      const softened = applyTemperatureScaling(logits, numClasses, temperature);

      // Check probabilities sum to 1 for each sample
      for (let i = 0; i < 2; i++) {
        let sum = 0;
        for (let c = 0; c < numClasses; c++) {
          sum += softened[i * numClasses + c];
        }
        expect(sum).toBeCloseTo(1.0, 5);
      }

      // Higher temperature should create more uniform distribution
      expect(softened[0]).toBeLessThan(0.9); // Not too peaked
    });

    it('should create more uniform distribution with higher temperature', () => {
      const logits = new Float32Array([5.0, 1.0, 1.0]);
      const numClasses = 3;

      const lowTemp = applyTemperatureScaling(logits, numClasses, 1.0);
      const highTemp = applyTemperatureScaling(logits, numClasses, 5.0);

      // Low temperature: more peaked (highest class has higher prob)
      // High temperature: more uniform (highest class has lower prob)
      expect(lowTemp[0]).toBeGreaterThan(highTemp[0]);
    });
  });

  describe('aggregateSoftPredictions', () => {
    it('should aggregate predictions with weighted averaging', () => {
      const participants: FedMDParticipant[] = [
        {
          siteId: 'site-a',
          domain: 'hospital-a',
          featureSpace: 'demographics + labs',
          labelSpace: 2,
          modelArchitecture: 'logistic-regression',
          dataSize: 100,
        },
        {
          siteId: 'site-b',
          domain: 'hospital-b',
          featureSpace: 'diagnoses + procedures',
          labelSpace: 2,
          modelArchitecture: 'neural-network',
          dataSize: 200,
        },
      ];

      const predictions: SoftPredictions[] = [
        {
          siteId: 'site-a',
          roundNumber: 1,
          predictions: new Float32Array([0.8, 0.2, 0.3, 0.7]),
          numClasses: 2,
          publicDatasetSize: 2,
          temperature: 1.0,
          timestamp: Date.now(),
        },
        {
          siteId: 'site-b',
          roundNumber: 1,
          predictions: new Float32Array([0.6, 0.4, 0.4, 0.6]),
          numClasses: 2,
          publicDatasetSize: 2,
          temperature: 1.0,
          timestamp: Date.now(),
        },
      ];

      const config = initializeFedMD('test-study', 2, 2);

      const consensus = aggregateSoftPredictions(predictions, participants, config);

      expect(consensus.roundNumber).toBe(1);
      expect(consensus.numClasses).toBe(2);
      expect(consensus.participantCount).toBe(2);

      // Weighted average: site-b has 2x weight of site-a
      // Sample 0, class 0: (0.8 * 1 + 0.6 * 2) / 3 = 0.667
      expect(consensus.predictions[0]).toBeCloseTo(0.667, 2);
    });

    it('should handle different label spaces', () => {
      const participants: FedMDParticipant[] = [
        {
          siteId: 'site-a',
          domain: 'hospital-a',
          featureSpace: 'features-a',
          labelSpace: 2, // Binary classification
          modelArchitecture: 'model-a',
          dataSize: 100,
        },
        {
          siteId: 'site-b',
          domain: 'hospital-b',
          featureSpace: 'features-b',
          labelSpace: 3, // 3-class classification
          modelArchitecture: 'model-b',
          dataSize: 100,
        },
      ];

      const predictions: SoftPredictions[] = [
        {
          siteId: 'site-a',
          roundNumber: 1,
          predictions: new Float32Array([0.7, 0.3]), // 2 classes
          numClasses: 2,
          publicDatasetSize: 1,
          temperature: 1.0,
          timestamp: Date.now(),
        },
        {
          siteId: 'site-b',
          roundNumber: 1,
          predictions: new Float32Array([0.5, 0.3, 0.2]), // 3 classes
          numClasses: 3,
          publicDatasetSize: 1,
          temperature: 1.0,
          timestamp: Date.now(),
        },
      ];

      const config = initializeFedMD('test-study', 2, 1);

      const consensus = aggregateSoftPredictions(predictions, participants, config);

      // Should handle max of 3 classes
      expect(consensus.numClasses).toBe(3);
    });

    it('should throw error if insufficient participants', () => {
      const predictions: SoftPredictions[] = [
        {
          siteId: 'site-a',
          roundNumber: 1,
          predictions: new Float32Array([0.7, 0.3]),
          numClasses: 2,
          publicDatasetSize: 1,
          temperature: 1.0,
          timestamp: Date.now(),
        },
      ];

      const config = initializeFedMD('test-study', 2, 1);
      config.minParticipants = 2;

      expect(() => aggregateSoftPredictions(predictions, [], config)).toThrow(
        'Insufficient participants'
      );
    });
  });

  describe('computeDistillationLoss', () => {
    it('should compute KL divergence', () => {
      const local = new Float32Array([0.7, 0.3, 0.6, 0.4]);
      const consensus = new Float32Array([0.6, 0.4, 0.5, 0.5]);

      const loss = computeDistillationLoss(local, consensus, 2, 2);

      expect(loss).toBeGreaterThan(0);
      expect(isFinite(loss)).toBe(true);
    });

    it('should return 0 for identical distributions', () => {
      const local = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const consensus = new Float32Array([0.5, 0.5, 0.5, 0.5]);

      const loss = computeDistillationLoss(local, consensus, 2, 2);

      expect(loss).toBeCloseTo(0, 5);
    });
  });

  describe('createDistillationDataset', () => {
    it('should create dataset with soft and hard labels', () => {
      const publicData = [new Float32Array([1.0, 2.0]), new Float32Array([3.0, 4.0])];

      const consensus = {
        roundNumber: 1,
        predictions: new Float32Array([0.8, 0.2, 0.3, 0.7]),
        numClasses: 2,
        participantCount: 2,
        agreement: 0.8,
        timestamp: Date.now(),
      };

      const dataset = createDistillationDataset(publicData, consensus);

      expect(dataset.features).toEqual(publicData);
      expect(dataset.softLabels).toEqual(consensus.predictions);
      expect(dataset.hardLabels.length).toBe(2);

      // Hard labels should be argmax of soft labels
      expect(dataset.hardLabels[0]).toBe(0); // 0.8 > 0.2
      expect(dataset.hardLabels[1]).toBe(1); // 0.7 > 0.3
    });
  });

  describe('validateConsensus', () => {
    const config = initializeFedMD('test-study', 3, 100);

    it('should validate sufficient participants', () => {
      const consensus = {
        roundNumber: 1,
        predictions: new Float32Array([0.5, 0.5]),
        numClasses: 2,
        participantCount: 1,
        agreement: 0.8,
        timestamp: Date.now(),
      };

      const result = validateConsensus(consensus, config);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Insufficient participants');
    });

    it('should validate agreement threshold', () => {
      const consensus = {
        roundNumber: 1,
        predictions: new Float32Array([0.5, 0.5]),
        numClasses: 2,
        participantCount: 2,
        agreement: 0.3, // Below threshold
        timestamp: Date.now(),
      };

      const result = validateConsensus(consensus, config);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Low agreement');
    });

    it('should pass valid consensus', () => {
      const consensus = {
        roundNumber: 1,
        predictions: new Float32Array([0.5, 0.5]),
        numClasses: 2,
        participantCount: 2,
        agreement: 0.8,
        timestamp: Date.now(),
      };

      const result = validateConsensus(consensus, config);

      expect(result.valid).toBe(true);
    });
  });

  describe('FedMDTracker', () => {
    it('should track rounds and compute statistics', () => {
      const tracker = new FedMDTracker();

      tracker.addRound({
        roundNumber: 1,
        participantCount: 3,
        agreement: 0.6,
        avgDistillationLoss: 0.5,
        consensusEntropy: 0.3,
        timestamp: Date.now(),
      });

      tracker.addRound({
        roundNumber: 2,
        participantCount: 3,
        agreement: 0.8,
        avgDistillationLoss: 0.3,
        consensusEntropy: 0.2,
        timestamp: Date.now(),
      });

      expect(tracker.getCurrentRound()).toBe(2);
      expect(tracker.getAverageAgreement()).toBeCloseTo(0.7, 5);

      const summary = tracker.getSummary();
      expect(summary.totalRounds).toBe(2);
      expect(summary.finalAgreement).toBe(0.8);
      expect(summary.improvementRate).toBeGreaterThan(0); // Agreement improved
    });
  });
});
