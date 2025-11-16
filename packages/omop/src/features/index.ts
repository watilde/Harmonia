/**
 * Feature extraction utilities from OMOP CDM
 */

import { OMOPConnector } from '../connectors/base';
import type { FeatureDefinition, PatientFeatures } from '../types';

/**
 * Extract features for a list of patients
 */
export async function extractFeatures(
  connector: OMOPConnector,
  personIds: number[],
  featureDefinitions: FeatureDefinition[],
  indexDate?: Date
): Promise<PatientFeatures[]> {
  if (!connector.isConnected()) {
    throw new Error('Database connector is not connected');
  }

  if (personIds.length === 0) {
    return [];
  }

  if (featureDefinitions.length === 0) {
    throw new Error('At least one feature definition is required');
  }

  // Use current date as index date if not specified
  const effectiveIndexDate = indexDate || new Date();

  const results: PatientFeatures[] = [];

  // Extract features for each person
  for (const personId of personIds) {
    const features: Record<string, number | string | boolean> = {};

    // Extract each feature
    for (const featureDef of featureDefinitions) {
      const featureValue = await extractSingleFeature(
        connector,
        personId,
        featureDef,
        effectiveIndexDate
      );
      features[featureDef.featureName] = featureValue;
    }

    results.push({
      personId,
      features,
      indexDate: effectiveIndexDate,
    });
  }

  return results;
}

/**
 * Extract demographics features for patients
 */
export async function extractDemographics(
  connector: OMOPConnector,
  personIds: number[]
): Promise<Map<number, Record<string, number | string>>> {
  if (personIds.length === 0) {
    return new Map();
  }

  const personIdList = personIds.join(',');

  const query = `
    SELECT 
      person_id,
      gender_concept_id,
      year_of_birth,
      month_of_birth,
      day_of_birth,
      race_concept_id,
      ethnicity_concept_id
    FROM ${connector['getQualifiedTableName']('person')}
    WHERE person_id IN (${personIdList})
  `;

  const result = await connector.query(query);

  const demographics = new Map<number, Record<string, number | string>>();

  for (const row of result.rows) {
    const personId = row.person_id as number;
    const currentYear = new Date().getFullYear();
    const yearOfBirth = row.year_of_birth as number;
    const age = currentYear - yearOfBirth;

    demographics.set(personId, {
      gender_concept_id: row.gender_concept_id as number,
      age,
      year_of_birth: yearOfBirth,
      race_concept_id: row.race_concept_id as number,
      ethnicity_concept_id: row.ethnicity_concept_id as number,
    });
  }

  return demographics;
}

/**
 * Extract condition features (diagnosis counts)
 */
export async function extractConditionFeatures(
  connector: OMOPConnector,
  personIds: number[],
  conceptIds: number[],
  timeWindowDays?: number
): Promise<Map<number, Map<number, number>>> {
  return await extractDomainFeatures(
    connector,
    personIds,
    conceptIds,
    'condition_occurrence',
    'condition_concept_id',
    'condition_start_date',
    timeWindowDays
  );
}

/**
 * Extract drug features (medication counts)
 */
export async function extractDrugFeatures(
  connector: OMOPConnector,
  personIds: number[],
  conceptIds: number[],
  timeWindowDays?: number
): Promise<Map<number, Map<number, number>>> {
  return await extractDomainFeatures(
    connector,
    personIds,
    conceptIds,
    'drug_exposure',
    'drug_concept_id',
    'drug_exposure_start_date',
    timeWindowDays
  );
}

/**
 * Extract procedure features (procedure counts)
 */
export async function extractProcedureFeatures(
  connector: OMOPConnector,
  personIds: number[],
  conceptIds: number[],
  timeWindowDays?: number
): Promise<Map<number, Map<number, number>>> {
  return await extractDomainFeatures(
    connector,
    personIds,
    conceptIds,
    'procedure_occurrence',
    'procedure_concept_id',
    'procedure_date',
    timeWindowDays
  );
}

/**
 * Extract measurement features (lab values)
 */
