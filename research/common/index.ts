/**
 * Research Common Utilities
 *
 * Shared utilities for research modules in Harmonia federated causal inference.
 * These utilities are research-specific but shared across multiple research modules.
 *
 * Note: Patient type is re-exported from multiple modules but they share the same definition.
 * Use the Patient type from @harmonia/core/causal for consistency.
 */

// Data loading and management
export * from './data-loader';

// Federated aggregation strategies
export * from './aggregation-strategies';

// Experimental confounding injection
export {
  injectConfounding,
  generateConfoundingScenarios,
  printInjectionSummary,
  type ConfoundingParams,
  type InjectionResult,
} from './confounding-injector';

// Assumption violation injection
export {
  generateViolationScenarios,
  injectUnconfoundednessViolation,
  injectPositivityViolation,
  injectSpecificationViolation,
  injectCombinedViolations,
  injectViolation,
  printViolationSummary,
  type ViolationScenario,
  type ViolationResult,
} from './violation-injector';

// Causal report generation
export * from './causal-report-generator';
