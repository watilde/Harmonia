import {
  applyIncrementalUpdate,
  updateMovingAverage,
  detectCatastrophicForgetting,
} from './incremental';

describe('Incremental Learning', () => {
  it('should interpolate between current and update weights', () => {
    const current = [new Float32Array([1, 2, 3])];
    const update = [new Float32Array([4, 5, 6])];

    const result = applyIncrementalUpdate(current, update, 0.5, 1.0);

    expect(result).toHaveLength(1);
    expect(Array.from(result[0])).toEqual([2.5, 3.5, 4.5]);
  });

  it('should apply staleness weight', () => {
    const current = [new Float32Array([0, 0])];
    const update = [new Float32Array([10, 10])];

    const result = applyIncrementalUpdate(current, update, 0.5, 0.5);

    expect(Array.from(result[0])).toEqual([2.5, 2.5]);
  });

  it('should calculate EMA correctly', () => {
    expect(updateMovingAverage(10, 20, 0.5)).toBe(15);
    expect(updateMovingAverage(0, 10, 0.1)).toBe(1);
  });

  it('should detect significant loss increase', () => {
    const result = detectCatastrophicForgetting(1.0, 2.0, 0.5);

    expect(result.forgetting).toBe(true);
    expect(result.lossIncrease).toBe(1.0);
  });

  it('should not detect normal fluctuation', () => {
    const result = detectCatastrophicForgetting(1.0, 1.1, 0.5);

    expect(result.forgetting).toBe(false);
    expect(result.lossIncrease).toBeCloseTo(0.1, 2);
  });
});
