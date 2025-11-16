/**
 * Cohort definition and extraction utilities
 */

import { OMOPConnector } from '../connectors/base';
import type { CohortDefinition, InclusionRule, ObservationWindow } from '../types';

/**
 * Result of cohort building operation
 */
export interface CohortResult {
  cohortId: number;
  personIds: number[];
  count: number;
  inclusionCounts: Map<number, number>; // ruleId -> count
  exclusionCounts: Map<number, number>; // ruleId -> count
}

/**
 * Build cohort based on definition
 */
export async function buildCohort(
  connector: OMOPConnector,
  definition: CohortDefinition
): Promise<CohortResult> {
  if (!connector.isConnected()) {
    throw new Error('Database connector is not connected');
  }

  // Validate cohort definition
  validateCohortDefinition(definition);

  const criteria = definition.definition;
  const inclusionCounts = new Map<number, number>();
  const exclusionCounts = new Map<number, number>();

  // Step 1: Find persons meeting inclusion criteria
  let candidatePersonIds = new Set<number>();

  for (let i = 0; i < criteria.inclusionRules.length; i++) {
    const rule = criteria.inclusionRules[i];
    const rulePersonIds = await findPersonsMatchingRule(connector, rule);
    inclusionCounts.set(rule.ruleId, rulePersonIds.length);

    if (i === 0) {
      // First rule: initialize candidate set
      candidatePersonIds = new Set(rulePersonIds);
    } else {
      // Subsequent rules: intersection (AND logic)
      candidatePersonIds = new Set(rulePersonIds.filter((id) => candidatePersonIds.has(id)));
    }
  }

  // Step 2: Apply exclusion criteria
  if (criteria.exclusionRules && criteria.exclusionRules.length > 0) {
    for (const rule of criteria.exclusionRules) {
      const excludedPersonIds = await findPersonsMatchingRule(
        connector,
        rule as unknown as InclusionRule
      );
      exclusionCounts.set(rule.ruleId, excludedPersonIds.length);

      // Remove excluded persons
      for (const personId of excludedPersonIds) {
        candidatePersonIds.delete(personId);
      }
    }
  }

  // Step 3: Apply observation window if specified
  if (criteria.observationWindow) {
    const filteredPersonIds = await filterByObservationWindow(
      connector,
      Array.from(candidatePersonIds),
      criteria.observationWindow
    );
    candidatePersonIds = new Set(filteredPersonIds);
  }

  const finalPersonIds = Array.from(candidatePersonIds).sort((a, b) => a - b);

  return {
    cohortId: definition.cohortId,
    personIds: finalPersonIds,
    count: finalPersonIds.length,
    inclusionCounts,
    exclusionCounts,
  };
}

/**
 * Validate cohort definition structure
 */
export function validateCohortDefinition(definition: CohortDefinition): void {
  if (!definition.cohortId || definition.cohortId <= 0) {
    throw new Error('Invalid cohort ID');
  }

  if (!definition.cohortName || definition.cohortName.trim() === '') {
    throw new Error('Cohort name is required');
  }

  const criteria = definition.definition;
  if (!criteria.inclusionRules || criteria.inclusionRules.length === 0) {
    throw new Error('At least one inclusion rule is required');
  }

  // Validate each inclusion rule
  for (const rule of criteria.inclusionRules) {
    if (!rule.conceptIds || rule.conceptIds.length === 0) {
      throw new Error(`Inclusion rule ${rule.ruleId} must have at least one concept ID`);
    }
    if (!rule.domains || rule.domains.length === 0) {
      throw new Error(`Inclusion rule ${rule.ruleId} must specify at least one domain`);
    }
  }

  // Validate exclusion rules if present
  if (criteria.exclusionRules) {
    for (const rule of criteria.exclusionRules) {
      if (!rule.conceptIds || rule.conceptIds.length === 0) {
        throw new Error(`Exclusion rule ${rule.ruleId} must have at least one concept ID`);
      }
      if (!rule.domains || rule.domains.length === 0) {
        throw new Error(`Exclusion rule ${rule.ruleId} must specify at least one domain`);
      }
    }
  }
}

