/**
 * List studies command
 */

import { Logger, ErrorHandler } from '../../utils';

interface ListOptions {
  repo?: string;
  status?: string;
  format?: string;
}

export async function studyList(_options: ListOptions) {
  await ErrorHandler.wrapAsync(async () => {
    Logger.header('📊 Study List');
    Logger.warn('This command has been deprecated.');
    Logger.info(
      'Study listing functionality has been removed. Please use the web interface or API directly.'
    );
    console.log();
  });
}
