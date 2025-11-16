/**
 * Init command - Initialize study configuration
 */

import * as fs from 'fs';
import * as path from 'path';

interface InitOptions {
  studyId?: string;
  studyName?: string;
  totalRounds?: string;
  minParticipants?: string;
  algorithm?: string;
  output?: string;
  interactive?: boolean;
}

/**
 * Initialize a new study configuration
 */
export async function init(options: InitOptions): Promise<void> {
  try {
    const studyId = options.studyId || `study-${Date.now()}`;
    const studyName = options.studyName || studyId;
    const totalRounds = options.totalRounds ? parseInt(options.totalRounds) : 10;
    const minParticipants = options.minParticipants ? parseInt(options.minParticipants) : 2;
    const algorithm = options.algorithm || 'fedavg';
    const outputDir = options.output || process.cwd();

    console.log(`\n🔬 Initializing study: ${studyName}\n`);

    // Create study config
    const studyConfig = {
      studyId,
      studyName,
      coordinatorId: 'coordinator',
      totalRounds,
      minParticipants,
      maxParticipants: 10,

      algorithm,

      modelConfig: {
        type: 'sequential',
        layers: [
          {
            type: 'dense',
            units: 64,
            activation: 'relu',
            inputShape: [10],
          },
          {
            type: 'dense',
            units: 32,
            activation: 'relu',
          },
          {
            type: 'dense',
            units: 1,
            activation: 'sigmoid',
          },
        ],
        optimizer: {
          type: 'adam',
          learningRate: 0.01,
        },
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
        epochs: 10,
        batchSize: 32,
      },

      featureDefinitions: [
        {
          name: 'feature1',
          type: 'numeric',
        },
        {
          name: 'feature2',
          type: 'numeric',
        },
      ],

      privacyConfig: {
        differentialPrivacy: {
          enabled: true,
          epsilon: 5.0,
          delta: 0.00001,
          clipNorm: 1.0,
        },
        encryption: {
          enabled: true,
          algorithm: 'AES-256-GCM',
        },
      },

      cohortDefinition: {
        name: 'Study Cohort',
        inclusionConceptIds: [],
        exclusionConceptIds: [],
      },
    };

    // Create directory structure
    const studyDir = path.join(outputDir, 'studies', studyId);
    fs.mkdirSync(studyDir, { recursive: true });

    // Write config.json
    const configPath = path.join(studyDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(studyConfig, null, 2));

    // Write current-round.json
    const roundInfo = {
      studyId,
      roundNumber: 0,
      totalRounds,
      status: 'initialized',
      timestamp: new Date().toISOString(),
    };
    const roundPath = path.join(studyDir, 'current-round.json');
    fs.writeFileSync(roundPath, JSON.stringify(roundInfo, null, 2));

    // Create rounds directory
    fs.mkdirSync(path.join(studyDir, 'rounds'), { recursive: true });

    console.log('✅ Study initialized successfully!\n');
    console.log('Files created:');
    console.log(`  ${configPath}`);
    console.log(`  ${roundPath}`);
    console.log(`  ${path.join(studyDir, 'rounds')}/\n`);

    console.log('Next steps:');
    console.log('  1. Edit the configuration:');
    console.log(`     nano ${configPath}`);
    console.log('');
    console.log('  2. Initialize git repository (if not already):');
    console.log(`     cd ${outputDir}`);
    console.log('     git init');
    console.log('     git add studies/');
    console.log(`     git commit -m "Initialize study ${studyId}"`);
    console.log('');
    console.log('  3. Push to GitHub:');
    console.log('     git remote add origin <repo-url>');
    console.log('     git push -u origin main');
    console.log('');
    console.log('  4. Start round 1:');
    console.log(`     harmonia coordinator start-round --study-id ${studyId} --round 1`);
  } catch (error) {
    console.error('\n❌ Initialization failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
