/**
 * Results show command
 */

import { Logger, ErrorHandler } from '../../utils';

interface ResultsShowOptions {
  repo?: string;
  round?: string;
  format?: string;
  metrics?: string;
}

export async function resultsShow(_studyId: string, _options: ResultsShowOptions) {
  await ErrorHandler.wrapAsync(async () => {
    Logger.header('📊 Results Viewer');
    Logger.warn('This command has been deprecated.');
    Logger.info(
      'Results viewing functionality has been removed. Please use the web interface or API directly.'
    );
    console.log();
  });
}
