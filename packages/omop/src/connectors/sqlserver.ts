/**
 * SQL Server connector for OMOP CDM
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - tedious types are not available
import { Connection, ConnectionConfiguration, Request } from 'tedious';

import { DatabaseConfig, QueryResult } from '../types';
import { OMOPConnector } from './base';

/**
 * SQL Server implementation of OMOP connector
 */
export class SQLServerConnector extends OMOPConnector {
  private connection?: Connection;

  constructor(config: DatabaseConfig) {
    super(config);
    if (config.type !== 'sqlserver') {
      throw new Error('Invalid database type for SQL Server connector');
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const sqlConfig: ConnectionConfiguration = {
      server: this.config.host,
      authentication: {
        type: 'default',
        options: {
          userName: this.config.username,
          password: this.config.password,
        },
      },
      options: {
        database: this.config.database,
        port: this.config.port,
        encrypt: this.config.ssl || false,
        trustServerCertificate: true,
        rowCollectionOnRequestCompletion: true,
      },
    };

    return new Promise((resolve, reject) => {
      this.connection = new Connection(sqlConfig);

      this.connection.on('connect', (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          this.connected = true;
          console.log('Connected to SQL Server OMOP database');
          resolve();
        }
      });

      this.connection.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.connection) {
      return;
    }

    return new Promise((resolve) => {
      this.connection!.on('end', () => {
        this.connected = false;
        this.connection = undefined;
        console.log('Disconnected from SQL Server OMOP database');
        resolve();
      });

      this.connection!.close();
    });
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.connected || !this.connection) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const rows: Record<string, unknown>[] = [];
      const request = new Request(sql, (err: Error | null, rowCount?: number) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            rows,
            rowCount: rowCount || 0,
          });
        }
      });

      // Add parameters if provided
      if (params) {
        params.forEach((param, index) => {
          // Note: tedious parameter handling would need proper type mapping
          // This is a simplified version
          request.addParameter(`param${index}`, typeof param, param);
        });
      }

      request.on('row', (columns: Array<{ metadata: { colName: string }; value: unknown }>) => {
        const row: Record<string, unknown> = {};
        columns.forEach((column: { metadata: { colName: string }; value: unknown }) => {
          row[column.metadata.colName] = column.value;
        });
        rows.push(row);
      });

      this.connection!.execSql(request);
    });
  }
}
