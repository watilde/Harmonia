/**
 * Model Dependency Resolution
 * npm/package.json style dependency resolver for federated learning models
 */

import type {
  HarmoniaConfig,
  ModelLayer,
  TrainingPlan,
  ValidationResult,
} from '../types/harmonia-config';

/**
 * Get dependencies from model config (supports both legacy and ES Module style)
 */
function getModelDependenciesFromConfig(modelConfig: any): string[] {
  // ES Module style imports
  if (modelConfig.imports) {
    return Object.values(modelConfig.imports).map((imp: any) => imp.from);
  }

  // Legacy dependencies
  if (modelConfig.dependencies) {
    return Object.keys(modelConfig.dependencies);
  }

  return [];
}

/**
 * Resolve model dependencies using topological sort (Kahn's algorithm)
 * Similar to npm dependency resolution
 * Supports both legacy dependencies and ES Module imports
 */
export function resolveModelDependencies(config: HarmoniaConfig): ModelLayer[] {
  const models = Object.entries(config.models);

  // Build dependency graph (not currently used but kept for future enhancements)
  const graph = new Map<string, string[]>();

  for (const [modelId, modelConfig] of models) {
    const deps = getModelDependenciesFromConfig(modelConfig);

    // Add reverse edges for topological sort
    for (const depId of deps) {
      if (!graph.has(depId)) {
        graph.set(depId, []);
      }
      graph.get(depId)!.push(modelId);
    }
  }

  // Topological sort by layers
  const layers: ModelLayer[] = [];
  const processed = new Set<string>();
  let currentLayer = 0;

  while (processed.size < models.length) {
    // Find models with no remaining dependencies
    const readyModels = models
      .filter(([id]) => !processed.has(id))
      .filter(([, modelConfig]) => {
        const deps = getModelDependenciesFromConfig(modelConfig);
        return deps.every((dep) => processed.has(dep));
      })
      .map(([id]) => id);

    if (readyModels.length === 0) {
      // No models ready but not all processed = circular dependency
      const remaining = models
        .filter(([modelId]) => !processed.has(modelId))
        .map(([modelId]) => modelId);
      throw new Error(`Circular dependency detected among models: ${remaining.join(', ')}`);
    }

    layers.push({
      layer: currentLayer,
      models: readyModels,
      parallelizable: true, // Models in same layer can be trained in parallel
    });

    readyModels.forEach((modelId) => processed.add(modelId));
    currentLayer++;
  }

  return layers;
}

/**
 * Validate Harmonia configuration
 */
export function validateHarmoniaConfig(config: HarmoniaConfig): ValidationResult {
  const warnings: string[] = [];

  // Check basic fields
  if (!config.name || config.name.trim() === '') {
    return { valid: false, reason: 'Study name is required' };
  }

  if (!config.models || Object.keys(config.models).length === 0) {
    return { valid: false, reason: 'At least one model must be defined' };
  }

  const modelIds = Object.keys(config.models);

  // Validate each model
  for (const [modelId, modelConfig] of Object.entries(config.models)) {
    // Check model name
    if (!modelConfig.name || modelConfig.name.trim() === '') {
      return { valid: false, reason: `Model ${modelId} must have a name` };
    }

    // Check dependencies exist (support both legacy and ES Module style)
    const deps = getModelDependenciesFromConfig(modelConfig);

    for (const depId of deps) {
      if (!modelIds.includes(depId)) {
        return {
          valid: false,
          reason: `Model ${modelId} depends on non-existent model ${depId}`,
        };
      }
    }

    // Check for self-dependency
    if (deps.includes(modelId)) {
      return {
        valid: false,
        reason: `Model ${modelId} cannot depend on itself`,
      };
    }

    // Validate federation config
    if (!modelConfig.federation || !modelConfig.federation.algorithm) {
      return {
        valid: false,
        reason: `Model ${modelId} must specify a federation algorithm`,
      };
    }

    // Validate concatenated input sources (backward compatibility)
    if (modelConfig.input.type === 'concatenated') {
      if (!modelConfig.input.sources || modelConfig.input.sources.length === 0) {
        return {
          valid: false,
          reason: `Model ${modelId} with concatenated input must specify sources`,
        };
      }

      // Check sources match dependencies
      const deps = getModelDependenciesFromConfig(modelConfig);
      const sources = modelConfig.input.sources;

      for (const source of sources) {
        if (!deps.includes(source)) {
          return {
            valid: false,
            reason: `Model ${modelId} input source ${source} is not in dependencies`,
          };
        }
      }
    }
  }

  // Check for circular dependencies
  try {
    resolveModelDependencies(config);
  } catch (error) {
    return { valid: false, reason: (error as Error).message };
  }

  // Check privacy config if specified
  if (config.privacy) {
    if (config.privacy.mechanism === 'differential-privacy') {
      if (config.privacy.epsilon === undefined || config.privacy.epsilon <= 0) {
        warnings.push('Differential privacy epsilon should be positive');
      }
      if (config.privacy.delta === undefined || config.privacy.delta <= 0) {
        warnings.push('Differential privacy delta should be positive');
      }
    }
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Generate training plan from dependency resolution
 */
export function generateTrainingPlan(config: HarmoniaConfig): TrainingPlan {
  const layers = resolveModelDependencies(config);
  const totalRounds = config.training.totalRounds;

  return {
    totalLayers: layers.length,
    layers: layers.map((layer) => ({
      layer: layer.layer + 1, // 1-indexed for user display
      models: layer.models,
      parallelizable: layer.parallelizable,
      roundsPerModel: Math.floor(totalRounds / layers.length),
    })),
  };
}

/**
 * Get model execution order
 * Returns array of model IDs in execution order
 */
export function getModelExecutionOrder(config: HarmoniaConfig): string[] {
  const layers = resolveModelDependencies(config);
  return layers.flatMap((layer) => layer.models);
}

/**
 * Get models by layer
 */
export function getModelsByLayer(config: HarmoniaConfig): Map<number, string[]> {
  const layers = resolveModelDependencies(config);
  const result = new Map<number, string[]>();

  for (const layer of layers) {
    result.set(layer.layer + 1, layer.models); // 1-indexed
  }

  return result;
}

/**
 * Check if a model can be trained (all dependencies satisfied)
 */
export function canTrainModel(
  modelId: string,
  config: HarmoniaConfig,
  trainedModels: Set<string>
): boolean {
  const modelConfig = config.models[modelId];
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found in configuration`);
  }

  const dependencies = getModelDependenciesFromConfig(modelConfig);
  return dependencies.every((dep) => trainedModels.has(dep));
}

/**
 * Get direct dependencies of a model
 */
export function getModelDependencies(modelId: string, config: HarmoniaConfig): string[] {
  const modelConfig = config.models[modelId];
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found in configuration`);
  }

  return getModelDependenciesFromConfig(modelConfig);
}

/**
 * Get all models that depend on a given model
 */
export function getModelDependents(modelId: string, config: HarmoniaConfig): string[] {
  const dependents: string[] = [];

  for (const [id, modelConfig] of Object.entries(config.models)) {
    const deps = getModelDependenciesFromConfig(modelConfig);
    if (deps.includes(modelId)) {
      dependents.push(id);
    }
  }

  return dependents;
}
