/**
 * Tests for Cohort Builder
 */

import { buildCohort, validateCohortDefinition } from './index';
import type { CohortDefinition } from './../types';
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
    // Simple mock: return predefined data based on query patterns
    let rows: Record<string, unknown>[] = [];

    if (sql.includes('condition_occurrence')) {
      rows = this.mockData.get('condition') || [];
    } else if (sql.includes('drug_exposure')) {
      rows = this.mockData.get('drug') || [];
    } else if (sql.includes('observation_period')) {
      rows = this.mockData.get('observation') || [];
    } else {
      return { rows: [], rowCount: 0 };
    }

    // Handle HAVING clause for minOccurrences filter
    const havingMatch = sql.match(/HAVING\s+COUNT\(\*\)\s*>=\s*(\d+)/i);
    if (havingMatch) {
      const minCount = parseInt(havingMatch[1], 10);
      rows = rows.filter((row) => {
        const occurrenceCount = row.occurrence_count as number;
        return occurrenceCount >= minCount;
      });
    }

    return {
      rows,
      rowCount: rows.length,
    };
  }

  setMockData(key: string, data: Record<string, unknown>[]): void {
    this.mockData.set(key, data);
  }
}

describe('Cohort Builder', () => {
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

  describe('validateCohortDefinition', () => {
    it('should validate correct cohort definition', () => {
      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Test Cohort',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Diabetes patients',
              conceptIds: [201826], // Type 2 Diabetes
              domains: ['Condition'],
            },
          ],
        },
      };

      expect(() => validateCohortDefinition(definition)).not.toThrow();
    });

    it('should throw on invalid cohort ID', () => {
      const definition: CohortDefinition = {
        cohortId: 0,
        cohortName: 'Test',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Test',
              conceptIds: [123],
              domains: ['Condition'],
            },
          ],
        },
      };

      expect(() => validateCohortDefinition(definition)).toThrow('Invalid cohort ID');
    });

    it('should throw on empty cohort name', () => {
      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: '',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Test',
              conceptIds: [123],
              domains: ['Condition'],
            },
          ],
        },
      };

      expect(() => validateCohortDefinition(definition)).toThrow('Cohort name is required');
    });

    it('should throw on no inclusion rules', () => {
      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Test',
        definition: {
          inclusionRules: [],
        },
      };

      expect(() => validateCohortDefinition(definition)).toThrow(
        'At least one inclusion rule is required'
      );
    });

    it('should throw on inclusion rule without concepts', () => {
      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Test',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Test',
              conceptIds: [],
              domains: ['Condition'],
            },
          ],
        },
      };

      expect(() => validateCohortDefinition(definition)).toThrow(
        'must have at least one concept ID'
      );
    });

    it('should throw on inclusion rule without domains', () => {
      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Test',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Test',
              conceptIds: [123],
              domains: [],
            },
          ],
        },
      };

      expect(() => validateCohortDefinition(definition)).toThrow(
        'must specify at least one domain'
      );
    });
  });

  describe('buildCohort', () => {
    it('should throw if connector is not connected', async () => {
      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Test',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Test',
              conceptIds: [123],
              domains: ['Condition'],
            },
          ],
        },
      };

      await expect(buildCohort(connector, definition)).rejects.toThrow(
        'Database connector is not connected'
      );
    });

    it('should build cohort with single inclusion rule', async () => {
      await connector.connect();

      // Mock data: patients with diabetes
      connector.setMockData('condition', [
        { person_id: 1, occurrence_count: 1 },
        { person_id: 2, occurrence_count: 1 },
        { person_id: 3, occurrence_count: 2 },
      ]);

      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Diabetes Cohort',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Diabetes',
              conceptIds: [201826],
              domains: ['Condition'],
            },
          ],
        },
      };

      const result = await buildCohort(connector, definition);

      expect(result.cohortId).toBe(1);
      expect(result.personIds).toEqual([1, 2, 3]);
      expect(result.count).toBe(3);
      expect(result.inclusionCounts.get(1)).toBe(3);
    });

    it('should apply minimum occurrence filter', async () => {
      await connector.connect();

      // Mock data with varying occurrence counts
      connector.setMockData('condition', [
        { person_id: 1, occurrence_count: 1 },
        { person_id: 2, occurrence_count: 2 },
        { person_id: 3, occurrence_count: 3 },
      ]);

      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Frequent Diabetes',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Diabetes',
              conceptIds: [201826],
              domains: ['Condition'],
              minOccurrences: 2,
            },
          ],
        },
      };

      const result = await buildCohort(connector, definition);

      // Only patients 2 and 3 have >= 2 occurrences
      expect(result.personIds).toEqual([2, 3]);
      expect(result.count).toBe(2);
    });

    it('should handle empty result', async () => {
      await connector.connect();

      connector.setMockData('condition', []);

      const definition: CohortDefinition = {
        cohortId: 1,
        cohortName: 'Empty Cohort',
        definition: {
          inclusionRules: [
            {
              ruleId: 1,
              name: 'Rare Condition',
              conceptIds: [999999],
              domains: ['Condition'],
            },
          ],
        },
      };

      const result = await buildCohort(connector, definition);

      expect(result.personIds).toEqual([]);
      expect(result.count).toBe(0);
    });
  });
});
