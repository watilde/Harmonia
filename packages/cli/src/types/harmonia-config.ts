/**
 * Harmonia Configuration Schema
 * npm/package.json style declarative configuration for federated learning studies
 */

export type FLArchitectureType = 'horizontal' | 'vertical' | 'transfer' | 'hierarchical';

export type ModelType =
  | 'logistic-regression'
  | 'neural-network'
  | 'lstm'
  | 'transformer'
  | 'cnn'
  | 'custom';

export type TaskType =
  | 'binary-classification'
  | 'multi-class-classification'
  | 'regression'
  | 'embedding-generation';

export type OutputType = 'embedding' | 'prediction' | 'logits';

/**
 * Tensor data type
 */
export type TensorDType = 'float32' | 'float64' | 'int32' | 'int64' | 'bool';

/**
 * Model export (ES Module style)
 */
export interface ModelExport {
  name: string;
  type: 'tensor' | 'scalar' | 'object';
  shape?: number[]; // Tensor shape
  dtype?: TensorDType;
  description?: string;
  task?: TaskType; // For prediction outputs
}

/**
 * Model import (ES Module style)
 */
export interface ModelImport {
  from: string; // Model ID
  export: string; // Export name ('default' or named export)
  alias?: string; // Optional alias
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  name: string;
  type: 'concat' | 'dense' | 'dropout' | 'batch-norm' | 'activation' | 'reshape' | 'custom';
  input?: string | string[]; // Input variable name(s)
  inputs?: string[]; // Alternative for multiple inputs
  output: string; // Output variable name
  // Stage-specific parameters
  axis?: number; // For concat
  units?: number; // For dense
  rate?: number; // For dropout
  activation?: string; // For dense/activation
  [key: string]: unknown;
}

/**
 * Model pipeline configuration
 */
export interface ModelPipeline {
  input: string[]; // Input variable names from imports
  stages: PipelineStage[];
}

/**
 * Main Harmonia configuration
 * Similar to package.json structure
 */
export interface HarmoniaConfig {
  $schema?: string;
  name: string;
  version: string;
  description: string;

  study: StudyMetadata;
  models: Record<string, ModelConfig>;
  privacy?: PrivacyConfig;
  training: TrainingConfig;
}

/**
 * Study metadata
 */
export interface StudyMetadata {
  coordinator: {
    name: string;
    email: string;
    organization: string;
  };
  ethics?: {
    approval: string;
    institution: string;
    date: string;
  };
}

/**
 * Model configuration (npm dependency style + ES Module exports/imports)
 */
export interface ModelConfig {
  name: string;
  description?: string;
  type: ModelType;

  /**
   * DEPRECATED: Model dependencies (backward compatibility)
   * Use 'imports' for ES Module style
   * Key: model ID, Value: output type needed
   * Empty object {} means no dependencies (layer 1 model)
   */
  dependencies?: Record<string, OutputType>;

  /**
   * ES Module style imports
   * Key: local name, Value: import specification
   */
  imports?: Record<string, ModelImport>;

  /**
   * ES Module style exports
   * Key: export name, Value: export specification
   * Use 'default' for default export
   */
  exports?: Record<string, ModelExport>;

  /**
   * Pipeline configuration (for models with imports)
   */
  pipeline?: ModelPipeline;

  federation: {
    architecture: FLArchitectureType;
    algorithm: string;
    config: Record<string, unknown>;
  };

  input: {
    type: 'time-series' | 'tabular' | 'image' | 'text' | 'concatenated' | 'pipeline';
    features?: string[];
    sources?: string[]; // For concatenated inputs (backward compatibility)
    windowSize?: number;
    [key: string]: unknown;
  };

  output: {
    type: OutputType;
    dimension?: number; // For embeddings
    task?: TaskType;
    classes?: string[]; // For classification
    [key: string]: unknown;
  };

  training: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    [key: string]: unknown;
  };
}

/**
 * Privacy configuration
 */
export interface PrivacyConfig {
  mechanism: 'differential-privacy' | 'secure-aggregation' | 'homomorphic-encryption';
  epsilon?: number;
  delta?: number;
  clipNorm?: number;
  [key: string]: unknown;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  totalRounds: number;
  strategy: 'sequential-by-layer' | 'parallel' | 'custom';
  earlyStoppingPatience?: number;
  validationSplit?: number;
  [key: string]: unknown;
}

/**
 * Resolved model layer information
 */
export interface ModelLayer {
  layer: number;
  models: string[]; // Model IDs
  parallelizable: boolean;
}

/**
 * Training plan generated from dependency resolution
 */
export interface TrainingPlan {
  totalLayers: number;
  layers: Array<{
    layer: number;
    models: string[];
    parallelizable: boolean;
    roundsPerModel: number;
  }>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
}
