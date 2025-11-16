/**
 * Federated Learning Algorithm Definitions
 * Organized by architecture type (Horizontal/Vertical/Transfer)
 */

export type FLArchitectureType = 'horizontal' | 'vertical' | 'transfer';

export interface AlgorithmDefinition {
  id: string;
  name: string;
  description: string;
  architectureType: FLArchitectureType;
  category: 'basic' | 'advanced' | 'privacy' | 'personalization';
  requiresPrivacy?: boolean;
  requiresPublicDataset?: boolean; // For transfer learning
  compatibleWith?: string[]; // Compatible algorithm IDs for combination
  paperReference?: string;
  defaultConfig?: Record<string, unknown>;
}

/**
 * Horizontal FL Algorithms (11 algorithms)
 * Sites have same features, different samples
 */
export const HORIZONTAL_ALGORITHMS: AlgorithmDefinition[] = [
  // Basic algorithms
  {
    id: 'fedavg',
    name: 'FedAvg',
    description: 'Federated Averaging - Baseline algorithm with weighted model averaging',
    architectureType: 'horizontal',
    category: 'basic',
    paperReference: 'McMahan et al. (2017)',
    defaultConfig: {
      aggregationStrategy: 'weighted',
      minParticipants: 2,
    },
  },
  {
    id: 'fedprox',
    name: 'FedProx',
    description: 'Handles heterogeneous systems with proximal term regularization',
    architectureType: 'horizontal',
    category: 'basic',
    paperReference: 'Li et al. (MLSys 2020)',
    defaultConfig: {
      mu: 0.01, // Proximal term coefficient
    },
  },
  {
    id: 'scaffold',
    name: 'SCAFFOLD',
    description: 'Control variates for reducing client drift in non-IID data',
    architectureType: 'horizontal',
    category: 'basic',
    paperReference: 'Karimireddy et al. (ICML 2020)',
    defaultConfig: {
      learningRate: 0.01,
    },
  },
  {
    id: 'fednova',
    name: 'FedNova',
    description: 'Normalized averaging for heterogeneous local training steps',
    architectureType: 'horizontal',
    category: 'basic',
    paperReference: 'Wang et al. (NeurIPS 2020)',
    defaultConfig: {
      normalizeWeights: true,
    },
  },
  {
    id: 'feddyn',
    name: 'FedDyn',
    description: 'Dynamic regularization for faster convergence on non-IID data',
    architectureType: 'horizontal',
    category: 'basic',
    paperReference: 'Acar et al. (ICLR 2021)',
    defaultConfig: {
      alpha: 0.1, // Dynamic regularizer coefficient
    },
  },

  // Advanced algorithms
  {
    id: 'moon',
    name: 'MOON',
    description: 'Model-contrastive learning - Best for healthcare non-IID data',
    architectureType: 'horizontal',
    category: 'advanced',
    paperReference: 'Li et al. (CVPR 2021)',
    defaultConfig: {
      temperature: 0.5,
      mu: 5.0,
    },
  },
  {
    id: 'fedma',
    name: 'FedMA',
    description: 'Layer-wise Bayesian matching for heterogeneous model architectures',
    architectureType: 'horizontal',
    category: 'advanced',
    paperReference: 'Wang et al. (ICLR 2020)',
    defaultConfig: {
      matchingIterations: 100,
    },
  },
  {
    id: 'fedyogi',
    name: 'FedYogi',
    description: 'Adaptive server-side optimization with momentum',
    architectureType: 'horizontal',
    category: 'advanced',
    paperReference: 'Reddi et al. (2020)',
    defaultConfig: {
      beta1: 0.9,
      beta2: 0.99,
      tau: 0.001,
    },
  },

  // Personalization
  {
    id: 'fedproc',
    name: 'FedProc',
    description: 'Personalized federated learning with site-specific model heads',
    architectureType: 'horizontal',
    category: 'personalization',
    defaultConfig: {
      personalizedLayers: 2,
    },
  },
  {
    id: 'fedub',
    name: 'FedUB',
    description: 'Uncertainty-based weighting for handling noisy/low-quality data',
    architectureType: 'horizontal',
    category: 'personalization',
    defaultConfig: {
      uncertaintyThreshold: 0.5,
    },
  },

  // Privacy
  {
    id: 'dp-fedavg',
    name: 'DP-FedAvg',
    description: 'Differential Privacy FL - REQUIRED for patient data (HIPAA)',
    architectureType: 'horizontal',
    category: 'privacy',
    requiresPrivacy: true,
    paperReference: 'McMahan et al. (2018)',
    defaultConfig: {
      epsilon: 5.0,
      delta: 1e-5,
      clipNorm: 1.0,
    },
  },
];

/**
 * Vertical FL Algorithms (4 algorithms)
 * Sites have different features, same samples
 */
export const VERTICAL_ALGORITHMS: AlgorithmDefinition[] = [
  {
    id: 'split-learning',
    name: 'Split Learning',
    description: 'Forward/backward pass splitting across feature holders',
    architectureType: 'vertical',
    category: 'basic',
    paperReference: 'Gupta & Raskar (2018)',
    defaultConfig: {
      cutLayer: 3,
      embeddingDim: 128,
    },
  },
  {
    id: 'split-nn',
    name: 'Split-NN',
    description: 'Neural network variant of split learning with optimized communication',
    architectureType: 'vertical',
    category: 'basic',
    defaultConfig: {
      embeddingDim: 128,
      compressionRatio: 0.5,
    },
  },
  {
    id: 'vfl-fedavg',
    name: 'VFL-FedAvg',
    description: 'Quality-weighted embedding aggregation with variance metrics',
    architectureType: 'vertical',
    category: 'advanced',
    defaultConfig: {
      aggregationStrategy: 'quality-weighted',
      qualityMetric: 'variance',
    },
  },
  {
    id: 'vertical-secagg',
    name: 'Vertical SecAgg',
    description: 'Secure aggregation with pairwise masking for embedding privacy',
    architectureType: 'vertical',
    category: 'privacy',
    requiresPrivacy: true,
    defaultConfig: {
      threshold: 2,
      dropoutTolerance: 0.2,
    },
  },
];

