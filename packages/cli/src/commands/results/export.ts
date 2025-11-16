/**
 * Results export command
 */

import { Logger, ErrorHandler } from '../../utils';

interface ResultsExportOptions {
  repo?: string;
  output?: string;
  format?: string;
  include?: string;
}

export async function resultsExport(_studyId: string, _options: ResultsExportOptions) {
  await ErrorHandler.wrapAsync(async () => {
    Logger.header('📤 Results Export');
    Logger.warn('This command has been deprecated.');
    Logger.info(
      'Results export functionality has been removed. Please use the web interface or API directly.'
    );
    console.log();
  });
}
