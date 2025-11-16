/**
 * Train command - Site training for one round
 */

import * as fs from 'fs';

import { FederatedClient } from '@harmonia/client';

interface TrainOptions {
  studyId?: string;
  round?: string;
  siteId?: string;
  repoPath?: string;
  dbHost?: string;
  dbPort?: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  dbType?: string;
  encryptionKey?: string;
}

/**
 * Train for a specific round
 */
export async function train(options: TrainOptions): Promise<void> {
  try {
    // Get required parameters
    const studyId = options.studyId || process.env.STUDY_ID;
    const roundNumber = options.round ? parseInt(options.round) : undefined;
    const siteId = options.siteId || process.env.SITE_ID;
    const repoPath = options.repoPath || process.cwd();

    if (!studyId) {
      console.error('❌ Error: Study ID is required');
      console.log('Usage: harmonia train --study-id <id> --round <n>');
      console.log('   Or: Set STUDY_ID environment variable');
      process.exit(1);
    }

    if (!roundNumber) {
      console.error('❌ Error: Round number is required');
      console.log('Usage: harmonia train --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!siteId) {
      console.error('❌ Error: Site ID is required');
      console.log('Usage: harmonia train --study-id <id> --round <n> --site-id <id>');
      console.log('   Or: Set SITE_ID environment variable');
      process.exit(1);
    }

    // Verify repo path exists
    if (!fs.existsSync(repoPath)) {
      console.error(`❌ Error: Repository path not found: ${repoPath}`);
      console.log('Did you forget to clone the study repository?');
      process.exit(1);
    }

    // Get database config from env or options
    const dbType = options.dbType || process.env.DB_TYPE || 'postgresql';
    const dbHost = options.dbHost || process.env.DB_HOST || 'localhost';
    const dbPort =
      options.dbPort || process.env.DB_PORT || (dbType === 'postgresql' ? '5432' : '1433');
    const dbName = options.dbName || process.env.DB_NAME;
    const dbUser = options.dbUser || process.env.DB_USER;
    const dbPassword = options.dbPassword || process.env.DB_PASSWORD;

    if (!dbName) {
      console.error('❌ Error: Database name is required');
      console.log('Set DB_NAME environment variable or use --db-name option');
      process.exit(1);
    }

    if (!dbUser) {
      console.error('❌ Error: Database user is required');
      console.log('Set DB_USER environment variable or use --db-user option');
      process.exit(1);
    }

    if (!dbPassword) {
      console.error('❌ Error: Database password is required');
      console.log('Set DB_PASSWORD environment variable or use --db-password option');
      process.exit(1);
    }

    // Get encryption key
    const encryptionKey = options.encryptionKey || process.env.ENCRYPTION_KEY;

    // Create client
    const client = new FederatedClient({
      siteId,
      repoPath,
      database: {
        type: dbType as 'postgresql' | 'sqlserver',
        host: dbHost,
        port: parseInt(dbPort),
        database: dbName,
        schema: 'public',
        username: dbUser,
        password: dbPassword,
      },
      encryptionKey,
    });

    // Initialize and train
    await client.initialize();
    await client.trainRound(studyId, roundNumber);
    await client.disconnect();

    console.log('\n✅ Training completed successfully!');
  } catch (error) {
    console.error('\n❌ Training failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