/**
 * Transfer FL Algorithms (2 algorithms)
 * Cross-domain knowledge transfer
 */
export const TRANSFER_ALGORITHMS: AlgorithmDefinition[] = [
  {
    id: 'fedmd',
    name: 'FedMD',
    description: 'Model distillation across heterogeneous domains using public dataset',
    architectureType: 'transfer',
    category: 'basic',
    requiresPublicDataset: true,
    paperReference: 'Li & Wang (2019)',
    defaultConfig: {
      distillationTemperature: 3.0,
      consensusThreshold: 0.6,
      publicDatasetSize: 1000,
    },
  },
  {
    id: 'fmtl',
    name: 'FMTL',
    description: 'Multi-task learning with task relationship matrix and shared layers',
    architectureType: 'transfer',
    category: 'advanced',
    paperReference: 'Smith et al. (2017)',
    defaultConfig: {
      sharedLayerDepth: 3,
      taskSpecificLayers: 2,
      regularizationStrength: 0.1,
    },
  },
];

/**
 * Privacy/Security algorithms applicable across architectures
 */
export const PRIVACY_ALGORITHMS: AlgorithmDefinition[] = [
  {
    id: 'secagg',
    name: 'SecAgg',
    description: 'Secure multi-party aggregation with cryptographic privacy',
    architectureType: 'horizontal', // Primary architecture
    category: 'privacy',
    requiresPrivacy: true,
    paperReference: 'Bonawitz et al. (CCS 2017)',
    compatibleWith: ['fedavg', 'fedprox', 'scaffold'],
    defaultConfig: {
      threshold: 3,
      dropoutResilience: true,
    },
  },
  {
    id: 'he-fl',
    name: 'HE-FL',
    description: 'Homomorphic encryption for maximum privacy protection',
    architectureType: 'horizontal', // Primary architecture
    category: 'privacy',
    requiresPrivacy: true,
    compatibleWith: ['fedavg', 'fedprox'],
    defaultConfig: {
      keySize: 2048,
      encryptionScheme: 'paillier',
    },
  },
];

/**
 * Get all algorithms by architecture type
 */
export function getAlgorithmsByArchitecture(
  architectureType: FLArchitectureType
): AlgorithmDefinition[] {
  switch (architectureType) {
    case 'horizontal':
      return HORIZONTAL_ALGORITHMS;
    case 'vertical':
      return VERTICAL_ALGORITHMS;
    case 'transfer':
      return TRANSFER_ALGORITHMS;
    default:
      return [];
  }
}

/**
 * Get algorithm by ID (across all architectures)
 */
export function getAlgorithmById(id: string): AlgorithmDefinition | undefined {
  const allAlgorithms = [
    ...HORIZONTAL_ALGORITHMS,
    ...VERTICAL_ALGORITHMS,
    ...TRANSFER_ALGORITHMS,
    ...PRIVACY_ALGORITHMS,
  ];
  return allAlgorithms.find((algo) => algo.id === id);
}

/**
 * Get privacy/security algorithms compatible with base algorithms
 */
export function getCompatiblePrivacyAlgorithms(baseAlgorithmIds: string[]): AlgorithmDefinition[] {
  return PRIVACY_ALGORITHMS.filter((privacyAlgo) => {
    // If no compatibility specified, compatible with all
    if (!privacyAlgo.compatibleWith) return true;

    // Check if any base algorithm is compatible
    return baseAlgorithmIds.some((baseId) => privacyAlgo.compatibleWith?.includes(baseId));
  });
}

/**
 * Validate algorithm combination
 */
export function validateAlgorithmCombination(algorithmIds: string[]): {
  valid: boolean;
  reason?: string;
} {
  if (algorithmIds.length === 0) {
    return { valid: false, reason: 'At least one algorithm must be selected' };
  }

  const algorithms = algorithmIds
    .map((id) => getAlgorithmById(id))
    .filter((algo): algo is AlgorithmDefinition => algo !== undefined);

  // Check if all algorithms are from the same architecture type (except privacy)
  const architectureTypes = new Set(
    algorithms.filter((algo) => algo.category !== 'privacy').map((algo) => algo.architectureType)
  );

  if (architectureTypes.size > 1) {
    return {
      valid: false,
      reason: `Cannot mix algorithms from different architectures: ${Array.from(architectureTypes).join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Get architecture type display name
 */
export function getArchitectureDisplayName(type: FLArchitectureType): string {
  const names: Record<FLArchitectureType, string> = {
    horizontal: 'Horizontal FL (Same features, different samples)',
    vertical: 'Vertical FL (Different features, same samples)',
    transfer: 'Transfer FL (Cross-domain knowledge transfer)',
  };
  return names[type];
}

/**
 * Get recommended algorithms for beginners
 */
export function getRecommendedAlgorithms(architectureType: FLArchitectureType): string[] {
  const recommendations: Record<FLArchitectureType, string[]> = {
    horizontal: ['fedavg', 'dp-fedavg'], // Simple and private
    vertical: ['split-learning'], // Most common vertical FL
    transfer: ['fedmd'], // Easier to understand than FMTL
  };
  return recommendations[architectureType] || [];
}
