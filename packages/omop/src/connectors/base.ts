/**
 * Base database connector interface
 */

import { DatabaseConfig, QueryResult } from '../types';

/**
 * Abstract base class for OMOP database connectors
 */
export abstract class OMOPConnector {
  protected config: DatabaseConfig;
  protected connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Connect to the database
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Execute a query
   */
  abstract query(sql: string, params?: unknown[]): Promise<QueryResult>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get qualified table name with schema
   */
  protected getQualifiedTableName(tableName: string): string {
    return `${this.config.schema}.${tableName}`;
  }

  /**
   * Validate OMOP CDM tables exist
   */
  async validateOMOPSchema(): Promise<boolean> {
    const requiredTables = [
      'person',
      'observation_period',
      'visit_occurrence',
      'condition_occurrence',
      'drug_exposure',
      'procedure_occurrence',
      'measurement',
      'observation',
      'concept',
      'vocabulary',
    ];

    try {
      for (const table of requiredTables) {
        const result = await this.query(
          `SELECT COUNT(*) as count FROM ${this.getQualifiedTableName(table)} LIMIT 1`
        );
        if (!result.rows || result.rows.length === 0) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('OMOP schema validation failed:', error);
      return false;
    }
  }
}