export async function extractMeasurementFeatures(
  connector: OMOPConnector,
  personIds: number[],
  conceptIds: number[],
  aggregation: 'avg' | 'max' | 'min' | 'count' = 'avg',
  timeWindowDays?: number
): Promise<Map<number, Map<number, number>>> {
  if (personIds.length === 0 || conceptIds.length === 0) {
    return new Map();
  }

  const personIdList = personIds.join(',');
  const conceptIdList = conceptIds.join(',');

  let aggFunction: string;
  switch (aggregation) {
    case 'avg':
      aggFunction = 'AVG(value_as_number)';
      break;
    case 'max':
      aggFunction = 'MAX(value_as_number)';
      break;
    case 'min':
      aggFunction = 'MIN(value_as_number)';
      break;
    case 'count':
      aggFunction = 'COUNT(*)';
      break;
  }

  let query = `
    SELECT 
      person_id,
      measurement_concept_id,
      ${aggFunction} as value
    FROM ${connector['getQualifiedTableName']('measurement')}
    WHERE person_id IN (${personIdList})
      AND measurement_concept_id IN (${conceptIdList})
      AND value_as_number IS NOT NULL
  `;

  if (timeWindowDays) {
    query += ` AND measurement_date >= DATEADD(day, -${timeWindowDays}, GETDATE())`;
  }

  query += ` GROUP BY person_id, measurement_concept_id`;

  const result = await connector.query(query);

  const features = new Map<number, Map<number, number>>();

  for (const row of result.rows) {
    const personId = row.person_id as number;
    const conceptId = row.measurement_concept_id as number;
    const value = row.value as number;

    if (!features.has(personId)) {
      features.set(personId, new Map());
    }
    features.get(personId)!.set(conceptId, value);
  }

  return features;
}

/**
 * Generic feature extraction for domain tables
 */
async function extractDomainFeatures(
  connector: OMOPConnector,
  personIds: number[],
  conceptIds: number[],
  tableName: string,
  conceptColumn: string,
  dateColumn: string,
  timeWindowDays?: number
): Promise<Map<number, Map<number, number>>> {
  if (personIds.length === 0 || conceptIds.length === 0) {
    return new Map();
  }

  const personIdList = personIds.join(',');
  const conceptIdList = conceptIds.join(',');

  let query = `
    SELECT 
      person_id,
      ${conceptColumn},
      COUNT(*) as count
    FROM ${connector['getQualifiedTableName'](tableName)}
    WHERE person_id IN (${personIdList})
      AND ${conceptColumn} IN (${conceptIdList})
  `;

  if (timeWindowDays) {
    query += ` AND ${dateColumn} >= DATEADD(day, -${timeWindowDays}, GETDATE())`;
  }

  query += ` GROUP BY person_id, ${conceptColumn}`;

  const result = await connector.query(query);

  const features = new Map<number, Map<number, number>>();

  for (const row of result.rows) {
    const personId = row.person_id as number;
    const conceptId = row[conceptColumn] as number;
    const count = row.count as number;

    if (!features.has(personId)) {
      features.set(personId, new Map());
    }
    features.get(personId)!.set(conceptId, count);
  }

  return features;
}

/**
 * Extract a single feature for a person
 */
async function extractSingleFeature(
  connector: OMOPConnector,
  personId: number,
  featureDef: FeatureDefinition,
  indexDate: Date
): Promise<number | string | boolean> {
  // Use custom SQL if provided
  if (featureDef.sql) {
    const query = featureDef.sql
      .replace('{person_id}', personId.toString())
      .replace('{index_date}', formatDate(indexDate));

    const result = await connector.query(query);
    if (result.rows.length === 0) {
      return getDefaultValue(featureDef.featureType);
    }

    const value = result.rows[0]['value'] || result.rows[0][Object.keys(result.rows[0])[0]];
    return castValue(value, featureDef.featureType);
  }

  // Use concept-based extraction
  if (featureDef.conceptIds && featureDef.conceptIds.length > 0) {
    const aggregation = featureDef.aggregation || 'count';

    if (aggregation === 'exists') {
      // Binary feature: check if concept exists
      const exists = await checkConceptExists(
        connector,
        personId,
        featureDef.conceptIds,
        featureDef.timeWindow
      );
      return exists;
    }

    // Numeric aggregation
    const value = await aggregateConceptFeature(
      connector,
      personId,
      featureDef.conceptIds,
      aggregation,
      featureDef.timeWindow
    );
    return value;
  }

  throw new Error(`Invalid feature definition: ${featureDef.featureName}`);
}

/**
 * Check if any concept exists for a person
 */
