/**
 * Centralized error handling for CLI
 * Provides consistent error reporting and exit codes
 */

import { Logger } from './logger';

export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Configuration errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',

  // GitHub errors
  GITHUB_AUTH_FAILED = 'GITHUB_AUTH_FAILED',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  GITHUB_REPO_NOT_FOUND = 'GITHUB_REPO_NOT_FOUND',

  // Study errors
  STUDY_NOT_FOUND = 'STUDY_NOT_FOUND',
  STUDY_ALREADY_EXISTS = 'STUDY_ALREADY_EXISTS',

  // Site errors
  SITE_NOT_FOUND = 'SITE_NOT_FOUND',
  SITE_ALREADY_EXISTS = 'SITE_ALREADY_EXISTS',

  // Client errors
  CLIENT_NOT_RUNNING = 'CLIENT_NOT_RUNNING',
  CLIENT_ALREADY_RUNNING = 'CLIENT_ALREADY_RUNNING',
  CLIENT_START_FAILED = 'CLIENT_START_FAILED',

  // Database errors
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
}

export class CLIError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class ErrorHandler {
  /**
   * Handle CLI error and exit process
   */
  static handle(error: unknown): never {
    if (error instanceof CLIError) {
      Logger.error(error.message);

      if (error.suggestions && error.suggestions.length > 0) {
        console.log();
        error.suggestions.forEach((suggestion) => {
          Logger.warn(suggestion);
        });
      }

      Logger.debug(`Error code: ${error.code}`);
      process.exit(1);
    } else if (error instanceof Error) {
      Logger.error('An unexpected error occurred', error);
      Logger.debug(error.stack || '');
      process.exit(1);
    } else {
      Logger.error(`An unexpected error occurred: ${String(error)}`);
      process.exit(1);
    }
  }

  /**
   * Wrap async function with error handling
   */
  static async wrapAsync<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error);
    }
  }

  /**
   * Create common errors
   */
  static fileNotFound(filePath: string): CLIError {
    return new CLIError(`File not found: ${filePath}`, ErrorCode.FILE_NOT_FOUND, [
      'Check that the file path is correct',
      'Ensure you have the necessary permissions',
    ]);
  }

  static configNotFound(configType: string): CLIError {
    return new CLIError(`${configType} configuration not found`, ErrorCode.CONFIG_NOT_FOUND, [
      `Run 'harmonia ${configType.toLowerCase()} init' to create configuration`,
    ]);
  }

  static githubAuthFailed(): CLIError {
    return new CLIError('GitHub authentication failed', ErrorCode.GITHUB_AUTH_FAILED, [
      'Set GITHUB_TOKEN environment variable',
      'Run: export GITHUB_TOKEN=your_token',
      'Get a token from: https://github.com/settings/tokens',
    ]);
  }

  static studyNotFound(studyId: string): CLIError {
    return new CLIError(`Study not found: ${studyId}`, ErrorCode.STUDY_NOT_FOUND, [
      'Check the study ID is correct',
      "Run 'harmonia study list' to see available studies",
    ]);
  }

  static clientNotRunning(): CLIError {
    return new CLIError('Client is not running', ErrorCode.CLIENT_NOT_RUNNING, [
      "Start the client with 'harmonia client start'",
    ]);
  }

  static dbConnectionFailed(details?: string): CLIError {
    return new CLIError(
      `Database connection failed${details ? `: ${details}` : ''}`,
      ErrorCode.DB_CONNECTION_FAILED,
      [
        'Check database host and port',
        'Verify database credentials',
        'Ensure database server is running',
        'Check network connectivity',
      ]
    );
  }
}
