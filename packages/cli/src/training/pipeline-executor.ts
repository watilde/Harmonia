/**
 * Pipeline Execution Engine
 * Executes pipeline stages to transform and combine model inputs
 */

import type { ModelPipeline, PipelineStage } from '../types/harmonia-config';

export type PipelineData = Map<string, Float32Array | number | Record<string, unknown>>;

export interface PipelineExecutionResult {
  success: boolean;
  outputs: PipelineData;
  errors: string[];
}

/**
 * Executes pipeline stages
 */
export class PipelineExecutor {
  /**
   * Execute a complete pipeline
   */
  executePipeline(pipeline: ModelPipeline, inputs: PipelineData): PipelineExecutionResult {
    const errors: string[] = [];
    const outputs = new Map(inputs); // Start with input data

    // Validate that all required inputs are present
    for (const inputName of pipeline.input) {
      if (!inputs.has(inputName)) {
        errors.push(`Missing required pipeline input: ${inputName}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, outputs, errors };
    }

    // Execute stages in order
    for (const stage of pipeline.stages) {
      try {
        const result = this.executeStage(stage, outputs);
        outputs.set(stage.output, result);
      } catch (error) {
        errors.push(
          `Error executing stage '${stage.name}' (${stage.type}): ${(error as Error).message}`
        );
        return { success: false, outputs, errors };
      }
    }

    return { success: true, outputs, errors: [] };
  }

  /**
   * Execute a single pipeline stage
   */
  private executeStage(
    stage: PipelineStage,
    data: PipelineData
  ): Float32Array | number | Record<string, unknown> {
    switch (stage.type) {
      case 'concat':
        return this.executeConcat(stage, data);
      case 'dense':
        return this.executeDense(stage, data);
      case 'dropout':
        return this.executeDropout(stage, data);
      case 'batch-norm':
        return this.executeBatchNorm(stage, data);
      case 'activation':
        return this.executeActivation(stage, data);
      case 'reshape':
        return this.executeReshape(stage, data);
      case 'custom':
        return this.executeCustom(stage, data);
      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }
  }

  /**
   * Concatenate multiple tensors
   */
  private executeConcat(stage: PipelineStage, data: PipelineData): Float32Array {
    const inputs = stage.inputs || [];
    if (inputs.length === 0) {
      throw new Error('Concat stage requires at least one input');
    }

    const arrays: Float32Array[] = [];
    let totalLength = 0;

    for (const inputName of inputs) {
      const input = data.get(inputName);
      if (!input) {
        throw new Error(`Missing input '${inputName}' for concat stage`);
      }

      if (!(input instanceof Float32Array)) {
        throw new Error(`Input '${inputName}' must be Float32Array for concat`);
      }

      arrays.push(input);
      totalLength += input.length;
    }

    // Concatenate arrays
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }

    return result;
  }

  /**
   * Dense (fully connected) layer with Xavier initialization
   * y = W * x + b
   * where W is weight matrix, b is bias vector
   */
  private executeDense(stage: PipelineStage, data: PipelineData): Float32Array {
    const inputName = Array.isArray(stage.input) ? stage.input[0] : stage.input;
    if (!inputName) {
      throw new Error('Dense stage requires an input');
    }

    const input = data.get(inputName);
    if (!input || !(input instanceof Float32Array)) {
      throw new Error(`Dense stage requires Float32Array input '${inputName}'`);
    }

    const units = stage.units || 64;
    const inputSize = input.length;

    // Xavier/Glorot initialization for weights: uniform(-√(6/(nin+nout)), √(6/(nin+nout)))
    const limit = Math.sqrt(6.0 / (inputSize + units));

    // Initialize weight matrix (units x inputSize)
    const weights: number[][] = [];
    for (let i = 0; i < units; i++) {
      weights[i] = [];
      for (let j = 0; j < inputSize; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * limit;
      }
    }

    // Initialize bias vector (zeros)
    const bias = new Array(units).fill(0);

    // Compute y = W * x + b
    const output = new Float32Array(units);
    for (let i = 0; i < units; i++) {
      let sum = bias[i];
      for (let j = 0; j < inputSize; j++) {
        sum += weights[i][j] * input[j];
      }
      output[i] = sum;
    }

    return output;
  }

  /**
   * Dropout - randomly zero out neurons during training
   * During inference (mode='inference'), pass through unchanged
   * During training (mode='training'), apply dropout with probability p
   */
  private executeDropout(stage: PipelineStage, data: PipelineData): Float32Array {
    const inputName = Array.isArray(stage.input) ? stage.input[0] : stage.input;
    if (!inputName) {
      throw new Error('Dropout stage requires an input');
    }

    const input = data.get(inputName);
    if (!input || !(input instanceof Float32Array)) {
      throw new Error(`Dropout stage requires Float32Array input '${inputName}'`);
    }

    const rate = stage.rate || 0.5; // Dropout probability
    const mode = (stage as any).mode || 'inference'; // 'training' or 'inference'

    if (mode === 'inference') {
      // During inference, pass through unchanged
      return new Float32Array(input);
    }

    // During training, apply dropout
    const output = new Float32Array(input.length);
    const scale = 1.0 / (1.0 - rate); // Scale to maintain expected value

    for (let i = 0; i < input.length; i++) {
      if (Math.random() > rate) {
        output[i] = input[i] * scale; // Keep and scale
      } else {
        output[i] = 0; // Drop
      }
    }

    return output;
  }

  /**
   * Batch normalization - normalize input to have mean=0, variance=1
   * y = γ * (x - μ) / √(σ² + ε) + β
   * where γ (gamma) and β (beta) are learned parameters
   */
  private executeBatchNorm(stage: PipelineStage, data: PipelineData): Float32Array {
    const inputName = Array.isArray(stage.input) ? stage.input[0] : stage.input;
    if (!inputName) {
      throw new Error('Batch norm stage requires an input');
    }

    const input = data.get(inputName);
    if (!input || !(input instanceof Float32Array)) {
      throw new Error(`Batch norm stage requires Float32Array input '${inputName}'`);
    }

    const epsilon = 1e-5; // Small constant for numerical stability

    // Calculate mean
    let mean = 0;
    for (let i = 0; i < input.length; i++) {
      mean += input[i];
    }
    mean /= input.length;

    // Calculate variance
    let variance = 0;
    for (let i = 0; i < input.length; i++) {
      const diff = input[i] - mean;
      variance += diff * diff;
    }
    variance /= input.length;

    // Normalize
    const std = Math.sqrt(variance + epsilon);
    const output = new Float32Array(input.length);

    // Learned parameters (initialized to identity transform)
    const gamma = 1.0; // Scale parameter
    const beta = 0.0; // Shift parameter

    for (let i = 0; i < input.length; i++) {
      output[i] = gamma * ((input[i] - mean) / std) + beta;
    }

    return output;
  }

  /**
   * Activation function
   */
  private executeActivation(stage: PipelineStage, data: PipelineData): Float32Array {
    const inputName = Array.isArray(stage.input) ? stage.input[0] : stage.input;
    if (!inputName) {
      throw new Error('Activation stage requires an input');
    }

    const input = data.get(inputName);
    if (!input || !(input instanceof Float32Array)) {
      throw new Error(`Activation stage requires Float32Array input '${inputName}'`);
    }

    const activation = stage.activation || 'relu';
    const output = new Float32Array(input.length);

    switch (activation) {
      case 'relu':
        for (let i = 0; i < input.length; i++) {
          output[i] = Math.max(0, input[i]);
        }
        break;
      case 'sigmoid':
        for (let i = 0; i < input.length; i++) {
          output[i] = 1 / (1 + Math.exp(-input[i]));
        }
        break;
      case 'tanh':
        for (let i = 0; i < input.length; i++) {
          output[i] = Math.tanh(input[i]);
        }
        break;
      case 'softmax': {
        // Simple softmax implementation
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
          output[i] = Math.exp(input[i]);
          sum += output[i];
        }
        for (let i = 0; i < output.length; i++) {
          output[i] /= sum;
        }
        break;
      }
      default:
        throw new Error(`Unknown activation function: ${activation}`);
    }

    return output;
  }

  /**
   * Reshape - change tensor shape (data remains unchanged, only view changes)
   * For 1D Float32Array, this is mainly a validation step
   */
  private executeReshape(stage: PipelineStage, data: PipelineData): Float32Array {
    const inputName = Array.isArray(stage.input) ? stage.input[0] : stage.input;
    if (!inputName) {
      throw new Error('Reshape stage requires an input');
    }

    const input = data.get(inputName);
    if (!input || !(input instanceof Float32Array)) {
      throw new Error(`Reshape stage requires Float32Array input '${inputName}'`);
    }

    // Get target shape from stage parameters
    const targetShape = (stage as any).shape;
    if (!targetShape || !Array.isArray(targetShape)) {
      // No target shape specified, pass through
      return new Float32Array(input);
    }

    // Calculate total elements in target shape
    let targetSize = 1;
    for (const dim of targetShape) {
      if (dim === -1) {
        // -1 means infer this dimension
        continue;
      }
      targetSize *= dim;
    }

    // Validate that reshape is possible
    if (targetSize > 0 && targetSize !== input.length) {
      throw new Error(
        `Cannot reshape array of size ${input.length} to shape [${targetShape.join(', ')}] with ${targetSize} elements`
      );
    }

    // For 1D arrays, just return a copy (shape metadata would be tracked separately in a real implementation)
    return new Float32Array(input);
  }

  /**
   * Custom stage - placeholder
   */
  private executeCustom(
    stage: PipelineStage,
    data: PipelineData
  ): Float32Array | number | Record<string, unknown> {
    const inputName = Array.isArray(stage.input) ? stage.input[0] : stage.input;
    if (!inputName) {
      throw new Error('Custom stage requires an input');
    }

    const input = data.get(inputName);
    if (!input) {
      throw new Error(`Custom stage requires input '${inputName}'`);
    }

    // Placeholder: Return input unchanged
    // In real implementation, would execute custom logic
    return input;
  }
}
