/**
 * Input validation utility
 * Provides consistent validation for user inputs
 */

export class Validator {
  /**
   * Validate GitHub repository format (org/repo)
   */
  static validateGitHubRepo(repo: string): boolean {
    return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(repo);
  }

  /**
   * Get GitHub repo validation error message
   */
  static getGitHubRepoError(repo: string): string | true {
    if (!repo) {
      return 'Repository is required';
    }
    if (!this.validateGitHubRepo(repo)) {
      return 'Repository must be in format: org/repo';
    }
    return true;
  }

  /**
   * Validate site ID format (lowercase alphanumeric with hyphens)
   */
  static validateSiteId(siteId: string): boolean {
    return /^[a-z0-9-]+$/.test(siteId);
  }

  /**
   * Get site ID validation error message
   */
  static getSiteIdError(siteId: string): string | true {
    if (!siteId) {
      return 'Site ID is required';
    }
    if (!this.validateSiteId(siteId)) {
      return 'Site ID must be lowercase alphanumeric with hyphens';
    }
    if (siteId.length < 3) {
      return 'Site ID must be at least 3 characters';
    }
    return true;
  }

  /**
   * Validate study ID format (lowercase alphanumeric with hyphens)
   */
  static validateStudyId(studyId: string): boolean {
    return /^[a-z0-9-]+$/.test(studyId);
  }

  /**
   * Get study ID validation error message
   */
  static getStudyIdError(studyId: string): string | true {
    if (!studyId) {
      return 'Study ID is required';
    }
    if (!this.validateStudyId(studyId)) {
      return 'Study ID must be lowercase alphanumeric with hyphens';
    }
    if (studyId.length < 3) {
      return 'Study ID must be at least 3 characters';
    }
    return true;
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Get email validation error message
   */
  static getEmailError(email: string): string | true {
    if (!email) {
      return 'Email is required';
    }
    if (!this.validateEmail(email)) {
      return 'Invalid email address';
    }
    return true;
  }

  /**
   * Validate port number
   */
  static validatePort(port: number): boolean {
    return Number.isInteger(port) && port > 0 && port < 65536;
  }

  /**
   * Get port validation error message
   */
  static getPortError(port: number): string | true {
    if (!this.validatePort(port)) {
      return 'Port must be between 1 and 65535';
    }
    return true;
  }

  /**
   * Validate positive number
   */
  static validatePositiveNumber(value: number): boolean {
    return typeof value === 'number' && value > 0 && !isNaN(value);
  }

  /**
   * Get positive number validation error message
   */
  static getPositiveNumberError(value: number, fieldName: string): string | true {
    if (!this.validatePositiveNumber(value)) {
      return `${fieldName} must be a positive number`;
    }
    return true;
  }

  /**
   * Validate non-empty string
   */
  static validateNonEmpty(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Get non-empty validation error message
   */
  static getNonEmptyError(fieldName: string): (input: string) => string | true {
    return (input: string) => {
      if (!this.validateNonEmpty(input)) {
        return `${fieldName} is required`;
      }
      return true;
    };
  }

  /**
   * Sanitize string for file system use
   */
  static sanitizeForFilesystem(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  /**
   * Validate privacy epsilon value
   */
  static validateEpsilon(epsilon: number): boolean {
    return this.validatePositiveNumber(epsilon) && epsilon <= 10;
  }

  /**
   * Get epsilon validation error message
   */
  static getEpsilonError(epsilon: number): string | true {
    if (!this.validatePositiveNumber(epsilon)) {
      return 'Epsilon must be a positive number';
    }
    if (epsilon > 10) {
      return 'Epsilon should typically be ≤ 10 for meaningful privacy';
    }
    return true;
  }

  /**
   * Validate privacy delta value
   */
  static validateDelta(delta: number): boolean {
    return typeof delta === 'number' && delta > 0 && delta < 1;
  }

  /**
   * Get delta validation error message
   */
  static getDeltaError(delta: number): string | true {
    if (!this.validateDelta(delta)) {
      return 'Delta must be between 0 and 1 (typically 1e-5)';
    }
    return true;
  }
}
