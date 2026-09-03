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
const emptyStringToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(emptyStringToUndefined, z.url().optional());
const commaSeparatedList = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .optional(),
);
const optionalPositiveInteger = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().positive().optional(),
);
const optionalPort = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().min(1).max(65535).optional(),
);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.url().default('http://localhost:5173'),
    CORS_ALLOWED_ORIGINS: commaSeparatedList,
    API_URL: z.url().default('http://localhost:3000/api/v1'),
    DATABASE_URL: z.string().optional(),
    PG_HOST: z.string().default('localhost'),
    PG_PORT: z.coerce.number().int().positive().default(5432),
    PG_DATABASE: z.string().default('cement_portal'),
    PG_USER: z.string().default('postgres'),
    PG_PASSWORD: z.string().default(''),
    PG_SSL: booleanFromString.default(false),
    PG_POOL_MAX: z.coerce.number().int().positive().default(10),
    QUOTATION_VAT_RATE: z.coerce.number().min(0).max(1).default(0.15),
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
    VAS_ENABLED: booleanFromString.default(false),
    VAS_BASE_URL: optionalUrl,
    VAS_ORDER_ENDPOINT: optionalString,
    VAS_COMPANY_CODE: optionalString,
    VAS_TIMEOUT_MS: optionalPositiveInteger,
    EMAIL_ENABLED: booleanFromString.default(false),
    SMTP_HOST: optionalString,
    SMTP_PORT: optionalPort,
    SMTP_SECURE: booleanFromString.default(false),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM: optionalString,
    SALES_TEAM_EMAIL: optionalString,
    CRM_ENABLED: booleanFromString.default(false),
    WHATSAPP_ENABLED: booleanFromString.default(false),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || !env.SESSION_SECRET)) {
      context.addIssue({
        code: 'custom',
        message: 'JWT_SECRET and SESSION_SECRET are required in production',
      });
    }
    if (env.VAS_ENABLED) {
      const requiredConfiguration = [
        ['VAS_BASE_URL', env.VAS_BASE_URL],
        ['VAS_ORDER_ENDPOINT', env.VAS_ORDER_ENDPOINT],
        ['VAS_COMPANY_CODE', env.VAS_COMPANY_CODE],
        ['VAS_TIMEOUT_MS', env.VAS_TIMEOUT_MS],
      ] as const;
      for (const [name, value] of requiredConfiguration) {
        if (value === undefined) {
          context.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} is required when VAS_ENABLED is true`,
          });
        }
      }
    }
    if (env.EMAIL_ENABLED) {
      const requiredConfiguration = [
        ['SMTP_HOST', env.SMTP_HOST],
        ['SMTP_PORT', env.SMTP_PORT],
        ['EMAIL_FROM', env.EMAIL_FROM],
      ] as const;
      for (const [name, value] of requiredConfiguration) {
        if (value === undefined) {
          context.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} is required when EMAIL_ENABLED is true`,
          });
        }
      }
    }
  });

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
}

export const env = result.data;
