/**
 * Reusable prompt configurations for interactive CLI
 */

import inquirer from 'inquirer';
import { Validator } from './validation';
import {
  FLArchitectureType,
  getAlgorithmsByArchitecture,
  getArchitectureDisplayName,
  getCompatiblePrivacyAlgorithms,
  validateAlgorithmCombination,
  getRecommendedAlgorithms,
} from '../config/algorithms';

export interface StudyConfigPrompts {
  studyName: string;
  studyId: string;
  description: string;
  githubRepo: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorOrganization: string;
  modelType: 'logistic-regression' | 'neural-network';
  taskType: 'binary-classification' | 'multi-class' | 'regression';
  epsilon: number;
  delta: number;
  clipNorm: number;
  totalRounds: number;
  localEpochs: number;
  batchSize: number;
  learningRate: number;
}

export interface SiteConfigPrompts {
  githubRepo: string;
  siteId: string;
  siteName: string;
  dbType: 'postgresql' | 'sqlserver';
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbSchema: string;
  dbUser: string;
  dbPassword: string;
}

export class Prompts {
  /**
   * Get study configuration from user
   */
  static async getStudyConfig(defaults?: Partial<StudyConfigPrompts>): Promise<StudyConfigPrompts> {
    return await inquirer.prompt<StudyConfigPrompts>([
      {
        type: 'input',
        name: 'studyName',
        message: 'Study name (required):',
        default: defaults?.studyName,
        validate: Validator.getNonEmptyError('Study name'),
      },
      {
        type: 'input',
        name: 'studyId',
        message: 'Study ID (lowercase, no spaces):',
        default: (answers: Partial<StudyConfigPrompts>) =>
          Validator.sanitizeForFilesystem(answers.studyName || 'study'),
        validate: (input: string) => Validator.getStudyIdError(input),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Study description (optional):',
        default: defaults?.description || '',
      },
      {
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository (org/repo):',
        default: defaults?.githubRepo || 'your-org/fl-study',
        validate: (input: string) => Validator.getGitHubRepoError(input),
      },
      {
        type: 'input',
        name: 'coordinatorName',
        message: 'Coordinator name:',
        default: defaults?.coordinatorName || 'Research Lead',
      },
      {
        type: 'input',
        name: 'coordinatorEmail',
        message: 'Coordinator email:',
        default: defaults?.coordinatorEmail || 'lead@research.org',
        validate: (input: string) => Validator.getEmailError(input),
      },
      {
        type: 'input',
        name: 'coordinatorOrganization',
        message: 'Coordinator organization:',
        default: defaults?.coordinatorOrganization || 'Research Institute',
      },
      {
        type: 'list',
        name: 'modelType',
        message: 'Model type:',
        choices: [
          { name: 'Logistic Regression', value: 'logistic-regression' },
          { name: 'Neural Network', value: 'neural-network' },
        ],
        default: defaults?.modelType || 'logistic-regression',
      },
      {
        type: 'list',
        name: 'taskType',
        message: 'Task type:',
        choices: [
          { name: 'Binary Classification', value: 'binary-classification' },
          { name: 'Multi-class Classification', value: 'multi-class' },
          { name: 'Regression', value: 'regression' },
        ],
        default: defaults?.taskType || 'binary-classification',
      },
      {
        type: 'number',
        name: 'epsilon',
        message: 'Privacy epsilon (lower = more private):',
        default: defaults?.epsilon || 5.0,
        validate: (input: number) => Validator.getEpsilonError(input),
      },
      {
        type: 'number',
        name: 'delta',
        message: 'Privacy delta:',
        default: defaults?.delta || 1e-5,
        validate: (input: number) => Validator.getDeltaError(input),
      },
      {
        type: 'number',
        name: 'clipNorm',
        message: 'Gradient clipping norm:',
        default: defaults?.clipNorm || 1.0,
        validate: (input: number) => Validator.getPositiveNumberError(input, 'Clip norm'),
      },
      {
        type: 'number',
        name: 'totalRounds',
        message: 'Total training rounds:',
        default: defaults?.totalRounds || 10,
        validate: (input: number) => Validator.getPositiveNumberError(input, 'Total rounds'),
      },
      {
        type: 'number',
        name: 'localEpochs',
        message: 'Local epochs per round:',
        default: defaults?.localEpochs || 5,
        validate: (input: number) => Validator.getPositiveNumberError(input, 'Local epochs'),
      },
      {
        type: 'number',
        name: 'batchSize',
        message: 'Batch size:',
        default: defaults?.batchSize || 32,
        validate: (input: number) => Validator.getPositiveNumberError(input, 'Batch size'),
      },
      {
        type: 'number',
        name: 'learningRate',
        message: 'Learning rate:',
        default: defaults?.learningRate || 0.01,
        validate: (input: number) => Validator.getPositiveNumberError(input, 'Learning rate'),
      },
    ]);
  }

