/**
 * ES Module Style Dependency Resolver
 * Resolves import/export relationships between models
 */

import type {
  HarmoniaConfig,
  ModelConfig,
  ModelImport,
  ModelExport,
} from '../types/harmonia-config';

/**
 * Convert legacy dependencies to ES Module imports
 */
export function normalizeDependencies(config: HarmoniaConfig): HarmoniaConfig {
  const normalized: HarmoniaConfig = { ...config, models: {} };

  for (const [modelId, modelConfig] of Object.entries(config.models)) {
    const normalizedModel = { ...modelConfig };

    // If using legacy dependencies, convert to imports/exports
    if (modelConfig.dependencies && Object.keys(modelConfig.dependencies).length > 0) {
      // Convert dependencies to imports
      if (!normalizedModel.imports) {
        normalizedModel.imports = {};
      }

      for (const [depId] of Object.entries(modelConfig.dependencies)) {
        normalizedModel.imports[depId] = {
          from: depId,
          export: 'default',
        };
      }

      // Mark dependencies as processed
      delete normalizedModel.dependencies;
      normalizedModel.dependencies = {};
    }

    // Ensure exports exist
    if (!normalizedModel.exports) {
      // Create default export based on output config
      normalizedModel.exports = {
        default: {
          name: modelConfig.output.type,
          type: 'tensor',
          shape: modelConfig.output.dimension ? [modelConfig.output.dimension] : undefined,
          dtype: 'float32',
          task: modelConfig.output.task,
        },
      };
    }

    // Keep dependencies field for backward compatibility (empty)
    if (!normalizedModel.dependencies) {
      normalizedModel.dependencies = {};
    }

    normalized.models[modelId] = normalizedModel;
  }

  return normalized;
}

/**
 * Get all imports for a model
 */
export function getModelImports(modelConfig: ModelConfig): Record<string, ModelImport> {
  return modelConfig.imports || {};
}

/**
 * Get all exports for a model
 */
export function getModelExports(modelConfig: ModelConfig): Record<string, ModelExport> {
  return modelConfig.exports || {};
}

/**
 * Validate import/export compatibility
 */
export function validateImportExportCompatibility(
  importingModel: string,
  importSpec: ModelImport,
  exportingModel: ModelConfig
): { valid: boolean; reason?: string } {
  const exports = getModelExports(exportingModel);
  const exportSpec = exports[importSpec.export];

  if (!exportSpec) {
    return {
      valid: false,
      reason: `Model ${importingModel} imports '${importSpec.export}' from '${importSpec.from}', but export not found`,
    };
  }

  // Additional type checking can be added here
  return { valid: true };
}

/**
 * Build import/export graph
 */
export interface ImportExportGraph {
  nodes: Map<string, ModelConfig>;
  edges: Array<{
    from: string; // Exporting model
    to: string; // Importing model
    export: string; // Export name
    importAs: string; // Import local name
  }>;
}

export function buildImportExportGraph(config: HarmoniaConfig): ImportExportGraph {
  const normalized = normalizeDependencies(config);
  const graph: ImportExportGraph = {
    nodes: new Map(),
    edges: [],
  };

  // Add nodes
  for (const [modelId, modelConfig] of Object.entries(normalized.models)) {
    graph.nodes.set(modelId, modelConfig);
  }

  // Add edges from imports
  for (const [modelId, modelConfig] of Object.entries(normalized.models)) {
    const imports = getModelImports(modelConfig);

    for (const [localName, importSpec] of Object.entries(imports)) {
      graph.edges.push({
        from: importSpec.from,
        to: modelId,
        export: importSpec.export,
        importAs: localName,
      });
    }
  }

  return graph;
}

/**
 * Validate all import/export relationships
 */
export function validateImportExports(config: HarmoniaConfig): {
  valid: boolean;
  errors: string[];
} {
  const normalized = normalizeDependencies(config);
  const errors: string[] = [];

  for (const [modelId, modelConfig] of Object.entries(normalized.models)) {
    const imports = getModelImports(modelConfig);

    for (const [, importSpec] of Object.entries(imports)) {
      // Check if exporting model exists
      const exportingModel = normalized.models[importSpec.from];
      if (!exportingModel) {
        errors.push(`Model '${modelId}' imports from non-existent model '${importSpec.from}'`);
        continue;
      }

      // Check export compatibility
      const validation = validateImportExportCompatibility(modelId, importSpec, exportingModel);

      if (!validation.valid) {
        errors.push(validation.reason || 'Unknown validation error');
      }
    }

    // Validate pipeline if it exists
    if (modelConfig.pipeline) {
      const pipelineErrors = validatePipeline(modelId, modelConfig, imports);
      errors.push(...pipelineErrors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate pipeline configuration
 */
function validatePipeline(
  modelId: string,
  modelConfig: ModelConfig,
  imports: Record<string, ModelImport>
): string[] {
  const errors: string[] = [];
  const pipeline = modelConfig.pipeline;

  if (!pipeline) return errors;

  // Check pipeline inputs match imports
  const importNames = Object.keys(imports);
  for (const inputName of pipeline.input) {
    if (!importNames.includes(inputName)) {
      errors.push(`Model '${modelId}' pipeline uses input '${inputName}' but it's not in imports`);
    }
  }

  // Validate stage connectivity
  const availableVariables = new Set<string>(pipeline.input);

  for (const stage of pipeline.stages) {
    // Check if inputs are available
    const stageInputs = stage.inputs || (stage.input ? [stage.input] : []);

    for (const input of stageInputs) {
      if (typeof input === 'string' && !availableVariables.has(input)) {
        errors.push(`Model '${modelId}' stage '${stage.name}' uses undefined variable '${input}'`);
      }
    }

    // Add output to available variables
    availableVariables.add(stage.output);
  }

  return errors;
}

/**
 * Get execution order respecting imports
 */
export function getExecutionOrder(config: HarmoniaConfig): string[] {
  const normalized = normalizeDependencies(config);
  const models = Object.entries(normalized.models);
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(modelId: string) {
    if (visited.has(modelId)) return;

    const modelConfig = normalized.models[modelId];
    const imports = getModelImports(modelConfig);

    // Visit dependencies first
    for (const importSpec of Object.values(imports)) {
      visit(importSpec.from);
    }

    visited.add(modelId);
    order.push(modelId);
  }

  for (const [modelId] of models) {
    visit(modelId);
  }

  return order;
}
