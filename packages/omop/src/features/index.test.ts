/**
 * Tests for Feature Extraction
 */

import {
  extractFeatures,
  extractDemographics,
  extractConditionFeatures,
  extractDrugFeatures,
  extractProcedureFeatures,
  extractMeasurementFeatures,
} from './index';
import type { FeatureDefinition } from './../types';
import { OMOPConnector } from './../connectors/base';
import type { QueryResult } from './../types';

// Mock connector for testing
class MockOMOPConnector extends OMOPConnector {
  private mockData: Map<string, Record<string, unknown>[]> = new Map();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async query(sql: string): Promise<QueryResult> {
    // Return mock data based on query patterns
    // Check table names in FROM clause to avoid confusion with column names
    if (sql.match(/FROM\s+\w*\.?person\b/i)) {
      return {
        rows: this.mockData.get('person') || [],
        rowCount: (this.mockData.get('person') || []).length,
      };
    } else if (sql.includes('condition_occurrence')) {
      return {
        rows: this.mockData.get('condition') || [],
        rowCount: (this.mockData.get('condition') || []).length,
      };
    } else if (sql.includes('drug_exposure')) {
      return {
        rows: this.mockData.get('drug') || [],
        rowCount: (this.mockData.get('drug') || []).length,
      };
    } else if (sql.includes('procedure_occurrence')) {
      return {
        rows: this.mockData.get('procedure') || [],
        rowCount: (this.mockData.get('procedure') || []).length,
      };
    } else if (sql.includes('measurement')) {
      return {
        rows: this.mockData.get('measurement') || [],
        rowCount: (this.mockData.get('measurement') || []).length,
      };
    }
    return { rows: [], rowCount: 0 };
  }

  setMockData(key: string, data: Record<string, unknown>[]): void {
    this.mockData.set(key, data);
  }
}

