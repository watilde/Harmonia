/**
 * Tests for Validator utility
 */

import { Validator } from './../utils/validation';

describe('Validator', () => {
  describe('validateGitHubRepo', () => {
    it('should accept valid repository format', () => {
      expect(Validator.validateGitHubRepo('owner/repo')).toBe(true);
      expect(Validator.validateGitHubRepo('my-org/my-repo')).toBe(true);
      expect(Validator.validateGitHubRepo('org_name/repo_name')).toBe(true);
    });

    it('should reject invalid repository format', () => {
      expect(Validator.validateGitHubRepo('invalid')).toBe(false);
      expect(Validator.validateGitHubRepo('owner/repo/extra')).toBe(false);
      expect(Validator.validateGitHubRepo('')).toBe(false);
      expect(Validator.validateGitHubRepo('owner/')).toBe(false);
      expect(Validator.validateGitHubRepo('/repo')).toBe(false);
    });
  });

  describe('validateSiteId', () => {
    it('should accept valid site IDs', () => {
      expect(Validator.validateSiteId('site-a')).toBe(true);
      expect(Validator.validateSiteId('site123')).toBe(true);
      expect(Validator.validateSiteId('my-site-1')).toBe(true);
    });

    it('should reject invalid site IDs', () => {
      expect(Validator.validateSiteId('Site-A')).toBe(false); // uppercase
      expect(Validator.validateSiteId('site_1')).toBe(false); // underscore
      expect(Validator.validateSiteId('site 1')).toBe(false); // space
      expect(Validator.validateSiteId('')).toBe(false);
    });

    it('should provide correct error messages', () => {
      expect(Validator.getSiteIdError('')).toBe('Site ID is required');
      // 'AB' has uppercase, so it should fail validation first
      expect(Validator.getSiteIdError('AB')).toBe(
        'Site ID must be lowercase alphanumeric with hyphens'
      );
      // Check length with valid format
      expect(Validator.getSiteIdError('ab')).toBe('Site ID must be at least 3 characters');
      expect(Validator.getSiteIdError('Site_1')).toBe(
        'Site ID must be lowercase alphanumeric with hyphens'
      );
      expect(Validator.getSiteIdError('valid-site')).toBe(true);
    });
  });

  describe('validateStudyId', () => {
    it('should accept valid study IDs', () => {
      expect(Validator.validateStudyId('cvd-study')).toBe(true);
      expect(Validator.validateStudyId('study-123')).toBe(true);
      expect(Validator.validateStudyId('my-study')).toBe(true);
    });

    it('should reject invalid study IDs', () => {
      expect(Validator.validateStudyId('Study-1')).toBe(false); // uppercase
      expect(Validator.validateStudyId('study_1')).toBe(false); // underscore
      expect(Validator.validateStudyId('')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(Validator.validateEmail('user@example.com')).toBe(true);
      expect(Validator.validateEmail('test.user@domain.org')).toBe(true);
      expect(Validator.validateEmail('admin+tag@company.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(Validator.validateEmail('invalid')).toBe(false);
      expect(Validator.validateEmail('user@')).toBe(false);
      expect(Validator.validateEmail('@domain.com')).toBe(false);
      expect(Validator.validateEmail('user domain.com')).toBe(false);
      expect(Validator.validateEmail('')).toBe(false);
    });
  });

  describe('validatePort', () => {
    it('should accept valid port numbers', () => {
      expect(Validator.validatePort(80)).toBe(true);
      expect(Validator.validatePort(443)).toBe(true);
      expect(Validator.validatePort(5432)).toBe(true);
      expect(Validator.validatePort(65535)).toBe(true);
    });

    it('should reject invalid port numbers', () => {
      expect(Validator.validatePort(0)).toBe(false);
      expect(Validator.validatePort(-1)).toBe(false);
      expect(Validator.validatePort(65536)).toBe(false);
      expect(Validator.validatePort(3.14)).toBe(false);
    });
  });

  describe('validateEpsilon', () => {
    it('should accept valid epsilon values', () => {
      expect(Validator.validateEpsilon(1.0)).toBe(true);
      expect(Validator.validateEpsilon(5.0)).toBe(true);
      expect(Validator.validateEpsilon(10.0)).toBe(true);
      expect(Validator.validateEpsilon(0.1)).toBe(true);
    });

    it('should reject invalid epsilon values', () => {
      expect(Validator.validateEpsilon(0)).toBe(false);
      expect(Validator.validateEpsilon(-1)).toBe(false);
      expect(Validator.validateEpsilon(11)).toBe(false);
    });
  });

  describe('validateDelta', () => {
    it('should accept valid delta values', () => {
      expect(Validator.validateDelta(1e-5)).toBe(true);
      expect(Validator.validateDelta(0.1)).toBe(true);
      expect(Validator.validateDelta(0.001)).toBe(true);
    });

    it('should reject invalid delta values', () => {
      expect(Validator.validateDelta(0)).toBe(false);
      expect(Validator.validateDelta(1)).toBe(false);
      expect(Validator.validateDelta(1.5)).toBe(false);
      expect(Validator.validateDelta(-0.1)).toBe(false);
    });
  });

  describe('validatePositiveNumber', () => {
    it('should accept positive numbers', () => {
      expect(Validator.validatePositiveNumber(1)).toBe(true);
      expect(Validator.validatePositiveNumber(100)).toBe(true);
      expect(Validator.validatePositiveNumber(0.1)).toBe(true);
    });

    it('should reject non-positive numbers', () => {
      expect(Validator.validatePositiveNumber(0)).toBe(false);
      expect(Validator.validatePositiveNumber(-1)).toBe(false);
      expect(Validator.validatePositiveNumber(NaN)).toBe(false);
    });
  });

  describe('validateNonEmpty', () => {
    it('should accept non-empty strings', () => {
      expect(Validator.validateNonEmpty('hello')).toBe(true);
      expect(Validator.validateNonEmpty('a')).toBe(true);
      expect(Validator.validateNonEmpty('  text  ')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(Validator.validateNonEmpty('')).toBe(false);
      expect(Validator.validateNonEmpty('   ')).toBe(false);
    });
  });

  describe('sanitizeForFilesystem', () => {
    it('should convert to lowercase and replace invalid chars', () => {
      expect(Validator.sanitizeForFilesystem('My Study Name')).toBe('my-study-name');
      expect(Validator.sanitizeForFilesystem('Test@Study#1')).toBe('test-study-1');
      expect(Validator.sanitizeForFilesystem('CVD_Risk/Study')).toBe('cvd-risk-study');
    });

    it('should handle edge cases', () => {
      expect(Validator.sanitizeForFilesystem('---test---')).toBe('---test---');
      expect(Validator.sanitizeForFilesystem('123')).toBe('123');
    });
  });
});
