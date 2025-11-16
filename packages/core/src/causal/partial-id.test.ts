import { computeATEBounds, checkCoverage, formatBounds, type CausalDataPoint } from './partial-id';

describe('Partial Identification', () => {
  describe('computeATEBounds', () => {
    it('should compute worst-case bounds', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.8 },
        { treatment: 1, outcome: 0.7 },
        { treatment: 0, outcome: 0.5 },
        { treatment: 0, outcome: 0.6 },
      ];

      const bounds = computeATEBounds(data, { assumption: 'worst-case' });

      expect(bounds.assumption).toBe('worst-case');
      expect(bounds.lower).toBe(0.75 - 1); // E[Y|T=1] - 1 = 0.75 - 1 = -0.25
      expect(bounds.upper).toBe(0.75 - 0); // E[Y|T=1] - 0 = 0.75
      expect(bounds.width).toBe(1.0); // Full width for worst-case
      expect(bounds.sampleSize).toBe(4);
    });

    it('should compute MTR bounds', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.8 },
        { treatment: 1, outcome: 0.7 },
        { treatment: 0, outcome: 0.5 },
        { treatment: 0, outcome: 0.6 },
      ];

      const bounds = computeATEBounds(data, { assumption: 'mtr' });

      expect(bounds.assumption).toBe('mtr');
      expect(bounds.lower).toBeCloseTo(0.75 - 0.55, 5); // E[Y|T=1] - E[Y|T=0]
      expect(bounds.upper).toBeCloseTo(0.75 - 0, 5); // min(1, E[Y|T=1]) - 0
      expect(bounds.width).toBeCloseTo(0.55, 5);
    });

    it('should compute MTS bounds', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.8 },
        { treatment: 1, outcome: 0.7 },
        { treatment: 0, outcome: 0.5 },
        { treatment: 0, outcome: 0.6 },
      ];

      const bounds = computeATEBounds(data, { assumption: 'mts' });

      expect(bounds.assumption).toBe('mts');
      expect(bounds.lower).toBeCloseTo(0.75 - 1, 5); // E[Y|T=1] - 1
      expect(bounds.upper).toBeCloseTo(0.55 - 0, 5); // E[Y|T=0] - 0
      expect(bounds.width).toBeCloseTo(0.8, 5);
    });

    it('should compute MTR+MTS bounds', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.8 },
        { treatment: 1, outcome: 0.7 },
        { treatment: 0, outcome: 0.5 },
        { treatment: 0, outcome: 0.6 },
      ];

      const bounds = computeATEBounds(data, { assumption: 'mtr-mts' });

      expect(bounds.assumption).toBe('mtr-mts');
      expect(bounds.lower).toBeCloseTo(0.75 - 0.55, 5); // E[Y|T=1] - E[Y|T=0]
      expect(bounds.upper).toBeCloseTo(0.55 - 0, 5); // E[Y|T=0] - 0
      expect(bounds.width).toBeCloseTo(0.35, 5); // Tightest bounds
    });

    it('should handle weighted data', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.8, weight: 2 },
        { treatment: 1, outcome: 0.4, weight: 1 },
        { treatment: 0, outcome: 0.6, weight: 1 },
        { treatment: 0, outcome: 0.3, weight: 2 },
      ];

      const bounds = computeATEBounds(data, { assumption: 'mtr' });

      // Weighted means: treated = (0.8*2 + 0.4*1)/3 = 2.0/3 ≈ 0.667
      //                 control = (0.6*1 + 0.3*2)/3 = 1.2/3 = 0.4
      expect(bounds.lower).toBeCloseTo(0.667 - 0.4, 2);
      expect(bounds.upper).toBeCloseTo(0.667 - 0, 2);
    });

    it('should use custom outcome range', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 80 },
        { treatment: 1, outcome: 70 },
        { treatment: 0, outcome: 50 },
        { treatment: 0, outcome: 60 },
      ];

      const bounds = computeATEBounds(data, {
        assumption: 'worst-case',
        yMin: 0,
        yMax: 100,
      });

      expect(bounds.lower).toBe(75 - 100); // E[Y|T=1] - 100
      expect(bounds.upper).toBe(75 - 0); // E[Y|T=1] - 0
      expect(bounds.width).toBe(100);
    });

    it('should throw error for empty data', () => {
      expect(() => computeATEBounds([])).toThrow('Data cannot be empty');
    });

    it('should throw error for data without treated observations', () => {
      const data: CausalDataPoint[] = [
        { treatment: 0, outcome: 0.5 },
        { treatment: 0, outcome: 0.6 },
      ];

      expect(() => computeATEBounds(data)).toThrow(
        'Data must contain both treated and control observations'
      );
    });

    it('should throw error for data without control observations', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.5 },
        { treatment: 1, outcome: 0.6 },
      ];

      expect(() => computeATEBounds(data)).toThrow(
        'Data must contain both treated and control observations'
      );
    });

    it('should throw error for invalid yMin/yMax', () => {
      const data: CausalDataPoint[] = [
        { treatment: 1, outcome: 0.5 },
        { treatment: 0, outcome: 0.6 },
      ];

      expect(() => computeATEBounds(data, { yMin: 1, yMax: 0 })).toThrow(
        'yMin must be less than yMax'
      );
    });
  });

  describe('checkCoverage', () => {
    it('should return true when true ATE is inside bounds', () => {
      const bounds = {
        lower: 0.1,
        upper: 0.3,
        width: 0.2,
        assumption: 'mtr' as const,
        sampleSize: 100,
      };

      expect(checkCoverage(bounds, 0.15)).toBe(true);
      expect(checkCoverage(bounds, 0.1)).toBe(true); // At boundary
      expect(checkCoverage(bounds, 0.3)).toBe(true); // At boundary
    });

    it('should return false when true ATE is outside bounds', () => {
      const bounds = {
        lower: 0.1,
        upper: 0.3,
        width: 0.2,
        assumption: 'mtr' as const,
        sampleSize: 100,
      };

      expect(checkCoverage(bounds, 0.05)).toBe(false);
      expect(checkCoverage(bounds, 0.35)).toBe(false);
    });
  });

  describe('formatBounds', () => {
    it('should format bounds with default decimals', () => {
      const bounds = {
        lower: 0.123456,
        upper: 0.654321,
        width: 0.530865,
        assumption: 'mtr' as const,
        sampleSize: 100,
      };

      const formatted = formatBounds(bounds);
      expect(formatted).toBe('ATE ∈ [0.123, 0.654] (width=0.531, n=100, assumption=mtr)');
    });

    it('should format bounds with custom decimals', () => {
      const bounds = {
        lower: 0.123456,
        upper: 0.654321,
        width: 0.530865,
        assumption: 'worst-case' as const,
        sampleSize: 50,
      };

      const formatted = formatBounds(bounds, 2);
      expect(formatted).toBe('ATE ∈ [0.12, 0.65] (width=0.53, n=50, assumption=worst-case)');
    });
  });

  describe('Real-world scenario', () => {
    it('should compute bounds for diabetes medication study', () => {
      // Simulated data: New drug vs standard care
      // Outcome: HbA1c < 7% (binary)
      const data: CausalDataPoint[] = [
        // Treated (new drug): higher success rate
        ...Array(60).fill({ treatment: 1, outcome: 1 }),
        ...Array(40).fill({ treatment: 1, outcome: 0 }),
        // Control (standard): lower success rate
        ...Array(45).fill({ treatment: 0, outcome: 1 }),
        ...Array(55).fill({ treatment: 0, outcome: 0 }),
      ];

      const bounds = computeATEBounds(data, { assumption: 'mtr' });

      // Treated mean: 60/100 = 0.6
      // Control mean: 45/100 = 0.45
      // Lower bound: 0.6 - 0.45 = 0.15
      // Upper bound: min(1, 0.6) - 0 = 0.6
      expect(bounds.lower).toBeCloseTo(0.15, 2);
      expect(bounds.upper).toBeCloseTo(0.6, 2);
      expect(bounds.width).toBeCloseTo(0.45, 2);

      // Check if true ATE of 0.15 is covered
      expect(checkCoverage(bounds, 0.15)).toBe(true);
    });
  });
});
