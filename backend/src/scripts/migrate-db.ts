import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { getPostgresPool, PostgresDatabase } from '../storage/postgres.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (!env.DATABASE_URL.trim()) {
  throw new Error('DATABASE_URL is required to run database migrations.');
}

const pool = getPostgresPool(env.DATABASE_URL);
const database = new PostgresDatabase(pool);

await database.runSqlFile(path.join(backendRoot, 'db/schema.sql'));
await pool.end();

console.log('PostgreSQL schema is up to date.');
