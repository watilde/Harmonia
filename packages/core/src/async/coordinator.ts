/**
 * Asynchronous Federated Learning Coordinator
 */

import type {
  AsyncFLConfig,
  VersionedUpdate,
  AsyncAggregationResult,
  ModelVersion,
  AsyncFLSession,
  AsyncFLStats,
} from './types';
import {
  processUpdates,
  getAcceptedUpdates,
  calculateAverageStaleness,
  aggregateWithStaleness,
  validateAsyncFLConfig,
} from './staleness';
import { performIncrementalUpdate } from './incremental';
import {
  initializeConvergenceTracker,
  updateConvergenceTracker,
  checkConvergence,
} from './convergence';

export class AsyncFLCoordinator {
  private config: AsyncFLConfig;
  private session: AsyncFLSession;
  private currentWeights: Float32Array[];
  private weightShapes: number[][];

  constructor(
    studyId: string,
    initialWeights: { data: Float32Array[]; shapes: number[][] },
    config: AsyncFLConfig
  ) {
    validateAsyncFLConfig(config);
    this.config = config;
    this.currentWeights = initialWeights.data.map((w) => new Float32Array(w));
    this.weightShapes = initialWeights.shapes;

    this.session = {
      studyId,
      currentVersion: {
        version: 0,
        timestamp: Date.now(),
        updateCount: 0,
      },
      convergenceTracker: initializeConvergenceTracker(),
      updateHistory: [],
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
    };
  }

  async processUpdate(update: VersionedUpdate): Promise<AsyncAggregationResult> {
    const processed = processUpdates([update], this.session.currentVersion.version, this.config);

    const accepted = getAcceptedUpdates(processed);

    if (accepted.length === 0) {
      return {
        newVersion: this.session.currentVersion,
        aggregatedWeights: {
          data: this.currentWeights,
          shapes: this.weightShapes,
        },
        updates: processed,
        acceptedCount: 0,
        rejectedCount: 1,
        averageStaleness: processed[0].staleness,
        convergenceStatus: {
          converged: this.session.convergenceTracker.converged,
          lossChange: 0,
          accuracy: this.session.convergenceTracker.accuracy,
        },
      };
    }

    let newWeights: Float32Array[];

    if (this.config.incrementalLearning) {
      const result = performIncrementalUpdate(
        this.currentWeights,
        this.session.currentVersion,
        update,
        this.config,
        accepted[0].weight
      );
      newWeights = result.updatedWeights.data;
      this.session.currentVersion = result.newVersion;
    } else {
      newWeights = aggregateWithStaleness(accepted, this.currentWeights);
      this.session.currentVersion = {
        version: this.session.currentVersion.version + 1,
        timestamp: Date.now(),
        loss: update.metrics.loss,
        accuracy: update.metrics.accuracy,
        updateCount: this.session.currentVersion.updateCount + 1,
      };
    }

    this.session.convergenceTracker = updateConvergenceTracker(
      this.session.convergenceTracker,
      this.session.currentVersion.version,
      update.metrics.loss,
      update.metrics.accuracy
    );

    const convergenceResult = checkConvergence(this.session.convergenceTracker, this.config);

    if (convergenceResult.converged) {
      this.session.convergenceTracker.converged = true;
    }

    this.currentWeights = newWeights;
    this.session.lastUpdateTime = Date.now();
    this.session.updateHistory.push(...processed);

    const lossChange = convergenceResult.metrics.lossChange || 0;

    return {
      newVersion: this.session.currentVersion,
      aggregatedWeights: {
        data: this.currentWeights,
        shapes: this.weightShapes,
      },
      updates: processed,
      acceptedCount: accepted.length,
      rejectedCount: processed.length - accepted.length,
      averageStaleness: calculateAverageStaleness(processed),
      convergenceStatus: {
        converged: convergenceResult.converged,
        lossChange,
        accuracy: this.session.currentVersion.accuracy,
      },
    };
  }

