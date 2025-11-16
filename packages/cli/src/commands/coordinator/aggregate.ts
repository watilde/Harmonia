/**
 * Coordinator aggregate command
 */

import * as fs from 'fs';

import { FederatedCoordinator } from '@harmonia/coordinator';

interface AggregateOptions {
  studyId?: string;
  round?: string;
  repoPath?: string;
  minParticipants?: string;
  strategy?: string;
  encryptionKey?: string;
}

/**
 * Aggregate updates for a round
 */
export async function coordinatorAggregate(options: AggregateOptions): Promise<void> {
  try {
    const studyId = options.studyId;
    const roundNumber = options.round ? parseInt(options.round) : undefined;
    const repoPath = options.repoPath || process.cwd();
    const minParticipants = options.minParticipants ? parseInt(options.minParticipants) : 2;
    const strategy = (options.strategy || 'weighted') as 'weighted' | 'uniform';
    const encryptionKey = options.encryptionKey || process.env.ENCRYPTION_KEY;

    if (!studyId) {
      console.error('❌ Error: Study ID is required');
      console.log('Usage: harmonia coordinator aggregate --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!roundNumber) {
      console.error('❌ Error: Round number is required');
      console.log('Usage: harmonia coordinator aggregate --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!fs.existsSync(repoPath)) {
      console.error(`❌ Error: Repository path not found: ${repoPath}`);
      process.exit(1);
    }

    const coordinator = new FederatedCoordinator({ repoPath, encryptionKey });

    const result = await coordinator.aggregateRound({
      studyId,
      roundNumber,
      minParticipants,
      aggregationStrategy: strategy,
    });

    if (result.success) {
      console.log('\n✅ Aggregation completed successfully!');
    } else {
      console.error('\n❌ Aggregation failed');
      if (result.errors) {
        result.errors.forEach((err: string) => console.error(`   ${err}`));
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Aggregation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
