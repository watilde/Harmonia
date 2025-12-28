import {
  federateATEBounds,
  formatFederatedBounds,
  computeCommunicationCost,
  type SiteBounds,
} from './federated-agg';

describe('Federated Aggregation', () => {
  const sampleSiteBounds: SiteBounds[] = [
    {
      siteId: 'hospital-a',
      lower: 0.1,
      upper: 0.4,
      width: 0.3,
      assumption: 'mtr',
      sampleSize: 100,
    },
    {
      siteId: 'hospital-b',
      lower: 0.15,
      upper: 0.35,
      width: 0.2,
      assumption: 'mtr',
      sampleSize: 150,
    },
    {
      siteId: 'hospital-c',
      lower: 0.05,
      upper: 0.45,
      width: 0.4,
      assumption: 'mtr',
      sampleSize: 50,
    },
  ];

  describe('federateATEBounds', () => {
    describe('weighted-average strategy', () => {
      it('should aggregate bounds using sample-size weights', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'weighted-average',
        });

        // Total n = 300
        // Weights: 100/300 = 0.333, 150/300 = 0.5, 50/300 = 0.167
        // Lower = 0.1*0.333 + 0.15*0.5 + 0.05*0.167 = 0.0333 + 0.075 + 0.00835 ≈ 0.117
        // Upper = 0.4*0.333 + 0.35*0.5 + 0.45*0.167 = 0.1332 + 0.175 + 0.07515 ≈ 0.383

        expect(federated.lower).toBeCloseTo(0.117, 2);
        expect(federated.upper).toBeCloseTo(0.383, 2);
        expect(federated.width).toBeCloseTo(0.266, 2);
        expect(federated.numSites).toBe(3);
        expect(federated.totalSampleSize).toBe(300);
        expect(federated.strategy).toBe('weighted-average');
      });
    });

    describe('conservative strategy', () => {
      it('should take min(LB) and max(UB)', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'conservative',
        });

        expect(federated.lower).toBe(0.05); // Min of [0.1, 0.15, 0.05]
        expect(federated.upper).toBe(0.45); // Max of [0.4, 0.35, 0.45]
        expect(federated.width).toBe(0.4);
        expect(federated.strategy).toBe('conservative');
      });
    });

    describe('uniform strategy', () => {
      it('should weight all sites equally', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'uniform',
        });

        // Lower = (0.1 + 0.15 + 0.05) / 3 = 0.3 / 3 = 0.1
        // Upper = (0.4 + 0.35 + 0.45) / 3 = 1.2 / 3 = 0.4
        expect(federated.lower).toBeCloseTo(0.1, 5);
        expect(federated.upper).toBeCloseTo(0.4, 5);
        expect(federated.width).toBeCloseTo(0.3, 5);
        expect(federated.strategy).toBe('uniform');
      });
    });

    describe('inverse-width strategy', () => {
      it('should weight by inverse of bound width', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'inverse-width',
        });

        // Widths: 0.3, 0.2, 0.4
        // Inverse: 1/0.3 = 3.333, 1/0.2 = 5, 1/0.4 = 2.5
        // Total: 10.833
        // Weights: 3.333/10.833 = 0.308, 5/10.833 = 0.462, 2.5/10.833 = 0.231
        // Lower = 0.1*0.308 + 0.15*0.462 + 0.05*0.231 ≈ 0.031 + 0.069 + 0.012 = 0.112
        // Upper = 0.4*0.308 + 0.35*0.462 + 0.45*0.231 ≈ 0.123 + 0.162 + 0.104 = 0.389

        expect(federated.lower).toBeCloseTo(0.112, 2);
        expect(federated.upper).toBeCloseTo(0.389, 2);
        expect(federated.strategy).toBe('inverse-width');
      });
    });

    describe('sqrt-n strategy', () => {
      it('should weight by square root of sample size', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'sqrt-n',
        });

        // Sample sizes: 100, 150, 50
        // Sqrt: 10, 12.247, 7.071
        // Total: 29.318
        // Weights: 10/29.318 = 0.341, 12.247/29.318 = 0.418, 7.071/29.318 = 0.241
        // Lower = 0.1*0.341 + 0.15*0.418 + 0.05*0.241 ≈ 0.034 + 0.063 + 0.012 = 0.109
        // Upper = 0.4*0.341 + 0.35*0.418 + 0.45*0.241 ≈ 0.136 + 0.146 + 0.108 = 0.390

        expect(federated.lower).toBeCloseTo(0.109, 2);
        expect(federated.upper).toBeCloseTo(0.390, 2);
        expect(federated.strategy).toBe('sqrt-n');
      });
    });

    describe('log-n strategy', () => {
      it('should weight by logarithm of sample size', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'log-n',
        });

        // Sample sizes: 100, 150, 50
        // Log: 4.605, 5.011, 3.912
        // Total: 13.528
        // Weights: 4.605/13.528 = 0.340, 5.011/13.528 = 0.370, 3.912/13.528 = 0.289
        // Lower = 0.1*0.340 + 0.15*0.370 + 0.05*0.289 ≈ 0.034 + 0.056 + 0.014 = 0.104
        // Upper = 0.4*0.340 + 0.35*0.370 + 0.45*0.289 ≈ 0.136 + 0.130 + 0.130 = 0.396

        expect(federated.lower).toBeCloseTo(0.104, 2);
        expect(federated.upper).toBeCloseTo(0.396, 2);
        expect(federated.strategy).toBe('log-n');
      });
    });

    describe('power strategy', () => {
      it('should weight by power of sample size with default alpha=0.5', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'power',
        });

        // With alpha=0.5, should be same as sqrt-n
        expect(federated.lower).toBeCloseTo(0.109, 2);
        expect(federated.upper).toBeCloseTo(0.390, 2);
        expect(federated.strategy).toBe('power');
      });

      it('should weight by power of sample size with custom alpha', () => {
        const federated = federateATEBounds(sampleSiteBounds, {
          strategy: 'power',
          alpha: 0.75,
        });

        // Sample sizes: 100, 150, 50
        // Power 0.75: 31.623, 43.968, 13.335
        // Total: 88.926
        // Weights: 31.623/88.926 = 0.356, 43.968/88.926 = 0.494, 13.335/88.926 = 0.150
        // Lower = 0.1*0.356 + 0.15*0.494 + 0.05*0.150 ≈ 0.036 + 0.074 + 0.008 = 0.118
        // Upper = 0.4*0.356 + 0.35*0.494 + 0.45*0.150 ≈ 0.142 + 0.173 + 0.068 = 0.383

        expect(federated.lower).toBeCloseTo(0.113, 2);
        expect(federated.upper).toBeCloseTo(0.386, 2);
        expect(federated.strategy).toBe('power');
      });
    });

    it('should preserve site bounds in result', () => {
      const federated = federateATEBounds(sampleSiteBounds);

      expect(federated.siteBounds).toHaveLength(3);
      expect(federated.siteBounds[0].siteId).toBe('hospital-a');
      expect(federated.siteBounds[1].siteId).toBe('hospital-b');
      expect(federated.siteBounds[2].siteId).toBe('hospital-c');
    });

    it('should throw error for empty site bounds', () => {
      expect(() => federateATEBounds([])).toThrow('Site bounds cannot be empty');
    });

    it('should throw error for insufficient sites', () => {
      const singleSite: SiteBounds[] = [
        {
          siteId: 'hospital-a',
          lower: 0.1,
          upper: 0.4,
          width: 0.3,
          assumption: 'mtr',
          sampleSize: 100,
        },
      ];

      expect(() => federateATEBounds(singleSite, { minSites: 2 })).toThrow(
        'At least 2 sites required, got 1'
      );
    });

    it('should throw error for mixed assumptions', () => {
      const mixedBounds: SiteBounds[] = [
        {
          siteId: 'hospital-a',
          lower: 0.1,
          upper: 0.4,
          width: 0.3,
          assumption: 'mtr',
          sampleSize: 100,
        },
        {
          siteId: 'hospital-b',
          lower: 0.0,
          upper: 0.5,
          width: 0.5,
          assumption: 'worst-case',
          sampleSize: 100,
        },
      ];

      expect(() => federateATEBounds(mixedBounds)).toThrow(
        'All sites must use the same assumption level'
      );
    });
  });

  describe('formatFederatedBounds', () => {
    it('should format federated bounds with default decimals', () => {
      const federated = federateATEBounds(sampleSiteBounds, {
        strategy: 'weighted-average',
      });

      const formatted = formatFederatedBounds(federated);

      expect(formatted).toContain('Federated ATE ∈');
      expect(formatted).toContain('width=');
      expect(formatted).toContain('3 sites');
      expect(formatted).toContain('n=300');
      expect(formatted).toContain('strategy=weighted-average');
    });

    it('should format with custom decimals', () => {
      const federated = federateATEBounds(sampleSiteBounds, {
        strategy: 'conservative',
      });

      const formatted = formatFederatedBounds(federated, 2);

      expect(formatted).toContain('[0.05, 0.45]');
      expect(formatted).toContain('width=0.40');
    });
  });

  describe('computeCommunicationCost', () => {
    it('should compute communication cost in bytes', () => {
      const cost = computeCommunicationCost(sampleSiteBounds);

      expect(cost.bytesPerSite).toBe(50); // 20 + 8 + 8 + 4 + 10
      expect(cost.totalBytes).toBe(150); // 50 * 3 sites
    });

    it('should scale with number of sites', () => {
      const manySites: SiteBounds[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          siteId: `site-${i}`,
          lower: 0.1,
          upper: 0.4,
          width: 0.3,
          assumption: 'mtr' as const,
          sampleSize: 100,
        }));

      const cost = computeCommunicationCost(manySites);

      expect(cost.bytesPerSite).toBe(50);
      expect(cost.totalBytes).toBe(500); // 50 * 10 sites
    });
  });

  describe('Multi-site scenario', () => {
    it('should aggregate bounds for diabetes study across 3 hospitals', () => {
      const diabetesBounds: SiteBounds[] = [
        {
          siteId: 'mayo-clinic',
          lower: 0.12,
          upper: 0.35,
          width: 0.23,
          assumption: 'mtr',
          sampleSize: 500,
        },
        {
          siteId: 'johns-hopkins',
          lower: 0.15,
          upper: 0.32,
          width: 0.17,
          assumption: 'mtr',
          sampleSize: 450,
        },
        {
          siteId: 'cleveland-clinic',
          lower: 0.1,
          upper: 0.38,
          width: 0.28,
          assumption: 'mtr',
          sampleSize: 300,
        },
      ];

      const federated = federateATEBounds(diabetesBounds, {
        strategy: 'weighted-average',
      });

      // Verify reasonable bounds
      expect(federated.lower).toBeGreaterThanOrEqual(0.1);
      expect(federated.lower).toBeLessThanOrEqual(0.15);
      expect(federated.upper).toBeGreaterThanOrEqual(0.32);
      expect(federated.upper).toBeLessThanOrEqual(0.38);
      expect(federated.width).toBeLessThan(0.3); // Tighter than worst site

      // Verify metadata
      expect(federated.numSites).toBe(3);
      expect(federated.totalSampleSize).toBe(1250);
      expect(federated.strategy).toBe('weighted-average');
    });
  });
});
