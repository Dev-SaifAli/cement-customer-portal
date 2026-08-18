import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(configDirectory, '../../../.env');
const backendEnvPath = path.resolve(configDirectory, '../../.env');

if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

if (existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath, override: true });
}

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.url().default('http://localhost:5173'),
    API_URL: z.url().default('http://localhost:3000/api/v1'),
    DATABASE_URL: z.string().optional(),
    PG_HOST: z.string().default('localhost'),
    PG_PORT: z.coerce.number().int().positive().default(5432),
    PG_DATABASE: z.string().default('cement_portal'),
    PG_USER: z.string().default('postgres'),
    PG_PASSWORD: z.string().default(''),
    PG_SSL: booleanFromString.default(false),
    PG_POOL_MAX: z.coerce.number().int().positive().default(10),
    JWT_SECRET: z.string().min(32).optional(),
    JWT_EXPIRES_IN: z.string().default('1h'),
    SESSION_SECRET: z.string().min(32).optional(),
    CAPTCHA_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(2 * 60 * 1000),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    FILE_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    FILE_STORAGE_LOCAL_PATH: z.string().default('./storage'),
    FILE_STORAGE_BUCKET: z.string().optional(),
    FILE_STORAGE_REGION: z.string().optional(),
    FILE_STORAGE_ENDPOINT: z.string().optional(),
    FILE_STORAGE_ACCESS_KEY: z.string().optional(),
    FILE_STORAGE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || !env.SESSION_SECRET)) {
      context.addIssue({
        code: 'custom',
        message: 'JWT_SECRET and SESSION_SECRET are required in production',
      });
    }
  });

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
}

export const env = result.data;