  async processBatch(updates: VersionedUpdate[]): Promise<AsyncAggregationResult> {
    if (updates.length === 0) {
      throw new Error('No updates to process');
    }

    if (updates.length < this.config.minUpdatesPerRound) {
      throw new Error(
        `Insufficient updates: need ${this.config.minUpdatesPerRound}, got ${updates.length}`
      );
    }

    const processed = processUpdates(updates, this.session.currentVersion.version, this.config);

    const accepted = getAcceptedUpdates(processed);

    if (accepted.length === 0) {
      return {
        newVersion: this.session.currentVersion,
        aggregatedWeights: {
          data: this.currentWeights,
          shapes: this.weightShapes,
        },
        updates: processed,
        acceptedCount: 0,
        rejectedCount: processed.length,
        averageStaleness: calculateAverageStaleness(processed),
        convergenceStatus: {
          converged: this.session.convergenceTracker.converged,
          lossChange: 0,
          accuracy: this.session.convergenceTracker.accuracy,
        },
      };
    }

    const newWeights = aggregateWithStaleness(accepted, this.currentWeights);

    const avgLoss = accepted.reduce((sum, u) => sum + u.update.metrics.loss, 0) / accepted.length;
    const avgAccuracy = accepted[0].update.metrics.accuracy
      ? accepted.reduce((sum, u) => sum + (u.update.metrics.accuracy || 0), 0) / accepted.length
      : undefined;

    this.session.currentVersion = {
      version: this.session.currentVersion.version + 1,
      timestamp: Date.now(),
      loss: avgLoss,
      accuracy: avgAccuracy,
      updateCount: this.session.currentVersion.updateCount + accepted.length,
    };

    this.session.convergenceTracker = updateConvergenceTracker(
      this.session.convergenceTracker,
      this.session.currentVersion.version,
      avgLoss,
      avgAccuracy
    );

    const convergenceResult = checkConvergence(this.session.convergenceTracker, this.config);

    if (convergenceResult.converged) {
      this.session.convergenceTracker.converged = true;
    }

    this.currentWeights = newWeights;
    this.session.lastUpdateTime = Date.now();
    this.session.updateHistory.push(...processed);

    const lossChange = convergenceResult.metrics.lossChange || 0;

    return {
      newVersion: this.session.currentVersion,
      aggregatedWeights: {
        data: this.currentWeights,
        shapes: this.weightShapes,
      },
      updates: processed,
      acceptedCount: accepted.length,
      rejectedCount: processed.length - accepted.length,
      averageStaleness: calculateAverageStaleness(processed),
      convergenceStatus: {
        converged: convergenceResult.converged,
        lossChange,
        accuracy: this.session.currentVersion.accuracy,
      },
    };
  }

  getCurrentVersion(): ModelVersion {
    return { ...this.session.currentVersion };
  }

  getCurrentWeights(): { data: Float32Array[]; shapes: number[][] } {
    return {
      data: this.currentWeights.map((w) => new Float32Array(w)),
      shapes: this.weightShapes,
    };
  }

  hasConverged(): boolean {
    return this.session.convergenceTracker.converged;
  }

  getStatistics(): AsyncFLStats {
    const participantStats = new Map<
      string,
      { updateCount: number; averageStaleness: number; acceptanceRate: number }
    >();

    for (const update of this.session.updateHistory) {
      const siteId = update.update.siteId;
      const existing = participantStats.get(siteId) || {
        updateCount: 0,
        averageStaleness: 0,
        acceptanceRate: 0,
      };

      existing.updateCount++;
      existing.averageStaleness += update.staleness;
      if (update.accepted) {
        existing.acceptanceRate++;
      }
      participantStats.set(siteId, existing);
    }

    for (const [, stats] of participantStats) {
      stats.averageStaleness /= stats.updateCount;
      stats.acceptanceRate /= stats.updateCount;
    }

    const acceptedCount = this.session.updateHistory.filter((u) => u.accepted).length;

    return {
      totalUpdates: this.session.updateHistory.length,
      acceptedUpdates: acceptedCount,
      rejectedUpdates: this.session.updateHistory.length - acceptedCount,
      averageStaleness: calculateAverageStaleness(this.session.updateHistory),
      currentVersion: this.session.currentVersion.version,
      convergenceStatus: {
        converged: this.session.convergenceTracker.converged,
        finalLoss: this.session.convergenceTracker.loss,
        finalAccuracy: this.session.convergenceTracker.accuracy,
      },
      participantStats,
    };
  }
}