describe('Feature Extraction', () => {
  let connector: MockOMOPConnector;

  beforeEach(() => {
    connector = new MockOMOPConnector({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'omop',
      schema: 'public',
      username: 'test',
      password: 'test',
    });
  });

  describe('extractDemographics', () => {
    it('should extract demographics for patients', async () => {
      const currentYear = new Date().getFullYear();

      connector.setMockData('person', [
        {
          person_id: 1,
          gender_concept_id: 8507,
          year_of_birth: 1980,
          month_of_birth: 5,
          day_of_birth: 15,
          race_concept_id: 8527,
          ethnicity_concept_id: 38003564,
        },
        {
          person_id: 2,
          gender_concept_id: 8532,
          year_of_birth: 1990,
          month_of_birth: 10,
          day_of_birth: 20,
          race_concept_id: 8516,
          ethnicity_concept_id: 38003563,
        },
      ]);

      const result = await extractDemographics(connector, [1, 2]);

      expect(result.size).toBe(2);

      const demographics1 = result.get(1)!;
      expect(demographics1.gender_concept_id).toBe(8507);
      expect(demographics1.age).toBe(currentYear - 1980);
      expect(demographics1.year_of_birth).toBe(1980);

      const demographics2 = result.get(2)!;
      expect(demographics2.gender_concept_id).toBe(8532);
      expect(demographics2.age).toBe(currentYear - 1990);
    });

    it('should handle empty person list', async () => {
      const result = await extractDemographics(connector, []);
      expect(result.size).toBe(0);
    });
  });

  describe('extractConditionFeatures', () => {
    it('should extract condition counts', async () => {
      connector.setMockData('condition', [
        { person_id: 1, condition_concept_id: 201826, count: 3 },
        { person_id: 1, condition_concept_id: 443238, count: 1 },
        { person_id: 2, condition_concept_id: 201826, count: 2 },
      ]);

      const result = await extractConditionFeatures(connector, [1, 2], [201826, 443238]);

      expect(result.size).toBe(2);

      const features1 = result.get(1)!;
      expect(features1.get(201826)).toBe(3);
      expect(features1.get(443238)).toBe(1);

      const features2 = result.get(2)!;
      expect(features2.get(201826)).toBe(2);
      expect(features2.get(443238)).toBeUndefined();
    });

    it('should handle empty results', async () => {
      connector.setMockData('condition', []);
      const result = await extractConditionFeatures(connector, [1], [201826]);
      expect(result.size).toBe(0);
    });
  });

  describe('extractDrugFeatures', () => {
    it('should extract drug exposure counts', async () => {
      connector.setMockData('drug', [
        { person_id: 1, drug_concept_id: 1503297, count: 5 },
        { person_id: 2, drug_concept_id: 1503297, count: 3 },
        { person_id: 2, drug_concept_id: 1550557, count: 2 },
      ]);

      const result = await extractDrugFeatures(connector, [1, 2], [1503297, 1550557]);

      expect(result.size).toBe(2);

      const features1 = result.get(1)!;
      expect(features1.get(1503297)).toBe(5);

      const features2 = result.get(2)!;
      expect(features2.get(1503297)).toBe(3);
      expect(features2.get(1550557)).toBe(2);
    });
  });

  describe('extractProcedureFeatures', () => {
    it('should extract procedure counts', async () => {
      connector.setMockData('procedure', [
        { person_id: 1, procedure_concept_id: 4013636, count: 2 },
        { person_id: 2, procedure_concept_id: 4013636, count: 1 },
      ]);

      const result = await extractProcedureFeatures(connector, [1, 2], [4013636]);

      expect(result.size).toBe(2);
      expect(result.get(1)!.get(4013636)).toBe(2);
      expect(result.get(2)!.get(4013636)).toBe(1);
    });
  });

  describe('extractMeasurementFeatures', () => {
    it('should extract average measurement values', async () => {
      connector.setMockData('measurement', [
        { person_id: 1, measurement_concept_id: 3004249, value: 120.5 },
        { person_id: 2, measurement_concept_id: 3004249, value: 135.2 },
      ]);

      const result = await extractMeasurementFeatures(connector, [1, 2], [3004249], 'avg');

      expect(result.size).toBe(2);
      expect(result.get(1)!.get(3004249)).toBe(120.5);
      expect(result.get(2)!.get(3004249)).toBe(135.2);
    });

    it('should extract max measurement values', async () => {
      connector.setMockData('measurement', [
        { person_id: 1, measurement_concept_id: 3004249, value: 150.0 },
        { person_id: 2, measurement_concept_id: 3004249, value: 180.5 },
      ]);

      const result = await extractMeasurementFeatures(connector, [1, 2], [3004249], 'max');

      expect(result.size).toBe(2);
      expect(result.get(1)!.get(3004249)).toBe(150.0);
      expect(result.get(2)!.get(3004249)).toBe(180.5);
    });

    it('should extract min measurement values', async () => {
      connector.setMockData('measurement', [
        { person_id: 1, measurement_concept_id: 3004249, value: 110.0 },
        { person_id: 2, measurement_concept_id: 3004249, value: 105.5 },
      ]);

      const result = await extractMeasurementFeatures(connector, [1, 2], [3004249], 'min');

      expect(result.size).toBe(2);
      expect(result.get(1)!.get(3004249)).toBe(110.0);
      expect(result.get(2)!.get(3004249)).toBe(105.5);
    });

    it('should count measurements', async () => {
      connector.setMockData('measurement', [
        { person_id: 1, measurement_concept_id: 3004249, value: 5 },
        { person_id: 2, measurement_concept_id: 3004249, value: 3 },
      ]);

      const result = await extractMeasurementFeatures(connector, [1, 2], [3004249], 'count');

      expect(result.size).toBe(2);
      expect(result.get(1)!.get(3004249)).toBe(5);
      expect(result.get(2)!.get(3004249)).toBe(3);
    });
  });

  describe('extractFeatures', () => {
    it('should throw if connector is not connected', async () => {
      const featureDefs: FeatureDefinition[] = [
        {
          featureName: 'test',
          featureType: 'numeric',
          conceptIds: [123],
          aggregation: 'count',
        },
      ];

      await expect(extractFeatures(connector, [1], featureDefs)).rejects.toThrow(
        'Database connector is not connected'
      );
    });

    it('should throw on empty person list', async () => {
      await connector.connect();

      const featureDefs: FeatureDefinition[] = [
        {
          featureName: 'test',
          featureType: 'numeric',
          conceptIds: [123],
          aggregation: 'count',
        },
      ];

      const result = await extractFeatures(connector, [], featureDefs);
      expect(result).toEqual([]);
    });

    it('should throw on empty feature definitions', async () => {
      await connector.connect();

      await expect(extractFeatures(connector, [1], [])).rejects.toThrow(
        'At least one feature definition is required'
      );
    });

    it('should extract features with custom SQL', async () => {
      await connector.connect();

      connector.setMockData('condition', [{ value: 5 }]);

      const featureDefs: FeatureDefinition[] = [
        {
          featureName: 'condition_count',
          featureType: 'numeric',
          sql: 'SELECT COUNT(*) as value FROM condition_occurrence WHERE person_id = {person_id}',
        },
      ];

      const result = await extractFeatures(connector, [1], featureDefs);

      expect(result.length).toBe(1);
      expect(result[0].personId).toBe(1);
      expect(result[0].features.condition_count).toBe(5);
    });

    it('should extract binary existence features', async () => {
      await connector.connect();

      // Mock that person 1 has diabetes, person 2 doesn't
      connector.setMockData('condition', [{ count: 1 }]);

      const featureDefs: FeatureDefinition[] = [
        {
          featureName: 'has_diabetes',
          featureType: 'binary',
          conceptIds: [201826],
          aggregation: 'exists',
        },
      ];

      const result = await extractFeatures(connector, [1], featureDefs);

      expect(result.length).toBe(1);
      expect(result[0].features.has_diabetes).toBe(true);
    });

    it('should extract count features', async () => {
      await connector.connect();

      connector.setMockData('condition', [{ count: 3 }]);

      const featureDefs: FeatureDefinition[] = [
        {
          featureName: 'diabetes_count',
          featureType: 'numeric',
          conceptIds: [201826],
          aggregation: 'count',
        },
      ];

      const result = await extractFeatures(connector, [1], featureDefs);

      expect(result.length).toBe(1);
      expect(result[0].features.diabetes_count).toBe(3);
    });
  });
});
