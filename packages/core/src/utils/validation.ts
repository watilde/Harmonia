/**
 * Validation utilities
 */

import { ClientUpdate, FedAvgConfig, GlobalModel } from '../types';

/**
 * Validate client update
 */
export function validateClientUpdate(update: ClientUpdate): void {
  if (!update.siteId || update.siteId.trim() === '') {
    throw new Error('Invalid siteId: must be non-empty string');
  }

  if (!update.weights || !Array.isArray(update.weights.shapes)) {
    throw new Error('Invalid weights: must contain shapes array');
  }

  if (!Array.isArray(update.weights.data)) {
    throw new Error('Invalid weights: must contain data array');
  }

  if (update.weights.shapes.length !== update.weights.data.length) {
    throw new Error('Invalid weights: shapes and data arrays must have same length');
  }

  if (update.sampleCount <= 0) {
    throw new Error('Invalid sampleCount: must be positive');
  }

  if (update.roundNumber < 0) {
    throw new Error('Invalid roundNumber: must be non-negative');
  }
}

/**
 * Validate FedAvg configuration
 */
export function validateFedAvgConfig(config: FedAvgConfig): void {
  if (config.totalRounds <= 0) {
    throw new Error('Invalid totalRounds: must be positive');
  }

  if (config.minParticipants <= 0) {
    throw new Error('Invalid minParticipants: must be positive');
  }

  if (!['weighted', 'uniform'].includes(config.aggregationStrategy)) {
    throw new Error('Invalid aggregationStrategy: must be "weighted" or "uniform"');
  }
}

/**
 * Validate global model
 */
export function validateGlobalModel(model: GlobalModel): void {
  if (!model.weights || !Array.isArray(model.weights.shapes)) {
    throw new Error('Invalid model weights');
  }

  if (!model.round || typeof model.round.roundNumber !== 'number') {
    throw new Error('Invalid round information');
  }

  if (model.round.roundNumber < 0 || model.round.roundNumber > model.round.totalRounds) {
    throw new Error(
      `Invalid round number: ${model.round.roundNumber} (total: ${model.round.totalRounds})`
    );
  }

  if (model.aggregatedSamples < 0) {
    throw new Error('Invalid aggregatedSamples: must be non-negative');
  }
}

/**
 * Check if all client updates are from the same round
 */
export function validateRoundConsistency(updates: ClientUpdate[]): void {
  if (updates.length === 0) return;

  const roundNumber = updates[0].roundNumber;
  const inconsistent = updates.some((u) => u.roundNumber !== roundNumber);

  if (inconsistent) {
    throw new Error('Client updates must all be from the same round');
  }
}
