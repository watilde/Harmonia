import {
  calculateStaleness,
  calculateStalenessWeight,
  shouldAcceptUpdate,
  processUpdates,
  getAcceptedUpdates,
  createDefaultAsyncFLConfig,
} from './staleness';
import type { VersionedUpdate } from './types';

describe('Staleness-aware Aggregation', () => {
  const createUpdate = (siteId: string, baseVersion: number): VersionedUpdate => ({
    siteId,
    baseVersion,
    weights: {
      data: [new Float32Array([1, 2, 3])],
      shapes: [[3]],
    },
    sampleCount: 100,
    metrics: { loss: 0.5, accuracy: 0.8 },
    timestamp: Date.now(),
    encrypted: false,
  });

  it('should calculate staleness correctly', () => {
    const update = createUpdate('site-a', 5);
    expect(calculateStaleness(update, 10)).toBe(5);
    expect(calculateStaleness(update, 5)).toBe(0);
  });

  it('should calculate staleness weight with decay', () => {
    expect(calculateStalenessWeight(0, 0.5)).toBe(1.0);
    expect(calculateStalenessWeight(2, 0.5)).toBe(0.5);
  });

  it('should accept fresh updates', () => {
    const config = createDefaultAsyncFLConfig();
    const update = createUpdate('site-a', 10);
    const result = shouldAcceptUpdate(update, 10, config);
    expect(result.accepted).toBe(true);
  });

  it('should reject very stale updates', () => {
    const config = createDefaultAsyncFLConfig();
    const update = createUpdate('site-a', 1);
    const result = shouldAcceptUpdate(update, 10, config);
    expect(result.accepted).toBe(false);
  });

  it('should process multiple updates', () => {
    const config = createDefaultAsyncFLConfig();
    const updates = [
      createUpdate('site-a', 10),
      createUpdate('site-b', 8),
      createUpdate('site-c', 5),
    ];

    const processed = processUpdates(updates, 10, config);
    expect(processed).toHaveLength(3);
    expect(processed[0].staleness).toBe(0);
    expect(processed[1].staleness).toBe(2);
    expect(processed[2].staleness).toBe(5);
  });

  it('should filter accepted updates', () => {
    const processed = [
      {
        update: createUpdate('site-a', 10),
        currentVersion: 10,
        staleness: 0,
        weight: 1.0,
        accepted: true,
      },
      {
        update: createUpdate('site-b', 3),
        currentVersion: 10,
        staleness: 7,
        weight: 0,
        accepted: false,
      },
    ];

    const accepted = getAcceptedUpdates(processed);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].update.siteId).toBe('site-a');
  });
});
