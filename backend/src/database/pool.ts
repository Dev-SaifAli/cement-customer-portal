import pg from 'pg';
import { env } from '../config/env.js';

const connection = env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL }
  : {
      host: env.PG_HOST,
      port: env.PG_PORT,
      database: env.PG_DATABASE,
      user: env.PG_USER,
      password: env.PG_PASSWORD,
    };

export const pool = new pg.Pool({
  ...connection,
  max: env.PG_POOL_MAX,
  ssl: env.PG_SSL ? { rejectUnauthorized: true } : undefined,
});

export const closeDatabase = async (): Promise<void> => pool.end();
