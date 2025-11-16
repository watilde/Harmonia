/**
 * PostgreSQL connector for OMOP CDM
 */

import { Pool, PoolClient } from 'pg';

import { DatabaseConfig, QueryResult } from '../types';
import { OMOPConnector } from './base';

/**
 * PostgreSQL implementation of OMOP connector
 */
export class PostgreSQLConnector extends OMOPConnector {
  private pool?: Pool;
  private client?: PoolClient;

  constructor(config: DatabaseConfig) {
    super(config);
    if (config.type !== 'postgresql') {
      throw new Error('Invalid database type for PostgreSQL connector');
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    this.client = await this.pool.connect();
    this.connected = true;

    console.log('Connected to PostgreSQL OMOP database');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    if (this.client) {
      this.client.release();
      this.client = undefined;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }

    this.connected = false;
    console.log('Disconnected from PostgreSQL OMOP database');
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.connected || !this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(sql, params);
      return {
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute query with specific search path (schema)
   */
  async queryWithSchema(sql: string, params?: unknown[]): Promise<QueryResult> {
    const setSchemaSQL = `SET search_path TO ${this.config.schema}`;
    await this.query(setSchemaSQL);
    return this.query(sql, params);
  }
}
