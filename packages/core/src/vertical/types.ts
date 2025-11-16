/**
 * Vertical Federated Learning Types
 *
 * Supports split learning architecture where:
 * - Multiple participants have different features for the same samples
 * - Each participant trains a "bottom model" for feature extraction
 * - A coordinator trains a "top model" for final prediction
 * - Intermediate representations (embeddings) are exchanged
 */

/**
 * OMOP CDM domain types for vertical partitioning
 */
export type OMOPDomain =
  | 'Condition'
  | 'Procedure'
  | 'Measurement'
  | 'Observation'
  | 'Drug'
  | 'Device'
  | 'Visit';

/**
 * Participant role in vertical federated learning
 * - host: Has labels (outcomes), coordinates training
 * - guest: Has features only, no labels
 */
export type VFLRole = 'host' | 'guest';

/**
 * Model configuration for bottom/top models
 */
export interface ModelConfig {
  inputDim: number; // Input feature dimension
  outputDim: number; // Output dimension (embedding dim for bottom, classes for top)
  hiddenLayers: number[]; // Hidden layer sizes
  activation: 'relu' | 'sigmoid' | 'tanh';
  dropout?: number;
}

/**
 * VFL participant configuration
 */
export interface VFLParticipant {
  siteId: string;
  role: VFLRole;
  featureDomains: OMOPDomain[]; // OMOP domains this participant has
  bottomModelConfig: ModelConfig;
  hasLabels: boolean; // Only host should have labels
}

/**
 * Privacy configuration for VFL
 */
export interface VFLPrivacyConfig {
  embeddingDP: {
    enabled: boolean;
    epsilon: number; // Privacy budget for embeddings
    delta: number;
    clipNorm: number; // Clip embedding L2 norm
  };
  gradientDP: {
    enabled: boolean;
    epsilon: number; // Privacy budget for gradients
    delta: number;
    clipNorm: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm';
  };
}

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  topModelConfig: ModelConfig;
  optimizer: {
    type: 'sgd' | 'adam';
    learningRate: number;
    momentum?: number;
  };
  batchSize: number;
  aggregationStrategy: 'concat' | 'sum' | 'attention';
}

/**
 * Overall VFL configuration
 */
export interface VFLConfig {
  studyId: string;
  participants: VFLParticipant[];
  coordinator: CoordinatorConfig;
  privacy: VFLPrivacyConfig;
  rounds: number;
  embeddingDim: number; // Expected embedding dimension from each participant
}

/**
 * Embedding update from a participant
 */
export interface EmbeddingUpdate {
  siteId: string;
  roundNumber: number;
  embeddings: {
    data: Float32Array; // Shape: [batchSize, embeddingDim]
    shape: [number, number]; // [batchSize, embeddingDim]
  };
  sampleCount: number;
  timestamp: number;
  encrypted: boolean;
  privacyStats?: {
    noiseMagnitude: number;
    clippedNorm: number;
  };
}

/**
 * Gradient update for a participant
 */
export interface GradientUpdate {
  siteId: string;
  roundNumber: number;
  gradients: {
    data: Float32Array; // Gradients w.r.t embeddings
    shape: [number, number]; // [batchSize, embeddingDim]
  };
  timestamp: number;
  encrypted: boolean;
  privacyStats?: {
    noiseMagnitude: number;
    clippedNorm: number;
  };
}

/**
 * Aggregated embeddings from all participants
 */
export interface AggregatedEmbeddings {
  roundNumber: number;
  embeddings: {
    data: Float32Array; // Concatenated or aggregated embeddings
    shape: [number, number]; // [batchSize, totalEmbeddingDim]
  };
  participantIds: string[];
  aggregationMethod: 'concat' | 'sum' | 'attention';
}

/**
 * Training loss and metrics
 */
export interface TrainingResult {
  loss: number;
  accuracy?: number;
  auc?: number;
  gradients: Map<string, GradientUpdate>; // Gradients for each participant
}

/**
 * VFL round summary
 */
export interface VFLRoundSummary {
  roundNumber: number;
  loss: number;
  accuracy?: number;
  participantCount: number;
  embeddingsReceived: number;
  gradientsDistributed: number;
  privacyBudgetUsed: {
    epsilon: number;
    delta: number;
  };
  timestamp: number;
}

/**
 * Final VFL training result
 */
export interface VFLTrainingResult {
  studyId: string;
  rounds: VFLRoundSummary[];
  finalLoss: number;
  finalAccuracy?: number;
  totalPrivacyBudget: {
    epsilon: number;
    delta: number;
  };
  participantContributions: Map<string, number>; // Contribution score per participant
  topModelWeights: {
    data: Float32Array[];
    shapes: number[][];
  };
}
