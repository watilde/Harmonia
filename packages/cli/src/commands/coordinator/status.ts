/**
 * Coordinator status command
 */

import * as fs from 'fs';

import { FederatedCoordinator } from '@harmonia/coordinator';

interface StatusOptions {
  studyId?: string;
  round?: string;
  repoPath?: string;
  format?: string;
}

/**
 * Check round status
 */
export async function coordinatorStatus(options: StatusOptions): Promise<void> {
  try {
    const studyId = options.studyId;
    const roundNumber = options.round ? parseInt(options.round) : undefined;
    const repoPath = options.repoPath || process.cwd();
    const format = options.format || 'table';

    if (!studyId) {
      console.error('❌ Error: Study ID is required');
      console.log('Usage: harmonia coordinator status --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!roundNumber) {
      console.error('❌ Error: Round number is required');
      console.log('Usage: harmonia coordinator status --study-id <id> --round <n>');
      process.exit(1);
    }

    if (!fs.existsSync(repoPath)) {
      console.error(`❌ Error: Repository path not found: ${repoPath}`);
      process.exit(1);
    }

    const coordinator = new FederatedCoordinator({ repoPath });
    const status = coordinator.checkRoundStatus(studyId, roundNumber) as {
      complete: boolean;
      submittedSites: string[];
      totalSites: number;
    };

    if (format === 'json') {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(`\n📊 Round ${roundNumber} Status\n`);
      console.log(`Study: ${studyId}`);
      console.log(`Complete: ${status.complete ? '✅ Yes' : '⏳ No'}`);
      console.log(`Submitted: ${status.submittedSites.length}/${status.totalSites} sites`);

      if (status.submittedSites.length > 0) {
        console.log('\nSubmitted sites:');
        status.submittedSites.forEach((site: string) => {
          console.log(`  ✅ ${site}`);
        });
      }

      if (!status.complete) {
        console.log('\n⏳ Waiting for remaining sites to submit...');
        console.log('   Run: git pull');
        console.log('   Then check again: harmonia coordinator status --study-id <id> --round <n>');
      } else {
        console.log('\n✅ All sites submitted! Ready to aggregate.');
        console.log('   Run: harmonia coordinator aggregate --study-id <id> --round <n>');
      }
    }
  } catch (error) {
    console.error('\n❌ Failed to check status:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
