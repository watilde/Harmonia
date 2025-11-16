/**
 * Tests for FMTL (Federated Multi-Task Learning)
 */

import {
  aggregateSharedWeights,
  learnTaskRelationships,
  applyTaskRegularization,
  computePersonalizationScore,
  initializeFMTL,
  FMTLTracker,
} from './fmtl';
import type { MTLModelWeights, TaskRelationshipMatrix } from './fmtl';

describe('FMTL', () => {
  describe('aggregateSharedWeights', () => {
    it('should aggregate shared weights from multiple tasks', () => {
      const updates: MTLModelWeights[] = [
        {
          siteId: 'site-a',
          taskId: 'task-1',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([1.0, 2.0, 3.0, 4.0])],
            shapes: [[2, 2]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([1.0, 1.0])],
            shapes: [[2]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
        {
          siteId: 'site-b',
          taskId: 'task-2',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([5.0, 6.0, 7.0, 8.0])],
            shapes: [[2, 2]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([2.0, 2.0])],
            shapes: [[2]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
      ];

      const relationships: TaskRelationshipMatrix = {
        taskIds: ['task-1', 'task-2'],
        relationships: new Float32Array([
          1.0,
          0.8, // task-1 relationships
          0.8,
          1.0, // task-2 relationships
        ]),
        confidence: 0.9,
        roundNumber: 1,
      };

      const config = initializeFMTL('test-study', 2);

      const result = aggregateSharedWeights(updates, relationships, config);

      expect(result.participantIds).toEqual(['site-a', 'site-b']);
      expect(result.aggregatedWeights.shapes).toEqual([[2, 2]]);
      // Weighted aggregation should produce values between min and max
      expect(result.aggregatedWeights.data[0][0]).toBeGreaterThan(1.0);
      expect(result.aggregatedWeights.data[0][0]).toBeLessThan(5.0);
    });

    it('should throw error if insufficient participants', () => {
      const updates: MTLModelWeights[] = [
        {
          siteId: 'site-a',
          taskId: 'task-1',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([1.0, 2.0])],
            shapes: [[2]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([1.0])],
            shapes: [[1]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
      ];

      const relationships: TaskRelationshipMatrix = {
        taskIds: ['task-1'],
        relationships: new Float32Array([1.0]),
        confidence: 1.0,
        roundNumber: 1,
      };

      const config = initializeFMTL('test-study', 2);

      expect(() => aggregateSharedWeights(updates, relationships, config)).toThrow(
        'Insufficient participants'
      );
    });
  });

  describe('learnTaskRelationships', () => {
    it('should learn relationships between tasks', () => {
      const updates: MTLModelWeights[] = [
        {
          siteId: 'site-a',
          taskId: 'task-1',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([1.0, 2.0, 3.0])],
            shapes: [[3]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([1.0])],
            shapes: [[1]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
        {
          siteId: 'site-b',
          taskId: 'task-2',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([1.1, 2.1, 3.1])], // Similar to task-1
            shapes: [[3]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([2.0])],
            shapes: [[1]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
        {
          siteId: 'site-c',
          taskId: 'task-3',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([-1.0, -2.0, -3.0])], // Different from task-1/2
            shapes: [[3]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([3.0])],
            shapes: [[1]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
      ];

      const relationships = learnTaskRelationships(updates);

      expect(relationships.taskIds).toEqual(['task-1', 'task-2', 'task-3']);
      expect(relationships.relationships.length).toBe(9); // 3x3 matrix

      // Self-similarity should be 1.0
      expect(relationships.relationships[0]).toBe(1.0); // task-1 with itself
      expect(relationships.relationships[4]).toBe(1.0); // task-2 with itself
      expect(relationships.relationships[8]).toBe(1.0); // task-3 with itself

      // task-1 and task-2 should be more similar than task-1 and task-3
      const sim_1_2 = relationships.relationships[1]; // task-1 with task-2
      const sim_1_3 = relationships.relationships[2]; // task-1 with task-3

      expect(sim_1_2).toBeGreaterThan(sim_1_3);
    });

    it('should have symmetric relationship matrix', () => {
      const updates: MTLModelWeights[] = [
        {
          siteId: 'site-a',
          taskId: 'task-1',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([1.0, 2.0])],
            shapes: [[2]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([1.0])],
            shapes: [[1]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
        {
          siteId: 'site-b',
          taskId: 'task-2',
          roundNumber: 1,
          sharedWeights: {
            data: [new Float32Array([3.0, 4.0])],
            shapes: [[2]],
          },
          taskSpecificWeights: {
            data: [new Float32Array([2.0])],
            shapes: [[1]],
          },
          sampleCount: 100,
          timestamp: Date.now(),
        },
      ];

      const relationships = learnTaskRelationships(updates);

      // Similarity should be symmetric
      expect(relationships.relationships[1]).toBeCloseTo(relationships.relationships[2], 5);
    });
  });

  describe('applyTaskRegularization', () => {
    it('should regularize local weights toward global', () => {
      const localWeights: MTLModelWeights = {
        siteId: 'site-a',
        taskId: 'task-1',
        roundNumber: 1,
        sharedWeights: {
          data: [new Float32Array([1.0, 2.0])],
          shapes: [[2]],
        },
        taskSpecificWeights: {
          data: [new Float32Array([1.0])],
          shapes: [[1]],
        },
        sampleCount: 100,
        timestamp: Date.now(),
      };

      const globalWeights = {
        data: [new Float32Array([5.0, 6.0])],
        shapes: [[2]],
      };

      const relationships: TaskRelationshipMatrix = {
        taskIds: ['task-1', 'task-2'],
        relationships: new Float32Array([
          1.0,
          0.8, // task-1 with task-2
          0.8,
          1.0,
        ]),
        confidence: 0.9,
        roundNumber: 1,
      };

      const lambda = 0.1;

      const regularized = applyTaskRegularization(
        localWeights,
        globalWeights,
        relationships,
        lambda
      );

      // Regularized weights should be between local and global
      expect(regularized[0][0]).toBeGreaterThan(1.0); // Moved from 1.0 toward 5.0
      expect(regularized[0][0]).toBeLessThan(5.0);
    });

    it('should return local weights if task not in relationships', () => {
      const localWeights: MTLModelWeights = {
        siteId: 'site-a',
        taskId: 'task-unknown',
        roundNumber: 1,
        sharedWeights: {
          data: [new Float32Array([1.0, 2.0])],
          shapes: [[2]],
        },
        taskSpecificWeights: {
          data: [new Float32Array([1.0])],
          shapes: [[1]],
        },
        sampleCount: 100,
        timestamp: Date.now(),
      };

      const globalWeights = {
        data: [new Float32Array([5.0, 6.0])],
        shapes: [[2]],
      };

      const relationships: TaskRelationshipMatrix = {
        taskIds: ['task-1', 'task-2'],
        relationships: new Float32Array([1.0, 0.8, 0.8, 1.0]),
        confidence: 0.9,
        roundNumber: 1,
      };

      const regularized = applyTaskRegularization(localWeights, globalWeights, relationships, 0.1);

      // Should return original local weights
      expect(Array.from(regularized[0])).toEqual(Array.from(localWeights.sharedWeights.data[0]));
    });
  });

  describe('computePersonalizationScore', () => {
    it('should compute personalization based on weight norms', () => {
      const weights: MTLModelWeights = {
        siteId: 'site-a',
        taskId: 'task-1',
        roundNumber: 1,
        sharedWeights: {
          data: [new Float32Array([1.0, 1.0])], // Norm = sqrt(2)
          shapes: [[2]],
        },
        taskSpecificWeights: {
          data: [new Float32Array([3.0, 4.0])], // Norm = 5
          shapes: [[2]],
        },
        sampleCount: 100,
        timestamp: Date.now(),
      };

      const score = computePersonalizationScore(weights);

      // Score = task_specific / (shared + task_specific)
      // = 5 / (sqrt(2) + 5) ≈ 0.78
      expect(score).toBeGreaterThan(0.5); // More personalized
      expect(score).toBeLessThan(1.0);
    });

    it('should return 0.5 for zero weights', () => {
      const weights: MTLModelWeights = {
        siteId: 'site-a',
        taskId: 'task-1',
        roundNumber: 1,
        sharedWeights: {
          data: [new Float32Array([0.0, 0.0])],
          shapes: [[2]],
        },
        taskSpecificWeights: {
          data: [new Float32Array([0.0, 0.0])],
          shapes: [[2]],
        },
        sampleCount: 100,
        timestamp: Date.now(),
      };

      const score = computePersonalizationScore(weights);

      expect(score).toBe(0.5);
    });
  });

  describe('FMTLTracker', () => {
    it('should track rounds and compute statistics', () => {
      const tracker = new FMTLTracker();

      tracker.addRound({
        roundNumber: 1,
        participantCount: 3,
        avgTaskSimilarity: 0.6,
        relationshipConfidence: 0.7,
        avgPersonalization: 0.5,
        timestamp: Date.now(),
      });

      tracker.addRound({
        roundNumber: 2,
        participantCount: 3,
        avgTaskSimilarity: 0.65,
        relationshipConfidence: 0.8,
        avgPersonalization: 0.6,
        timestamp: Date.now(),
      });

      expect(tracker.getCurrentRound()).toBe(2);
      expect(tracker.getRelationshipStability()).toBeGreaterThan(0);

      const summary = tracker.getSummary();
      expect(summary.totalRounds).toBe(2);
      expect(summary.finalConfidence).toBe(0.8);
    });
  });
});
