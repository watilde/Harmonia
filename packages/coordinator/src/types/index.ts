/**
 * Type definitions for Harmonia coordinator
 */

import { GlobalModel } from '@harmonia/core';

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  repoPath: string; // Local path to git repository
  encryptionKey?: string; // Optional: hex string for decrypting updates
}

/**
 * Aggregation job configuration
 */
export interface AggregationJob {
  studyId: string;
  roundNumber: number;
  minParticipants: number;
  aggregationStrategy: 'weighted' | 'uniform';
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  success: boolean;
  globalModel: GlobalModel;
  participantCount: number;
  aggregationTime: number;
  errors?: string[];
}

/**
 * Client update with metadata
 */
export interface ClientUpdateWithMeta {
  siteId: string;
  roundNumber: number;
  weights: {
    data: Float32Array[];
    shapes: number[][];
  };
  sampleCount: number;
  metrics: Record<string, number>;
  timestamp: string;
}

/**
 * Study configuration
 */
export interface StudyConfig {
  studyId: string;
  studyName: string;
  totalRounds: number;
  minParticipants: number;
  maxParticipants?: number;
  [key: string]: unknown;
}

/**
 * Round status information
 */
export interface RoundStatus {
  complete: boolean;
  submittedSites: string[];
  totalSites: number;
}