async function checkConceptExists(
  connector: OMOPConnector,
  personId: number,
  conceptIds: number[],
  timeWindowDays?: number
): Promise<boolean> {
  const conceptIdList = conceptIds.join(',');

  // Check across all relevant tables
  const tables = [
    {
      table: 'condition_occurrence',
      conceptCol: 'condition_concept_id',
      dateCol: 'condition_start_date',
    },
    { table: 'drug_exposure', conceptCol: 'drug_concept_id', dateCol: 'drug_exposure_start_date' },
    {
      table: 'procedure_occurrence',
      conceptCol: 'procedure_concept_id',
      dateCol: 'procedure_date',
    },
    { table: 'measurement', conceptCol: 'measurement_concept_id', dateCol: 'measurement_date' },
    { table: 'observation', conceptCol: 'observation_concept_id', dateCol: 'observation_date' },
  ];

  for (const { table, conceptCol, dateCol } of tables) {
    let query = `
      SELECT COUNT(*) as count
      FROM ${connector['getQualifiedTableName'](table)}
      WHERE person_id = ${personId}
        AND ${conceptCol} IN (${conceptIdList})
    `;

    if (timeWindowDays) {
      query += ` AND ${dateCol} >= DATEADD(day, -${timeWindowDays}, GETDATE())`;
    }

    const result = await connector.query(query);
    if (result.rows[0] && (result.rows[0].count as number) > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Aggregate concept feature value
 */
async function aggregateConceptFeature(
  connector: OMOPConnector,
  personId: number,
  conceptIds: number[],
  aggregation: 'count' | 'avg' | 'max' | 'min',
  timeWindowDays?: number
): Promise<number> {
  const conceptIdList = conceptIds.join(',');

  // For count, check condition/drug/procedure tables
  if (aggregation === 'count') {
    const tables = [
      {
        table: 'condition_occurrence',
        conceptCol: 'condition_concept_id',
        dateCol: 'condition_start_date',
      },
      {
        table: 'drug_exposure',
        conceptCol: 'drug_concept_id',
        dateCol: 'drug_exposure_start_date',
      },
      {
        table: 'procedure_occurrence',
        conceptCol: 'procedure_concept_id',
        dateCol: 'procedure_date',
      },
    ];

    let totalCount = 0;

    for (const { table, conceptCol, dateCol } of tables) {
      let query = `
        SELECT COUNT(*) as count
        FROM ${connector['getQualifiedTableName'](table)}
        WHERE person_id = ${personId}
          AND ${conceptCol} IN (${conceptIdList})
      `;

      if (timeWindowDays) {
        query += ` AND ${dateCol} >= DATEADD(day, -${timeWindowDays}, GETDATE())`;
      }

      const result = await connector.query(query);
      if (result.rows[0]) {
        totalCount += result.rows[0].count as number;
      }
    }

    return totalCount;
  }

  // For avg/max/min, use measurement table
  let aggFunction: string;
  switch (aggregation) {
    case 'avg':
      aggFunction = 'AVG(value_as_number)';
      break;
    case 'max':
      aggFunction = 'MAX(value_as_number)';
      break;
    case 'min':
      aggFunction = 'MIN(value_as_number)';
      break;
    default:
      aggFunction = 'AVG(value_as_number)';
  }

  let query = `
    SELECT ${aggFunction} as value
    FROM ${connector['getQualifiedTableName']('measurement')}
    WHERE person_id = ${personId}
      AND measurement_concept_id IN (${conceptIdList})
      AND value_as_number IS NOT NULL
  `;

  if (timeWindowDays) {
    query += ` AND measurement_date >= DATEADD(day, -${timeWindowDays}, GETDATE())`;
  }

  const result = await connector.query(query);
  if (result.rows[0] && result.rows[0].value !== null) {
    return result.rows[0].value as number;
  }

  return 0;
}

/**
 * Get default value for feature type
 */
function getDefaultValue(
  featureType: 'numeric' | 'categorical' | 'binary'
): number | string | boolean {
  switch (featureType) {
    case 'numeric':
      return 0;
    case 'categorical':
      return '';
    case 'binary':
      return false;
  }
}

/**
 * Cast value to appropriate type
 */
function castValue(
  value: unknown,
  featureType: 'numeric' | 'categorical' | 'binary'
): number | string | boolean {
  switch (featureType) {
    case 'numeric':
      return Number(value) || 0;
    case 'categorical':
      return String(value) || '';
    case 'binary':
      return Boolean(value);
  }
}

/**
 * Format date to SQL string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