/**
 * Find persons matching a specific rule
 */
async function findPersonsMatchingRule(
  connector: OMOPConnector,
  rule: InclusionRule
): Promise<number[]> {
  const conceptIdList = rule.conceptIds.join(',');
  const domainTables = rule.domains.map((domain) => getDomainTableName(domain));

  const queries: string[] = [];

  for (const tableName of domainTables) {
    let query = `
      SELECT DISTINCT person_id
      FROM ${connector['getQualifiedTableName'](tableName)}
      WHERE ${getConceptColumnName(tableName)} IN (${conceptIdList})
    `;

    // Add date range filter if specified
    if (rule.dateRange) {
      if (rule.dateRange.startDate) {
        const startDate = formatDate(rule.dateRange.startDate);
        query += ` AND ${getDateColumnName(tableName)} >= '${startDate}'`;
      }
      if (rule.dateRange.endDate) {
        const endDate = formatDate(rule.dateRange.endDate);
        query += ` AND ${getDateColumnName(tableName)} <= '${endDate}'`;
      }
    }

    queries.push(query);
  }

  // Union all queries from different domains
  const unionQuery = queries.join(' UNION ');

  let finalQuery = `SELECT person_id, COUNT(*) as occurrence_count FROM (${unionQuery}) AS combined GROUP BY person_id`;

  // Apply minimum occurrence filter if specified
  if (rule.minOccurrences && rule.minOccurrences > 1) {
    finalQuery += ` HAVING COUNT(*) >= ${rule.minOccurrences}`;
  }

  const result = await connector.query(finalQuery);
  return result.rows.map((row) => row.person_id as number);
}

/**
 * Filter persons by observation window
 */
async function filterByObservationWindow(
  connector: OMOPConnector,
  personIds: number[],
  window: ObservationWindow
): Promise<number[]> {
  if (personIds.length === 0) {
    return [];
  }

  const personIdList = personIds.join(',');

  // Find persons with sufficient observation period
  const query = `
    SELECT DISTINCT person_id
    FROM ${connector['getQualifiedTableName']('observation_period')}
    WHERE person_id IN (${personIdList})
      AND DATEDIFF(day, observation_period_start_date, observation_period_end_date) >= ${window.priorDays + window.postDays}
  `;

  const result = await connector.query(query);
  return result.rows.map((row) => row.person_id as number);
}

/**
 * Get OMOP table name for domain
 */
function getDomainTableName(domain: string): string {
  const tableMap: Record<string, string> = {
    Condition: 'condition_occurrence',
    Drug: 'drug_exposure',
    Procedure: 'procedure_occurrence',
    Measurement: 'measurement',
    Observation: 'observation',
    Device: 'device_exposure',
  };

  const tableName = tableMap[domain];
  if (!tableName) {
    throw new Error(`Unknown domain: ${domain}`);
  }
  return tableName;
}

/**
 * Get concept column name for table
 */
function getConceptColumnName(tableName: string): string {
  const columnMap: Record<string, string> = {
    condition_occurrence: 'condition_concept_id',
    drug_exposure: 'drug_concept_id',
    procedure_occurrence: 'procedure_concept_id',
    measurement: 'measurement_concept_id',
    observation: 'observation_concept_id',
    device_exposure: 'device_concept_id',
  };

  const columnName = columnMap[tableName];
  if (!columnName) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return columnName;
}

/**
 * Get date column name for table
 */
function getDateColumnName(tableName: string): string {
  const columnMap: Record<string, string> = {
    condition_occurrence: 'condition_start_date',
    drug_exposure: 'drug_exposure_start_date',
    procedure_occurrence: 'procedure_date',
    measurement: 'measurement_date',
    observation: 'observation_date',
    device_exposure: 'device_exposure_start_date',
  };

  const columnName = columnMap[tableName];
  if (!columnName) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return columnName;
}

/**
 * Format date to SQL string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
