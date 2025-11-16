/**
 * Tests for ErrorHandler utility
 */

import { ErrorHandler, CLIError, ErrorCode } from './../utils/error-handler';

describe('ErrorHandler', () => {
  describe('CLIError', () => {
    it('should create error with message and code', () => {
      const error = new CLIError('Test error', ErrorCode.INVALID_INPUT);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(error.name).toBe('CLIError');
    });

    it('should accept suggestions', () => {
      const suggestions = ['Try this', 'Or that'];
      const error = new CLIError('Test error', ErrorCode.INVALID_INPUT, suggestions);

      expect(error.suggestions).toEqual(suggestions);
    });

    it('should default to UNKNOWN_ERROR code', () => {
      const error = new CLIError('Test error');

      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('ErrorHandler.wrapAsync', () => {
    it('should return value on success', async () => {
      const result = await ErrorHandler.wrapAsync(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should handle CLIError', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await ErrorHandler.wrapAsync(async () => {
        throw new CLIError('Test error', ErrorCode.INVALID_INPUT);
      });

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      consoleError.mockRestore();
    });

    it('should handle generic Error', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await ErrorHandler.wrapAsync(async () => {
        throw new Error('Generic error');
      });

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      consoleError.mockRestore();
    });
  });

  describe('ErrorHandler factory methods', () => {
    it('should create fileNotFound error', () => {
      const error = ErrorHandler.fileNotFound('/path/to/file');

      expect(error.message).toContain('/path/to/file');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions!.length).toBeGreaterThan(0);
    });

    it('should create configNotFound error', () => {
      const error = ErrorHandler.configNotFound('Study');

      expect(error.message).toContain('Study');
      expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
      expect(error.suggestions).toBeDefined();
    });

    it('should create githubAuthFailed error', () => {
      const error = ErrorHandler.githubAuthFailed();

      expect(error.code).toBe(ErrorCode.GITHUB_AUTH_FAILED);
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions!.some((s) => s.includes('GITHUB_TOKEN'))).toBe(true);
    });

    it('should create studyNotFound error', () => {
      const error = ErrorHandler.studyNotFound('test-study');

      expect(error.message).toContain('test-study');
      expect(error.code).toBe(ErrorCode.STUDY_NOT_FOUND);
    });

    it('should create clientNotRunning error', () => {
      const error = ErrorHandler.clientNotRunning();

      expect(error.code).toBe(ErrorCode.CLIENT_NOT_RUNNING);
      expect(error.suggestions).toBeDefined();
    });

    it('should create dbConnectionFailed error', () => {
      const error = ErrorHandler.dbConnectionFailed('Connection refused');

      expect(error.message).toContain('Connection refused');
      expect(error.code).toBe(ErrorCode.DB_CONNECTION_FAILED);
      expect(error.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('ErrorCode enum', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.UNKNOWN_ERROR).toBeDefined();
      expect(ErrorCode.INVALID_INPUT).toBeDefined();
      expect(ErrorCode.FILE_NOT_FOUND).toBeDefined();
      expect(ErrorCode.GITHUB_AUTH_FAILED).toBeDefined();
      expect(ErrorCode.STUDY_NOT_FOUND).toBeDefined();
      expect(ErrorCode.CLIENT_NOT_RUNNING).toBeDefined();
      expect(ErrorCode.DB_CONNECTION_FAILED).toBeDefined();
    });
  });
});