  /**
   * Get site configuration from user
   */
  static async getSiteConfig(
    _studyId: string,
    defaults?: Partial<SiteConfigPrompts>
  ): Promise<SiteConfigPrompts> {
    return await inquirer.prompt<SiteConfigPrompts>([
      {
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository (org/repo):',
        default: defaults?.githubRepo,
        validate: (input: string) => Validator.getGitHubRepoError(input),
      },
      {
        type: 'input',
        name: 'siteId',
        message: 'Your site ID (lowercase, no spaces):',
        default: defaults?.siteId || 'site-a',
        validate: (input: string) => Validator.getSiteIdError(input),
      },
      {
        type: 'input',
        name: 'siteName',
        message: 'Your site name:',
        default: defaults?.siteName || 'University Site A',
      },
      {
        type: 'list',
        name: 'dbType',
        message: 'OMOP database type:',
        choices: [
          { name: 'PostgreSQL', value: 'postgresql' },
          { name: 'SQL Server', value: 'sqlserver' },
        ],
        default: defaults?.dbType || 'postgresql',
      },
      {
        type: 'input',
        name: 'dbHost',
        message: 'Database host:',
        default: defaults?.dbHost || 'localhost',
      },
      {
        type: 'number',
        name: 'dbPort',
        message: 'Database port:',
        default: (answers: Partial<SiteConfigPrompts>) =>
          answers.dbType === 'postgresql' ? 5432 : 1433,
        validate: (input: number) => Validator.getPortError(input),
      },
      {
        type: 'input',
        name: 'dbName',
        message: 'Database name:',
        default: (answers: Partial<SiteConfigPrompts>) =>
          answers.dbType === 'postgresql' ? 'omop_cdm' : 'OMOP_CDM',
      },
      {
        type: 'input',
        name: 'dbSchema',
        message: 'Database schema:',
        default: (answers: Partial<SiteConfigPrompts>) =>
          answers.dbType === 'postgresql' ? 'public' : 'dbo',
      },
      {
        type: 'input',
        name: 'dbUser',
        message: 'Database username:',
        default: defaults?.dbUser,
      },
      {
        type: 'password',
        name: 'dbPassword',
        message: 'Database password:',
        mask: '*',
      },
    ]);
  }

