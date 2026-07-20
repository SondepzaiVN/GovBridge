import { readFile } from 'node:fs/promises';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

export const getPostgresPool = (connectionString: string): Pool => {
  pool ??= new Pool({ connectionString });
  return pool;
};

export class PostgresDatabase {
  constructor(private readonly pool: Pool) {}

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, [...values]);
  }

  async runSqlFile(filePath: string): Promise<void> {
    const sql = await readFile(filePath, 'utf8');
    await this.pool.query(sql);
  }
}
