/**
 * Tests for privacy budget management
 */

import {
  createPrivacyBudget,
  isBudgetExhausted,
  canPerformQuery,
  consumeBudget,
  epsilonPerQuery,
  deltaPerQuery,
  createRoundConfig,
} from './budget';

describe('Privacy Budget Management', () => {
  describe('createPrivacyBudget', () => {
    it('should create budget with correct values', () => {
      const budget = createPrivacyBudget(10.0, 1e-5, 100);

      expect(budget.totalEpsilon).toBe(10.0);
      expect(budget.totalDelta).toBe(1e-5);
      expect(budget.remainingEpsilon).toBe(10.0);
      expect(budget.remainingDelta).toBe(0);
      expect(budget.maxQueries).toBe(100);
    });

    it('should throw error for invalid epsilon', () => {
      expect(() => createPrivacyBudget(0, 1e-5)).toThrow();
      expect(() => createPrivacyBudget(-1, 1e-5)).toThrow();
    });

    it('should throw error for invalid delta', () => {
      expect(() => createPrivacyBudget(10, -1)).toThrow();
      expect(() => createPrivacyBudget(10, 1.0)).toThrow();
    });
  });

  describe('isBudgetExhausted', () => {
    it('should return false for fresh budget', () => {
      const budget = createPrivacyBudget(10.0, 1e-5, 100);
      expect(isBudgetExhausted(budget)).toBe(false);
    });

    it('should return true when epsilon is exhausted', () => {
      const budget = createPrivacyBudget(1.0, 1e-5, 100);
      budget.remainingEpsilon = 0;
      expect(isBudgetExhausted(budget)).toBe(true);
    });

    it('should return true when queries are exhausted', () => {
      const budget = createPrivacyBudget(10.0, 1e-5, 10);
      budget.queriesExecuted = 10;
      expect(isBudgetExhausted(budget)).toBe(true);
    });
  });

  describe('canPerformQuery', () => {
    it('should allow query within budget', () => {
      const budget = createPrivacyBudget(10.0, 1e-5, 100);
      expect(canPerformQuery(budget, 1.0, 1e-6)).toBe(true);
    });

    it('should reject query exceeding epsilon budget', () => {
      const budget = createPrivacyBudget(1.0, 1e-5, 100);
      expect(canPerformQuery(budget, 2.0, 1e-6)).toBe(false);
    });
  });

  describe('consumeBudget', () => {
    it('should consume budget correctly', () => {
      const budget = createPrivacyBudget(10.0, 1e-5, 100);
      consumeBudget(budget, 1.0, 1e-6);

      expect(budget.remainingEpsilon).toBe(9.0);
      expect(budget.remainingDelta).toBe(1e-6);
      expect(budget.queriesExecuted).toBe(1);
    });

    it('should throw error when budget is insufficient', () => {
      const budget = createPrivacyBudget(1.0, 1e-5, 100);
      expect(() => consumeBudget(budget, 2.0, 1e-6)).toThrow();
    });
  });

  describe('epsilonPerQuery', () => {
    it('should calculate epsilon per query', () => {
      const epsilon = epsilonPerQuery(10.0, 5);
      expect(epsilon).toBe(2.0);
    });
  });

  describe('deltaPerQuery', () => {
    it('should calculate delta per query', () => {
      const delta = deltaPerQuery(1e-5, 10);
      expect(delta).toBeCloseTo(1e-6, 10);
    });
  });

  describe('createRoundConfig', () => {
    it('should create config for single round', () => {
      const budget = createPrivacyBudget(10.0, 1e-5, 10);
      const config = createRoundConfig(budget, 10, 1.0);

      expect(config.epsilon).toBe(1.0);
      expect(config.delta).toBeCloseTo(1e-6, 10);
      expect(config.clipNorm).toBe(1.0);
      expect(config.mechanism).toBe('gaussian');
    });
  });
});
