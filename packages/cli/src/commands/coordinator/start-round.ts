/**
 * Coordinator start-round command
 */

import * as fs from 'fs';

import { FederatedCoordinator } from '@harmonia/coordinator';

interface StartRoundOptions {
  studyId?: string;
  round?: string;
  repoPath?: string;
}

/**
 * Start a new round
 */
export async function coordinatorStartRound(options: StartRoundOptions): Promise<void> {
  try {
    const studyId = options.studyId;
    const roundNumber = options.round ? parseInt(options.round) : undefined;
    const repoPath = options.repoPath || process.cwd();

    if (!studyId) {
      console.error('❌ Error: Study ID is required');
      console.log('Usage: harmonia coordinator start-round --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!roundNumber) {
      console.error('❌ Error: Round number is required');
      console.log('Usage: harmonia coordinator start-round --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!fs.existsSync(repoPath)) {
      console.error(`❌ Error: Repository path not found: ${repoPath}`);
      process.exit(1);
    }

    const coordinator = new FederatedCoordinator({ repoPath });
    coordinator.startRound(studyId, roundNumber);

    console.log('\n✅ Round started successfully!');
  } catch (error) {
    console.error('\n❌ Failed to start round:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
