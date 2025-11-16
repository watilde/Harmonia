/**
 * Check study status
 */

import { Logger, ErrorHandler } from '../../utils';

interface StatusOptions {
  repo?: string;
  detailed?: boolean;
  watch?: boolean;
  format?: string;
}

export async function studyStatus(_studyId: string, _options: StatusOptions) {
  await ErrorHandler.wrapAsync(async () => {
    Logger.header('📊 Study Status');
    Logger.warn('This command has been deprecated.');
    Logger.info(
      'Study status functionality has been removed. Please use the web interface or API directly.'
    );
    console.log();
  });
}
