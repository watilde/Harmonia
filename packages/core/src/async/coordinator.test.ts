import { AsyncFLCoordinator } from './coordinator';
import { createDefaultAsyncFLConfig } from './staleness';
import type { VersionedUpdate } from './types';

describe('AsyncFLCoordinator', () => {
  const createUpdate = (
    siteId: string,
    baseVersion: number,
    loss: number = 0.5
  ): VersionedUpdate => ({
    siteId,
    baseVersion,
    weights: {
      data: [new Float32Array([1, 2, 3])],
      shapes: [[3]],
    },
    sampleCount: 100,
    metrics: { loss, accuracy: 0.8 },
    timestamp: Date.now(),
    encrypted: false,
  });

  it('should process single update', async () => {
    const initialWeights = {
      data: [new Float32Array([0, 0, 0])],
      shapes: [[3]],
    };

    const config = createDefaultAsyncFLConfig();
    const coordinator = new AsyncFLCoordinator('study-1', initialWeights, config);

    const update = createUpdate('site-a', 0);
    const result = await coordinator.processUpdate(update);

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(result.newVersion.version).toBe(1);
  });

  it('should reject very stale updates', async () => {
    const initialWeights = {
      data: [new Float32Array([0, 0, 0])],
      shapes: [[3]],
    };

    const config = createDefaultAsyncFLConfig();
    const coordinator = new AsyncFLCoordinator('study-1', initialWeights, config);

    for (let i = 0; i < 10; i++) {
      await coordinator.processUpdate(createUpdate(`site-${i}`, i));
    }

    const staleUpdate = createUpdate('site-old', 0);
    const result = await coordinator.processUpdate(staleUpdate);

    expect(result.acceptedCount).toBe(0);
    expect(result.rejectedCount).toBe(1);
  });

  it('should process multiple updates in batch', async () => {
    const initialWeights = {
      data: [new Float32Array([0, 0, 0])],
      shapes: [[3]],
    };

    const config = createDefaultAsyncFLConfig();
    config.minUpdatesPerRound = 2;
    const coordinator = new AsyncFLCoordinator('study-1', initialWeights, config);

    const updates = [createUpdate('site-a', 0), createUpdate('site-b', 0)];

    const result = await coordinator.processBatch(updates);

    expect(result.acceptedCount).toBe(2);
    expect(result.rejectedCount).toBe(0);
    expect(result.newVersion.version).toBe(1);
  });

  it('should track statistics', async () => {
    const initialWeights = {
      data: [new Float32Array([0, 0, 0])],
      shapes: [[3]],
    };

    const config = createDefaultAsyncFLConfig();
    const coordinator = new AsyncFLCoordinator('study-1', initialWeights, config);

    await coordinator.processUpdate(createUpdate('site-a', 0));
    await coordinator.processUpdate(createUpdate('site-b', 1));
    await coordinator.processUpdate(createUpdate('site-a', 2));

    const stats = coordinator.getStatistics();

    expect(stats.totalUpdates).toBe(3);
    expect(stats.acceptedUpdates).toBe(3);
    expect(stats.participantStats.size).toBe(2);
    expect(stats.participantStats.get('site-a')?.updateCount).toBe(2);
  });
});