  /**
   * Confirm action with user
   */
  static async confirm(message: string, defaultValue = false): Promise<boolean> {
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);
    return confirmed;
  }

  /**
   * Get algorithm selection
   */
  static async selectAlgorithm(): Promise<string> {
    const { algorithm } = await inquirer.prompt<{ algorithm: string }>([
      {
        type: 'list',
        name: 'algorithm',
        message: 'Federated learning algorithm:',
        choices: [
          { name: 'FedAvg - Standard federated averaging', value: 'fedavg' },
          { name: 'FedProx - Handles heterogeneous data', value: 'fedprox' },
          { name: 'SCAFFOLD - Reduces client drift', value: 'scaffold' },
          { name: 'FedNova - Normalized averaging', value: 'fednova' },
          { name: 'FedDyn - Dynamic regularization', value: 'feddyn' },
          { name: 'MOON - Model-contrastive learning', value: 'moon' },
          { name: 'DP-FedAvg - Differential privacy', value: 'dp-fedavg' },
          { name: 'SecAgg - Secure aggregation', value: 'secagg' },
        ],
        default: 'fedavg',
      },
    ]);
    return algorithm;
  }

  /**
   * Get export format selection
   */
  static async selectExportFormat(): Promise<'json' | 'csv' | 'excel'> {
    const { format } = await inquirer.prompt<{ format: 'json' | 'csv' | 'excel' }>([
      {
        type: 'list',
        name: 'format',
        message: 'Export format:',
        choices: [
          { name: 'JSON', value: 'json' },
          { name: 'CSV', value: 'csv' },
          { name: 'Excel', value: 'excel' },
        ],
        default: 'json',
      },
    ]);
    return format;
  }

  /**
   * Select FL architecture type with detailed descriptions
   */
  static async selectArchitectureType(): Promise<FLArchitectureType> {
    const { architectureType } = await inquirer.prompt<{
      architectureType: FLArchitectureType;
    }>([
      {
        type: 'list',
        name: 'architectureType',
        message: 'Select FL architecture type:',
        choices: [
          {
            name: 'Horizontal FL - Sites have same features, different samples (most common)',
            value: 'horizontal',
            short: 'Horizontal FL',
          },
          {
            name: 'Vertical FL - Sites have different features, same samples (feature collaboration)',
            value: 'vertical',
            short: 'Vertical FL',
          },
          {
            name: 'Transfer FL - Cross-domain knowledge transfer (advanced)',
            value: 'transfer',
            short: 'Transfer FL',
          },
        ],
        default: 'horizontal',
      },
    ]);

    return architectureType;
  }

  /**
   * Select algorithms interactively with multi-select support
   */
  static async selectAlgorithms(architectureType: FLArchitectureType): Promise<{
    baseAlgorithms: string[];
    privacyAlgorithms: string[];
  }> {
    console.log(`\nArchitecture: ${getArchitectureDisplayName(architectureType)}\n`);

    // Get available algorithms for this architecture
    const availableAlgorithms = getAlgorithmsByArchitecture(architectureType);
    const recommended = getRecommendedAlgorithms(architectureType);

    // Group algorithms by category
    const basicAlgos = availableAlgorithms.filter((a) => a.category === 'basic');
    const advancedAlgos = availableAlgorithms.filter((a) => a.category === 'advanced');
    const personalizationAlgos = availableAlgorithms.filter(
      (a) => a.category === 'personalization'
    );
    const privacyAlgos = availableAlgorithms.filter((a) => a.category === 'privacy');

    // Ask if user wants simple or advanced selection
    const { selectionMode } = await inquirer.prompt<{
      selectionMode: 'simple' | 'advanced';
    }>([
      {
        type: 'list',
        name: 'selectionMode',
        message: 'Algorithm selection mode:',
        choices: [
          {
            name: 'Simple - Use recommended algorithms (best for beginners)',
            value: 'simple',
          },
          {
            name: 'Advanced - Select specific algorithms',
            value: 'advanced',
          },
        ],
        default: 'simple',
      },
    ]);

    let selectedBaseAlgorithms: string[];

    if (selectionMode === 'simple') {
      // Use recommended algorithms
      selectedBaseAlgorithms = recommended;
      console.log(
        `\nUsing recommended algorithms: ${recommended.map((id) => availableAlgorithms.find((a) => a.id === id)?.name).join(', ')}\n`
      );
    } else {
      // Advanced: Let user select specific algorithms
      const choices: Array<{
        name: string;
        value: string;
        checked?: boolean;
        disabled?: boolean;
      }> = [];

      // Add basic algorithms
      if (basicAlgos.length > 0) {
        choices.push({ name: '--- Basic Algorithms ---', value: '', disabled: true });
        basicAlgos.forEach((algo) => {
          choices.push({
            name: `${algo.name} - ${algo.description}`,
            value: algo.id,
            checked: recommended.includes(algo.id),
          });
        });
      }

      // Add advanced algorithms
      if (advancedAlgos.length > 0) {
        choices.push({ name: '--- Advanced Algorithms ---', value: '', disabled: true });
        advancedAlgos.forEach((algo) => {
          choices.push({
            name: `${algo.name} - ${algo.description}`,
            value: algo.id,
            checked: recommended.includes(algo.id),
          });
        });
      }

      // Add personalization algorithms
      if (personalizationAlgos.length > 0) {
        choices.push({
          name: '--- Personalization Algorithms ---',
          value: '',
          disabled: true,
        });
        personalizationAlgos.forEach((algo) => {
          choices.push({
            name: `${algo.name} - ${algo.description}`,
            value: algo.id,
          });
        });
      }

      // Add privacy algorithms (built-in to this architecture)
      if (privacyAlgos.length > 0) {
        choices.push({
          name: '--- Privacy Algorithms (Built-in) ---',
          value: '',
          disabled: true,
        });
        privacyAlgos.forEach((algo) => {
          choices.push({
            name: `${algo.name} - ${algo.description}${algo.requiresPrivacy ? ' [REQUIRED for patient data]' : ''}`,
            value: algo.id,
            checked: algo.requiresPrivacy, // Auto-check required privacy algos
          });
        });
      }

      const { algorithms } = await inquirer.prompt<{ algorithms: string[] }>([
        {
          type: 'checkbox',
          name: 'algorithms',
          message: 'Select algorithms (Space to select, Enter to confirm):',
          choices: choices.filter((c) => c.value !== ''), // Remove disabled items
          validate: (selected: string[]) => {
            if (selected.length === 0) {
              return 'Please select at least one algorithm';
            }

            const validation = validateAlgorithmCombination(selected);
            if (!validation.valid) {
              return validation.reason || 'Invalid algorithm combination';
            }

            return true;
          },
        },
      ]);

      selectedBaseAlgorithms = algorithms;
    }

    // Separate base algorithms and privacy algorithms
    const baseAlgorithms = selectedBaseAlgorithms.filter(
      (id) => !availableAlgorithms.find((a) => a.id === id && a.category === 'privacy')
    );
    const builtInPrivacyAlgorithms = selectedBaseAlgorithms.filter((id) =>
      availableAlgorithms.find((a) => a.id === id && a.category === 'privacy')
    );

    // Ask about additional privacy/security mechanisms
    const compatiblePrivacy = getCompatiblePrivacyAlgorithms(baseAlgorithms);
    let additionalPrivacyAlgorithms: string[] = [];

    if (compatiblePrivacy.length > 0 && architectureType === 'horizontal') {
      const { addPrivacy } = await inquirer.prompt<{ addPrivacy: boolean }>([
        {
          type: 'confirm',
          name: 'addPrivacy',
          message: 'Add additional privacy/security mechanisms (SecAgg, HE-FL)?',
          default: false,
        },
      ]);

      if (addPrivacy) {
        const { privacyAlgorithms } = await inquirer.prompt<{
          privacyAlgorithms: string[];
        }>([
          {
            type: 'checkbox',
            name: 'privacyAlgorithms',
            message: 'Select privacy mechanisms:',
            choices: compatiblePrivacy.map((algo) => ({
              name: `${algo.name} - ${algo.description}`,
              value: algo.id,
            })),
          },
        ]);

        additionalPrivacyAlgorithms = privacyAlgorithms;
      }
    }

    const allPrivacyAlgorithms = [...builtInPrivacyAlgorithms, ...additionalPrivacyAlgorithms];

    // Show summary
    console.log('\nSelected configuration:');
    console.log(`  Base algorithms: ${baseAlgorithms.join(', ')}`);
    if (allPrivacyAlgorithms.length > 0) {
      console.log(`  Privacy mechanisms: ${allPrivacyAlgorithms.join(', ')}`);
    }
    console.log();

    return {
      baseAlgorithms,
      privacyAlgorithms: allPrivacyAlgorithms,
    };
  }

  /**
   * Get algorithm-specific configuration
   */
  static async getAlgorithmConfig(
    algorithmId: string,
    defaults?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const config: Record<string, unknown> = { ...defaults };

    console.log(`\nConfiguring ${algorithmId} parameters:\n`);

    switch (algorithmId) {
      case 'fedprox':
        // FedProx requires mu (proximal term coefficient)
        config.mu = await this.number({
          message: 'Proximal term coefficient (μ):',
          default: (defaults?.mu as number) || 0.01,
          min: 0.001,
          max: 1.0,
        });
        console.log(
          `  ℹ️  μ controls how much clients stay close to global model (higher = more constraint)\n`
        );
        break;

      case 'hierarchical-fedavg':
      case 'hybrid-split': {
        // Hierarchical FL requires tier configuration
        config.numTiers = await this.number({
          message: 'Number of tiers (e.g., edge-fog-cloud):',
          default: (defaults?.numTiers as number) || 3,
          min: 2,
          max: 5,
        });

        const tiers: number[] = [];
        for (let i = 0; i < (config.numTiers as number); i++) {
          const tierName = ['Edge', 'Fog', 'Regional', 'Cloud', 'Global'][i] || `Tier ${i + 1}`;
          const numClients = await this.number({
            message: `Number of nodes in ${tierName} tier:`,
            default:
              ((defaults?.clientsPerTier as number[]) || [10, 5, 1])[i] || Math.max(1, 10 - i * 3),
            min: 1,
            max: 100,
          });
          tiers.push(numClients);
        }
        config.clientsPerTier = tiers;

        config.aggregationStrategy = await this.select({
          message: 'Aggregation strategy:',
          choices: [
            { name: 'Tiered - Aggregate within each tier first', value: 'tiered' },
            { name: 'Weighted - Weight by tier level', value: 'weighted' },
            { name: 'Uniform - Equal weight for all nodes', value: 'uniform' },
          ],
          default: (defaults?.aggregationStrategy as string) || 'tiered',
        });
        console.log();
        break;
      }

      case 'vertical-fedavg':
      case 'split-learning':
        // Vertical FL requires split point configuration
        config.splitPoint = await this.select({
          message: 'Model split point:',
          choices: [
            { name: 'Early - Split at 25% (more data stays local)', value: 'early' },
            { name: 'Middle - Split at 50% (balanced)', value: 'middle' },
            { name: 'Late - Split at 75% (more computation on server)', value: 'late' },
          ],
          default: (defaults?.splitPoint as string) || 'middle',
        });

        config.numParties = await this.number({
          message: 'Number of parties:',
          default: (defaults?.numParties as number) || 2,
          min: 2,
          max: 10,
        });
        console.log();
        break;

      case 'transfer':
        // Transfer learning configuration
        config.pretrainedBase = await this.confirm(
          'Use pretrained base model?',
          (defaults?.pretrainedBase as boolean) ?? true
        );

        if (config.pretrainedBase) {
          config.freezeBase = await this.confirm(
            'Freeze base layers during training?',
            (defaults?.freezeBase as boolean) ?? true
          );

          config.fineTuneEpochs = await this.number({
            message: 'Fine-tuning epochs:',
            default: (defaults?.fineTuneEpochs as number) || 5,
            min: 1,
            max: 50,
          });
        }
        console.log();
        break;

      case 'scaffold':
        // SCAFFOLD requires control variate tracking
        config.serverLearningRate = await this.number({
          message: 'Server learning rate:',
          default: (defaults?.serverLearningRate as number) || 1.0,
          min: 0.01,
          max: 10.0,
        });
        console.log(`  ℹ️  SCAFFOLD uses control variates to reduce client drift\n`);
        break;

      case 'fednova':
        // FedNova requires normalized averaging
        config.normalizeWeights = await this.confirm(
          'Normalize client weights by local steps?',
          (defaults?.normalizeWeights as boolean) ?? true
        );
        console.log(`  ℹ️  FedNova normalizes by number of local updates\n`);
        break;

      case 'dp-fedavg':
        // Differential privacy parameters
        config.epsilon = await this.number({
          message: 'Privacy budget (ε):',
          default: (defaults?.epsilon as number) || 5.0,
          min: 0.1,
          max: 10.0,
        });

        config.delta = await this.number({
          message: 'Privacy parameter (δ):',
          default: (defaults?.delta as number) || 1e-5,
          min: 1e-7,
          max: 1e-3,
        });

        config.clipNorm = await this.number({
          message: 'Gradient clipping norm:',
          default: (defaults?.clipNorm as number) || 1.0,
          min: 0.1,
          max: 10.0,
        });
        console.log(`  ℹ️  Lower ε = stronger privacy, higher noise. Typical: ε=1-10, δ=1e-5\n`);
        break;

      default:
        // For algorithms without specific config, just return defaults
        console.log(`  ℹ️  No additional configuration needed for ${algorithmId}\n`);
        break;
    }

    return config;
  }

  /**
   * Generic text input
   */
  static async text(options: {
    message: string;
    default?: string;
    validate?: (input: string) => boolean | string;
  }): Promise<string> {
    const { value } = await inquirer.prompt<{ value: string }>([
      {
        type: 'input',
        name: 'value',
        message: options.message,
        default: options.default,
        validate: options.validate,
      },
    ]);
    return value;
  }

  /**
   * Generic number input
   */
  static async number(options: {
    message: string;
    default?: number;
    min?: number;
    max?: number;
  }): Promise<number> {
    const { value } = await inquirer.prompt<{ value: number }>([
      {
        type: 'number',
        name: 'value',
        message: options.message,
        default: options.default,
        validate: (input: number) => {
          if (options.min !== undefined && input < options.min) {
            return `Value must be at least ${options.min}`;
          }
          if (options.max !== undefined && input > options.max) {
            return `Value must be at most ${options.max}`;
          }
          return true;
        },
      },
    ]);
    return value;
  }

  /**
   * Generic select (list)
   */
  static async select<T = string>(options: {
    message: string;
    choices: Array<{ name: string; value: T }>;
    default?: T;
  }): Promise<T> {
    const { value } = await inquirer.prompt<{ value: T }>([
      {
        type: 'list',
        name: 'value',
        message: options.message,
        choices: options.choices,
        default: options.default,
      },
    ]);
    return value;
  }

  /**
   * Generic multi-select (checkbox)
   */
  static async multiSelect(options: {
    message: string;
    choices: Array<{ name: string; value: string; checked?: boolean }>;
  }): Promise<string[]> {
    const { values } = await inquirer.prompt<{ values: string[] }>([
      {
        type: 'checkbox',
        name: 'values',
        message: options.message,
        choices: options.choices,
      },
    ]);
    return values;
  }
}
